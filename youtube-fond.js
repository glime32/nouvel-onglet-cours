/* Tri YouTube : les vidéos des chaînes « Dans YouTube » rejoignent le groupe
   youtube, celles des chaînes « Garder » restent où elles sont. Une chaîne
   inconnue : question dans un encadré en haut à droite de la page ouverte.
   Un onglet YouTube ouvert en arrière-plan attend sur attente.html jusqu'au clic. */
(() => {
  const ATTENTE = chrome.runtime.getURL("attente.html");
  const GROUPE = "youtube";
  const HOTES = ["www.youtube.com", "m.youtube.com", "youtube.com"];
  const MAX_VIDEOS = 800;
  const FILTRE = [
    ...HOTES.flatMap((h) => [{ hostEquals: h, pathEquals: "/watch" }, { hostEquals: h, pathPrefix: "/shorts/" }, { hostEquals: h, pathPrefix: "/live/" }]),
    { hostEquals: "youtu.be" }
  ];

  function idVideo(url) {
    let u;
    try {
      u = new URL(url);
    } catch {
      return null;
    }
    if (url.startsWith(ATTENTE)) return idVideo(decodeURIComponent(u.hash.slice(1)));
    let id = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    else if (HOTES.includes(u.hostname)) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else id = (/^\/(?:shorts|live)\/([^/]+)/.exec(u.pathname) || [])[1];
    }
    return /^[\w-]{11}$/.test(id || "") ? id : null;
  }

  /* ---------- d'où vient la vidéo : API (clé), sinon oEmbed (nom de chaîne seul) ---------- */

  async function depuisApi(ids, cle) {
    const r = {};
    for (let i = 0; i < ids.length; i += 50) {
      const q = new URLSearchParams({
        part: "snippet",
        id: ids.slice(i, i + 50).join(","),
        fields: "items(id,snippet(channelId,channelTitle,title,categoryId))",
        key: cle
      });
      const rep = await fetch("https://www.googleapis.com/youtube/v3/videos?" + q, { credentials: "omit" }).catch(() => {
        throw new Error("pas de réseau");
      });
      if (!rep.ok) throw new Error("API YouTube : erreur " + rep.status);
      for (const v of (await rep.json()).items || []) {
        const s = v.snippet;
        r[v.id] = { c: s.channelId, n: s.channelTitle, t: s.title, cat: s.categoryId };
      }
    }
    return r;
  }

  async function depuisOembed(ids) {
    const r = {};
    await Promise.all(
      ids.map(async (id) => {
        const q = new URLSearchParams({ url: "https://www.youtube.com/watch?v=" + id, format: "json" });
        const rep = await fetch("https://www.youtube.com/oembed?" + q, { credentials: "omit" }).catch(() => null);
        if (!rep || !rep.ok) return;
        const o = await rep.json();
        r[id] = { c: "nom:" + o.author_name, n: o.author_name, t: o.title };
      })
    );
    return r;
  }

  async function infos(ids) {
    const { ytVideos: connues = {}, ytCle } = await chrome.storage.local.get(["ytVideos", "ytCle"]);
    const manquent = [...new Set(ids)].filter((id) => !connues[id]);
    if (!manquent.length) return connues;
    let neuves;
    try {
      neuves = ytCle ? await depuisApi(manquent, ytCle) : await depuisOembed(manquent);
      if (ytCle) await chrome.storage.local.remove("ytErreur");
    } catch (e) {
      await chrome.storage.local.set({ ytErreur: e.message });
      neuves = await depuisOembed(manquent);
    }
    const vu = Date.now();
    for (const id in neuves) connues[id] = { ...neuves[id], vu };
    const ordre = Object.keys(connues).sort((a, b) => connues[b].vu - connues[a].vu);
    for (const id of ordre.slice(MAX_VIDEOS)) delete connues[id];
    await chrome.storage.local.set({ ytVideos: connues });
    return connues;
  }

  // une chaîne vue d'abord sans clé (oEmbed) est retrouvée par son nom
  const decision = (chaines, i) => chaines[i.c] || Object.values(chaines).find((ch) => ch.nom === i.n) || null;

  /* ---------- ranger ---------- */

  async function groupeYoutube(fenetre) {
    const groupes = await chrome.tabGroups.query({ windowId: fenetre });
    const g = groupes.find((x) => (x.title || "").trim().toLowerCase() === GROUPE);
    return g ? g.id : null;
  }

  async function ranger(t, veille) {
    let g = await groupeYoutube(t.windowId);
    if (g == null) {
      g = await chrome.tabs.group({ tabIds: [t.id], createProperties: { windowId: t.windowId } });
      await chrome.tabGroups.update(g, { title: GROUPE, color: "pink" });
    } else if (t.groupId !== g) {
      await chrome.tabs.group({ tabIds: [t.id], groupId: g });
    } else return null;
    if (veille && !t.audible && !t.discarded && !t.url.startsWith(ATTENTE)) await chrome.tabs.discard(t.id).catch(() => {});
    return g;
  }

  async function sortir(t) {
    const g = await groupeYoutube(t.windowId);
    if (g != null && t.groupId === g) await chrome.tabs.ungroup(t.id).catch(() => {});
  }

  async function replier(g) {
    const [actif] = await chrome.tabs.query({ groupId: g, active: true });
    if (!actif) await chrome.tabGroups.update(g, { collapsed: true }).catch(() => {});
  }

  // onglet regardé : il ne bouge pas tout de suite, il part quand on le quitte
  async function plusTardOnglet(id) {
    const { ytQuitter: q = [] } = await chrome.storage.session.get("ytQuitter");
    if (!q.includes(id)) await chrome.storage.session.set({ ytQuitter: [...q, id] });
  }

  // demanderTout : aussi les chaînes mises de côté par la croix (bouton, nouvelle vidéo)
  async function trier(onglets, { demanderTout = true, replie = false } = {}) {
    const avec = onglets.map((t) => [t, idVideo(t.url || t.pendingUrl || "")]).filter(([, v]) => v);
    if (!avec.length) return;
    const connues = await infos(avec.map(([, v]) => v));
    const { ytChaines: chaines = {}, ytPlusTard: plusTard = [] } = await chrome.storage.local.get(["ytChaines", "ytPlusTard"]);
    const groupes = new Set();
    const aDemander = new Map();
    for (const [t, v] of avec) {
      const i = connues[v];
      if (!i) continue;
      const ch = decision(chaines, i);
      if (!ch) {
        if (demanderTout || !plusTard.includes(i.c)) aDemander.set(i.c, { c: i.c, nom: i.n, titre: i.t, cat: i.cat || null });
      } else if (!ch.yt) await sortir(t);
      else if (t.active) await plusTardOnglet(t.id);
      else {
        const g = await ranger(t, true);
        if (g != null) groupes.add(g);
      }
    }
    if (replie) for (const g of groupes) await replier(g);
    if (aDemander.size) await demander([...aDemander.values()], demanderTout);
  }

  /* ---------- questions ---------- */

  async function demander(liste, insister) {
    const { ytQuestions: q = [] } = await chrome.storage.session.get("ytQuestions");
    if (insister) {
      const { ytPlusTard: pt = [] } = await chrome.storage.local.get("ytPlusTard");
      const restent = pt.filter((c) => !liste.some((x) => x.c === c));
      if (restent.length !== pt.length) await chrome.storage.local.set({ ytPlusTard: restent });
    }
    const avant = q.length;
    for (const x of liste) if (!q.some((y) => y.c === x.c)) q.push(x);
    if (q.length === avant) return;
    await chrome.storage.session.set({ ytQuestions: q });
    await montrer();
  }

  async function montrer() {
    const { ytQuestions: q = [] } = await chrome.storage.session.get("ytQuestions");
    if (!q.length) return;
    const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!t || !/^https?:/.test(t.url || "")) return;
    // sans attendre : une page lente ne doit pas bloquer le tri
    chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["youtube-question.js"] }).catch(() => {});
  }

  async function question() {
    const { ytQuestions: q = [], ytFaites: faites = 0 } = await chrome.storage.session.get(["ytQuestions", "ytFaites"]);
    return q.length ? { ...q[0], rang: faites + 1, total: faites + q.length } : null;
  }

  async function choisir(c, yt, nom) {
    const { ytChaines: chaines = {}, ytPlusTard: pt = [] } = await chrome.storage.local.get(["ytChaines", "ytPlusTard"]);
    chaines[c] = { nom: nom || (chaines[c] && chaines[c].nom) || c, yt, quand: Date.now() };
    await chrome.storage.local.set({ ytChaines: chaines, ytPlusTard: pt.filter((x) => x !== c) });
    const { ytQuestions: q = [], ytFaites: faites = 0 } = await chrome.storage.session.get(["ytQuestions", "ytFaites"]);
    const reste = q.filter((x) => x.c !== c);
    if (reste.length !== q.length) await chrome.storage.session.set({ ytQuestions: reste, ytFaites: reste.length ? faites + 1 : 0 });
    await trier(await chrome.tabs.query({}), { demanderTout: false, replie: true });
  }

  // une petite requête pour savoir tout de suite si la clé marche
  async function enregistrerCle(cle) {
    if (!cle) return chrome.storage.local.remove(["ytCle", "ytErreur"]);
    await chrome.storage.local.set({ ytCle: cle });
    try {
      await depuisApi(["dQw4w9WgXcQ"], cle);
      await chrome.storage.local.remove("ytErreur");
    } catch (e) {
      await chrome.storage.local.set({ ytErreur: e.message });
    }
  }

  async function fermer() {
    const { ytQuestions: q = [] } = await chrome.storage.session.get("ytQuestions");
    const { ytPlusTard: pt = [] } = await chrome.storage.local.get("ytPlusTard");
    await chrome.storage.local.set({ ytPlusTard: [...new Set([...pt, ...q.map((x) => x.c)])] });
    await chrome.storage.session.set({ ytQuestions: [], ytFaites: 0 });
  }

  let styles = null;
  async function lireStyles() {
    const texte = (f) => fetch(f).then((r) => r.text());
    const base64 = async (f) => {
      const octets = new Uint8Array(await (await fetch(f)).arrayBuffer());
      let s = "";
      for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
      return btoa(s);
    };
    return {
      css: [await texte("style.css")],
      polices: [
        { famille: "Archivo", donnees: await base64("fonts/archivo.woff2"), options: { weight: "450 850", stretch: "88% 112%" } },
        { famille: "Gloock", donnees: await base64("fonts/gloock.woff2"), options: { weight: "400" } }
      ]
    };
  }

  /* ---------- événements ---------- */

  let suite = Promise.resolve();
  const unAUn = (f) => (suite = suite.then(f).catch(() => {}));

  chrome.webNavigation.onBeforeNavigate.addListener(
    (d) =>
      unAUn(async () => {
        if (d.frameId !== 0) return;
        const t = await chrome.tabs.get(d.tabId).catch(() => null);
        if (!t) return;
        const attendre = !t.active && !(t.url || "").startsWith(ATTENTE);
        const url = attendre ? ATTENTE + "#" + encodeURIComponent(d.url) : d.url;
        if (attendre) await chrome.tabs.update(t.id, { url }).catch(() => {});
        await trier([{ ...t, url }]);
      }),
    { url: FILTRE }
  );

  // vidéo suivante dans l'onglet regardé (YouTube change d'adresse sans recharger)
  chrome.webNavigation.onHistoryStateUpdated.addListener(
    (d) =>
      unAUn(async () => {
        if (d.frameId !== 0) return;
        const t = await chrome.tabs.get(d.tabId).catch(() => null);
        if (t && t.active) await trier([{ ...t, url: d.url }]);
      }),
    { url: FILTRE }
  );

  // une vidéo ouverte par un lien : l'encadré attend que la page soit là
  chrome.webNavigation.onDOMContentLoaded.addListener((d) => d.frameId === 0 && unAUn(montrer), { url: FILTRE });

  chrome.tabs.onActivated.addListener(() =>
    unAUn(async () => {
      const { ytQuitter: q = [] } = await chrome.storage.session.get("ytQuitter");
      if (q.length) {
        const garder = [];
        for (const id of q) {
          const t = await chrome.tabs.get(id).catch(() => null);
          if (!t) continue;
          if (t.active) garder.push(id);
          else if (idVideo(t.url || "")) {
            const g = await ranger(t, false);
            if (g != null) await replier(g);
          }
        }
        await chrome.storage.session.set({ ytQuitter: garder });
      }
      await montrer();
    })
  );

  chrome.runtime.onStartup.addListener(() => chrome.alarms.create("youtube-depart", { delayInMinutes: 0.4 }));
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === "youtube-depart") unAUn(async () => trier(await chrome.tabs.query({}), { demanderTout: false, replie: true }));
  });

  chrome.runtime.onMessage.addListener((m, sender, reponse) => {
    if (sender.id !== chrome.runtime.id || typeof m.type !== "string" || !m.type.startsWith("yt")) return false;
    const fini = (f) => unAUn(f).then(() => reponse(true));
    if (m.type === "ytQuestion") question().then(reponse);
    else if (m.type === "ytStyles") (styles = styles || lireStyles()).then(reponse);
    else if (m.type === "ytChoix") fini(() => choisir(String(m.c), !!m.yt, m.nom));
    else if (m.type === "ytFermer") fini(fermer);
    else if (m.type === "ytTrier") fini(async () => trier(await chrome.tabs.query({}), { replie: true }));
    else if (m.type === "ytCle") fini(() => enregistrerCle(String(m.cle || "").trim()));
    else if (m.type === "ytTitre") {
      const id = idVideo(m.url || "");
      if (!id) return false;
      infos([id]).then((c) => reponse(c[id] ? c[id].t : null));
    } else return false;
    return true;
  });
})();
