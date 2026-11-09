/* Mode révision : la séance tourne ici, même quand aucun nouvel onglet n'est ouvert.
   Un clic ouvre la suite du site de révisions (#/continuer, comme son bouton
   Continuer), puis travail (sites en pause, notifications coupées) → pause →
   travail… jusqu'au dernier bloc. Réglages dans cours.js, rubrique « revision ». */

const C = self.NOUVEL_ONGLET || {};
const R = Object.assign({ travail: 25, pause: 5, blocs: 4, bloquer: [] }, C.revision);
const SUITE = R.site ? encodeURI(R.site) + "#/continuer" : null;
const HOTE = "com.glime.revision";
const REGLE = 1;
const PAUSE = chrome.runtime.getURL("pause.html");
const MOTIFS = R.bloquer.map((d) => "*://*." + d + "/*");

const bloque = (url) => {
  try {
    const h = new URL(url).hostname;
    return R.bloquer.some((d) => h === d || h.endsWith("." + d));
  } catch {
    return false;
  }
};

async function lire() {
  return (await chrome.storage.local.get("seance")).seance || null;
}

/* ---------- ce que chaque phase change ---------- */

// On ne rend les notifications que si c'est nous qui les avons coupées :
// un « Ne pas déranger » mis à la main dans KDE n'est jamais touché.
async function notifs(coupees, fin) {
  const { calme } = await chrome.storage.local.get("calme");
  if (!coupees && !calme) return;
  const d = new Date(fin - 3000); // rendues juste avant l'alerte de fin de bloc
  const jusqua = [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()].join(",");
  try {
    await chrome.runtime.sendNativeMessage(HOTE, coupees ? { cmd: "calme", jusqua } : { cmd: "bruit" });
  } catch {
    // hôte absent : la séance marche quand même, notifications comprises
  }
  await chrome.storage.local.set({ calme: coupees });
}

async function sites(enPause) {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [REGLE],
    addRules: enPause && R.bloquer.length
      ? [{ id: REGLE, priority: 1, action: { type: "block" }, condition: { requestDomains: R.bloquer, resourceTypes: ["main_frame"] } }]
      : []
  });
  if (!enPause || !MOTIFS.length) return;
  const ouverts = await chrome.tabs.query({ url: MOTIFS });
  for (const t of ouverts) mettreEnPause(t.id, t.url);
}

function mettreEnPause(tabId, url) {
  chrome.tabs.update(tabId, { url: PAUSE + "#" + encodeURIComponent(url) }).catch(() => {});
}

async function appliquer(s) {
  const travail = s && s.phase === "travail";
  await sites(travail);
  await notifs(travail, s ? s.fin : 0);
  if (s) chrome.alarms.create("seance", { when: s.fin });
  else chrome.alarms.clear("seance");
}

function alerte(titre, message) {
  chrome.notifications.create("seance-" + Date.now(), {
    type: "basic",
    iconUrl: "icone.png",
    title: titre,
    message,
    priority: 2
  });
}

/* ---------- la séance ---------- */

async function ouvrirOnglets(s, depuis) {
  if (!SUITE) return;
  if (s.groupe != null) {
    const restants = await chrome.tabs.query({ groupId: s.groupe }).catch(() => []);
    if (restants.length) {
      await chrome.tabs.update(restants[0].id, { active: true });
      await chrome.windows.update(restants[0].windowId, { focused: true });
      if (depuis) chrome.tabs.remove(depuis).catch(() => {});
      return;
    }
  }
  let id;
  if (depuis) {
    await chrome.tabs.update(depuis, { url: SUITE, active: true });
    id = depuis;
  } else {
    id = (await chrome.tabs.create({ url: SUITE })).id;
  }
  // un groupe « Révision » : « Mode révision » y ramène pendant la séance
  try {
    const groupe = await chrome.tabs.group({ tabIds: [id] });
    await chrome.tabGroups.update(groupe, { title: "Révision", color: "purple" });
    s.groupe = groupe;
    await chrome.storage.local.set({ seance: s });
  } catch {}
}

async function commencer(depuis) {
  const now = Date.now();
  const s = { titre: "Révision", couleur: "violet", phase: "travail", bloc: 1, blocs: R.blocs, debut: now, fin: now + R.travail * 60e3, groupe: null };
  await chrome.storage.local.set({ seance: s });
  await appliquer(s);
  await ouvrirOnglets(s, depuis);
}

async function arreter() {
  await chrome.storage.local.remove("seance");
  await appliquer(null);
}

// Passe à la phase suivante ; rattrape aussi le temps passé Helium fermé
async function avancer() {
  let s = await lire();
  if (!s) return appliquer(null);
  const avant = s.phase + s.bloc;
  let finie = 0;
  while (s && Date.now() >= s.fin) {
    if (s.phase === "travail" && s.bloc >= s.blocs) (finie = s.fin), (s = null);
    else if (s.phase === "travail") s = { ...s, phase: "pause", fin: s.fin + R.pause * 60e3 };
    else s = { ...s, phase: "travail", bloc: s.bloc + 1, fin: s.fin + R.travail * 60e3 };
  }
  if (!s) {
    await arreter();
    // Helium fermé pendant des heures : pas d'alerte périmée au réveil
    if (Date.now() - finie < 10 * 60e3) alerte("Séance finie", "Bravo ! Fais une vraie pause, les sites sont de retour.");
    return;
  }
  await chrome.storage.local.set({ seance: s });
  await appliquer(s);
  if (s.phase + s.bloc === avant) return;
  if (s.phase === "pause") alerte(`Pause : ${R.pause} min`, `Bloc ${s.bloc} sur ${s.blocs} fini. Lève-toi, bois un verre d'eau.`);
  else alerte(`Bloc ${s.bloc} sur ${s.blocs}`, `${R.travail} min de révision. Les sites sont de nouveau en pause.`);
}

/* ---------- événements ---------- */

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "seance") avancer();
});
chrome.runtime.onStartup.addListener(avancer);
chrome.runtime.onInstalled.addListener(avancer);

chrome.runtime.onMessage.addListener((m, sender, reponse) => {
  // « garder » : demandé depuis la page de pause, qui doit rester pour rendre son site
  const depuis = !m.garder && sender.tab ? sender.tab.id : null;
  const fait = () => reponse(true);
  if (m.type === "commencer") commencer(depuis).then(fait);
  else if (m.type === "arreter") arreter().then(fait);
  else if (m.type === "rouvrir") lire().then((s) => (s ? ouvrirOnglets(s, depuis) : null)).then(fait);
  else return false;
  return true;
});

// Un site en pause ouvert pendant le travail : il bascule sur la page de pause.
// Le filtre ne réveille la séance que pour ces sites-là.
if (R.bloquer.length) {
  chrome.webNavigation.onBeforeNavigate.addListener(
    async (d) => {
      if (d.frameId !== 0 || !bloque(d.url)) return;
      const s = await lire();
      if (s && s.phase === "travail" && Date.now() < s.fin) mettreEnPause(d.tabId, d.url);
    },
    { url: R.bloquer.flatMap((h) => [{ hostEquals: h }, { hostSuffix: "." + h }]) }
  );
}
