/* Fac, côté fond :
   - range les fichiers demandés par le bouton « Tout télécharger » de Moodle ;
   - garde Moodle et Prose connectés. Toutes les 20 min, au démarrage d'Helium et
     au réveil du PC, seulement pour un site utilisé dans les 12 dernières heures :
       · Moodle encore connecté : on « touche » la session (core_session_touch,
         ce que Moodle fait lui-même), sans en créer une nouvelle ;
       · session morte : on refait le passage par CAS en silence. Si CAS te
         reconnaît encore, tu es reconnecté sans rien voir ; sinon la page CAS
         s'ouvrira normalement la prochaine fois (Bitwarden + clic automatique). */

const MOODLE_URL = "https://moodle.umontpellier.fr";
const MOODLE_CAS = MOODLE_URL + "/login/index.php?authCAS=CAS";
const PROSE = "https://app.umontpellier.fr/prose-etudiant/protected/planning";
const RECENT = 12 * 3600e3;

chrome.runtime.onMessage.addListener((m, _sender, reponse) => {
  if (m.type === "telecharger") {
    telecharger(m.fichiers || []).then(reponse);
    return true;
  }
  if (m.type === "sesskey" && m.sesskey) {
    chrome.storage.local.set({ sesskey: m.sesskey });
  }
  if (m.type === "rafraichir") {
    rafraichir().then(() => chrome.storage.local.get("facBilan")).then(({ facBilan }) => reponse(facBilan));
    return true;
  }
  return false;
});

async function telecharger(fichiers) {
  const { telecharges = {} } = await chrome.storage.local.get("telecharges");
  let ok = 0;
  for (const f of fichiers) {
    try {
      // uniquify : un fichier déjà là (peut-être annoté) n'est jamais écrasé
      await chrome.downloads.download({ url: f.url, filename: f.chemin, conflictAction: "uniquify", saveAs: false });
      telecharges[f.url] = Date.now();
      ok++;
    } catch {}
  }
  await chrome.storage.local.set({ telecharges });
  return ok;
}

/* ---------- rester connecté ---------- */

// Suit les redirections (Moodle → CAS → Moodle) et s'arrête aux en-têtes de la
// dernière page : rien n'est téléchargé, seule l'adresse d'arrivée compte.
async function passer(url, lireCorps = false) {
  const stop = new AbortController();
  const minuteur = setTimeout(() => stop.abort(), 20000);
  try {
    const r = await fetch(url, { credentials: "include", cache: "no-store", signal: stop.signal });
    const corps = lireCorps && r.ok ? await r.text() : "";
    return { url: r.url, ok: r.ok, corps };
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
    stop.abort();
  }
}

const surFormulaireCas = (url) => /cas\.umontpellier\.fr\/.*login/.test(url || "");

async function moodle() {
  const { sesskey } = await chrome.storage.local.get("sesskey");
  if (sesskey) {
    try {
      const r = await fetch(`${MOODLE_URL}/lib/ajax/service.php?sesskey=${encodeURIComponent(sesskey)}&info=core_session_touch`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ index: 0, methodname: "core_session_touch", args: {} }])
      });
      const j = await r.json();
      if (Array.isArray(j) && j[0] && j[0].error === false) return "touchée";
    } catch {}
  }
  // Pas de clé, ou session morte : est-on encore connecté ? (une redirection = non)
  const essai = await fetch(`${MOODLE_URL}/my/`, { credentials: "include", cache: "no-store", redirect: "manual" }).catch(() => null);
  if (essai && essai.type !== "opaqueredirect" && essai.ok) {
    // connecté mais clé inconnue : on lit la page une fois pour la retrouver
    const p = await passer(`${MOODLE_URL}/my/`, true);
    const k = p && /"sesskey":"(\w+)"/.exec(p.corps);
    if (k) await chrome.storage.local.set({ sesskey: k[1] });
    return "connectée";
  }
  // Un onglet Moodle ou CAS est ouvert (ou « PDF Moodle Restore » est en train de
  // se connecter) : pas de connexion en silence, sinon deux sessions Moodle se
  // croiseraient et la page ouverte perdrait sa clé. Elle se reconnectera au prochain clic.
  const ouverts = await chrome.tabs.query({ url: ["https://moodle.umontpellier.fr/*", "https://cas.umontpellier.fr/*"] });
  if (ouverts.length) return "onglet ouvert : reconnexion au prochain clic";
  const p = await passer(MOODLE_CAS, true);
  if (!p || surFormulaireCas(p.url)) return "CAS demande le mot de passe";
  const k = /"sesskey":"(\w+)"/.exec(p.corps);
  if (k) await chrome.storage.local.set({ sesskey: k[1] });
  return "reconnectée en silence";
}

async function prose() {
  const p = await passer(PROSE);
  if (!p) return "injoignable";
  return surFormulaireCas(p.url) ? "CAS demande le mot de passe" : "à jour";
}

let enCours = false;
async function rafraichir() {
  if (enCours) return;
  enCours = true;
  try {
    const { vuMoodle = 0, vuProse = 0 } = await chrome.storage.local.get(["vuMoodle", "vuProse"]);
    const bilan = {};
    if (Date.now() - vuMoodle < RECENT) bilan.moodle = await moodle();
    if (Date.now() - vuProse < RECENT) bilan.prose = await prose();
    await chrome.storage.local.set({ facBilan: { ...bilan, quand: Date.now() } });
  } finally {
    enCours = false;
  }
}

function armer() {
  chrome.alarms.create("fac", { periodInMinutes: 20 });
  chrome.idle.setDetectionInterval(15 * 60);
}

chrome.runtime.onStartup.addListener(() => {
  armer();
  // 30 s après le démarrage : les onglets restaurés et « PDF Moodle Restore » passent d'abord
  chrome.alarms.create("fac-depart", { delayInMinutes: 0.5 });
});
chrome.runtime.onInstalled.addListener(armer);
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "fac" || a.name === "fac-depart") rafraichir();
});
// retour devant le PC (réveil, déverrouillage, après 15 min d'inactivité)
chrome.idle.onStateChanged.addListener((etat) => {
  if (etat === "active") rafraichir();
});

// On note quand tu utilises Moodle ou Prose (le filtre ne réveille que pour eux)
chrome.webNavigation.onCompleted.addListener(
  (d) => {
    if (d.frameId !== 0) return;
    const cle = d.url.startsWith(MOODLE_URL) ? "vuMoodle" : "vuProse";
    chrome.storage.local.set({ [cle]: Date.now() });
  },
  { url: [{ hostEquals: "moodle.umontpellier.fr" }, { hostEquals: "app.umontpellier.fr", pathPrefix: "/prose-etudiant" }] }
);
