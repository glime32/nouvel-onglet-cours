/* Moodle de l'université.
   1. Page de connexion : on passe tout de suite par CAS (plus de bouton à cliquer).
   2. Page d'un cours : bouton « Tout télécharger » qui range les PDF, TD et dossiers
      du cours dans Téléchargements/Moodle-S1/<matière>/, sans reprendre ceux déjà
      téléchargés. Les cours et leurs noms courts viennent de cours.js. */
(() => {
  "use strict";

  const ici = new URL(location.href);

  /* ---------- 1. connexion ---------- */
  if (ici.pathname === "/login/index.php" && !ici.searchParams.has("authCAS")) {
    const cas = document.querySelector('a.login-identityprovider-btn[href*="authCAS=CAS"]');
    const CLE = "fac-auto-moodle";
    // « PDF Moodle Restore » clique aussi ce bouton : un seul des deux part
    const recent = (k) => Date.now() - Number(sessionStorage.getItem(k) || 0) < 30e3;
    if (cas && !recent(CLE) && !recent("autoLogin")) {
      sessionStorage.setItem(CLE, String(Date.now()));
      sessionStorage.setItem("autoLogin", String(Date.now()));
      location.replace(cas.href);
    }
    return;
  }

  // La clé de session de la page : la tâche de fond s'en sert pour garder la session en vie
  for (const s of document.querySelectorAll("script:not([src])")) {
    const k = /"sesskey":"(\w+)"/.exec(s.textContent);
    if (k) {
      chrome.runtime.sendMessage({ type: "sesskey", sesskey: k[1] }).catch(() => {});
      break;
    }
  }

  /* ---------- 2. tout télécharger ---------- */
  if (ici.pathname !== "/course/view.php") return;
  const coursId = ici.searchParams.get("id");
  if (!coursId) return;

  const C = self.NOUVEL_ONGLET || {};
  let rangement = "cours-" + coursId;
  for (const g of C.groupes || []) {
    for (const c of g.cours || []) if (String(c.id) === coursId) rangement = c.site || c.code || rangement;
  }
  const DOSSIER = "Moodle-S1/" + rangement;

  const titre = document.querySelector(".page-header-headings, .page-context-header, #page-header h1, h1");
  if (!titre) return;

  const zone = document.createElement("div");
  zone.className = "fac-telecharger d-flex flex-wrap align-items-center mt-2 mb-2";
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "btn btn-secondary mr-2";
  bouton.textContent = "Tout télécharger";
  bouton.title = "Range les fichiers du cours dans Téléchargements/" + DOSSIER + " (seulement les nouveaux)";
  const etat = document.createElement("span");
  etat.className = "small text-muted";
  etat.setAttribute("role", "status");
  zone.append(bouton, etat);
  titre.after(zone);

  const propre = (s) =>
    s.replace(/[\/\\:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").replace(/^[.\s]+|[.\s]+$/g, "").slice(0, 120) || "fichier";

  async function page(chemin) {
    const r = await fetch(chemin, { credentials: "include" });
    if (!r.ok) throw new Error(chemin + " : " + r.status);
    return new DOMParser().parseFromString(await r.text(), "text/html");
  }

  const fichierDe = (url) => {
    try {
      const u = new URL(url, location.origin);
      return u.pathname.includes("/pluginfile.php/") ? propre(decodeURIComponent(u.pathname.split("/").pop())) : null;
    } catch {
      return null;
    }
  };

  // Une ressource Moodle : soit elle redirige vers le fichier, soit sa page le contient
  async function fichierDeRessource(cmid) {
    const stop = new AbortController();
    const r = await fetch(`/mod/resource/view.php?id=${cmid}&redirect=1`, { credentials: "include", signal: stop.signal });
    if (r.url.includes("/pluginfile.php/")) {
      stop.abort();
      return r.url;
    }
    if (!(r.headers.get("content-type") || "").includes("html")) {
      stop.abort();
      return null;
    }
    const doc = new DOMParser().parseFromString(await r.text(), "text/html");
    const a = doc.querySelector('.resourceworkaround a[href*="/pluginfile.php/"], #region-main a[href*="/pluginfile.php/"], object[data*="/pluginfile.php/"], iframe[src*="/pluginfile.php/"]');
    return a ? a.href || a.data || a.src : null;
  }

  async function chercher() {
    const vus = new Map(); // url du fichier -> chemin dans Téléchargements
    const ajouter = (url, sousDossier) => {
      const nom = fichierDe(url);
      if (!nom) return;
      const propreUrl = url.replace(/[?&]forcedownload=1/, "");
      if (!vus.has(propreUrl)) vus.set(propreUrl, DOSSIER + "/" + (sousDossier ? propre(sousDossier) + "/" : "") + nom);
    };

    const [ressources, dossiers] = await Promise.all([page(`/course/resources.php?id=${coursId}`), page(`/mod/folder/index.php?id=${coursId}`).catch(() => null)]);

    const cmids = [...new Set([...ressources.querySelectorAll('a[href*="/mod/resource/view.php?id="]')].map((a) => new URL(a.href).searchParams.get("id")))];
    let fait = 0;
    etat.textContent = `Recherche des fichiers… 0 sur ${cmids.length}`;
    const lot = 4;
    for (let i = 0; i < cmids.length; i += lot) {
      const urls = await Promise.all(cmids.slice(i, i + lot).map((id) => fichierDeRessource(id).catch(() => null)));
      for (const u of urls) if (u) ajouter(u);
      fait += urls.length;
      etat.textContent = `Recherche des fichiers… ${fait} sur ${cmids.length}`;
    }

    if (dossiers) {
      const liens = [...dossiers.querySelectorAll('a[href*="/mod/folder/view.php?id="]')];
      for (const a of liens) {
        const doc = await page(a.getAttribute("href")).catch(() => null);
        if (!doc) continue;
        for (const f of doc.querySelectorAll('a[href*="/pluginfile.php/"][href*="/mod_folder/content/"]')) ajouter(f.href, a.textContent.trim());
      }
    }

    // Fichiers glissés directement dans les sections du cours
    for (const a of document.querySelectorAll('.course-content a[href*="/pluginfile.php/"]')) ajouter(a.href);
    return vus;
  }

  bouton.addEventListener("click", async () => {
    bouton.disabled = true;
    try {
      const tous = await chercher();
      const { telecharges = {} } = await chrome.storage.local.get("telecharges");
      const nouveaux = [...tous].filter(([url]) => !telecharges[url]).map(([url, chemin]) => ({ url, chemin }));
      if (!nouveaux.length) {
        etat.textContent = tous.size ? `Rien de nouveau : les ${tous.size} fichiers sont déjà dans Téléchargements/${DOSSIER}.` : "Aucun fichier trouvé dans ce cours.";
        return;
      }
      etat.textContent = `${nouveaux.length} fichier${nouveaux.length > 1 ? "s" : ""} en cours de téléchargement…`;
      const ok = await chrome.runtime.sendMessage({ type: "telecharger", fichiers: nouveaux });
      etat.textContent = `✓ ${ok} nouveau${ok > 1 ? "x" : ""} fichier${ok > 1 ? "s" : ""} dans Téléchargements/${DOSSIER}.`;
    } catch (e) {
      etat.textContent = "Échec : " + (e && e.message ? e.message : e) + ". Recharge la page et réessaie.";
    } finally {
      bouton.disabled = false;
    }
  });
})();
