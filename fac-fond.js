/* Fac, côté fond : range les fichiers du bouton « Tout télécharger », et garde
   Moodle et Prose connectés (toutes les 20 min, au démarrage et au retour devant
   le PC, pour un site utilisé dans les 12 dernières heures).
   Session vivante : on la « touche ». Session morte : on repasse par CAS sans
   rien afficher, avec tes identifiants de ~/.config/fac/identifiants si CAS les
   redemande. Un refus de CAS arrête tout essai automatique pendant 24 h. */

const MOODLE_URL = "https://moodle.umontpellier.fr";
const CAS = "https://cas.umontpellier.fr";
// tout droit chez CAS : le détour par Moodle (et son « gateway ») coûte 3 à 5 s
const MOODLE_CAS = CAS + "/cas/login?service=" + encodeURIComponent(MOODLE_URL + "/login/index.php?authCAS=CAS");
const PROSE = "https://app.umontpellier.fr/prose-etudiant/protected/planning";
const RECENT = 12 * 3600e3;
const PAUSE_REFUS = 24 * 3600e3;
const HOTE_FAC = "com.glime.fac";

chrome.runtime.onMessage.addListener((m, sender, reponse) => {
  if (m.type === "telecharger") {
    telecharger(m.fichiers || []).then(reponse);
    return true;
  }
  if (m.type === "sesskey" && m.sesskey) {
    chrome.storage.local.set({ sesskey: m.sesskey });
  }
  if (m.type === "identifiants") {
    // seulement pour la vraie page CAS, et pour nos propres scripts
    if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !(sender.url || "").startsWith(CAS + "/")) return false;
    identifiants().then(reponse);
    return true;
  }
  if (m.type === "rafraichir" || m.type === "reconnecter") {
    rafraichir(m.type === "reconnecter").then(() => chrome.storage.local.get("facBilan")).then(({ facBilan }) => reponse(facBilan));
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

async function identifiants() {
  try {
    const r = await chrome.runtime.sendNativeMessage(HOTE_FAC, { cmd: "lire" });
    return r && r.ok ? { u: r.u, p: r.p } : null;
  } catch {
    return null;
  }
}

// Suit les redirections et s'arrête aux en-têtes de la dernière page, sauf si on veut son texte
async function passer(url, lireCorps = false, options = {}) {
  const stop = new AbortController();
  const minuteur = setTimeout(() => stop.abort(), 25000);
  try {
    const r = await fetch(url, { credentials: "include", cache: "no-store", signal: stop.signal, ...options });
    const corps = lireCorps ? await r.text() : "";
    return { url: r.url, ok: r.ok, corps };
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
    stop.abort();
  }
}

const surFormulaireCas = (url) => /cas\.umontpellier\.fr\/.*login/.test(url || "");
const cleDe = (html) => (/"sesskey":"(\w+)"/.exec(html || "") || [])[1];
const entites = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// Connexion complète sans page visible : départ (Moodle ou Prose) → CAS → formulaire
// rempli avec tes identifiants → retour sur le site. Renvoie la page d'arrivée.
async function connexion(depart, forcee) {
  const p = await passer(depart, true);
  if (!p) return { ok: false, etat: "injoignable" };
  if (!surFormulaireCas(p.url)) return { ok: true, etat: "reconnue par CAS", corps: p.corps };

  const { casRefus = 0 } = await chrome.storage.local.get("casRefus");
  if (!forcee && Date.now() - casRefus < PAUSE_REFUS) return { ok: false, etat: "CAS a refusé récemment : pas de nouvel essai" };
  const id = await identifiants();
  if (!id) return { ok: false, etat: "CAS demande le mot de passe" };

  const action = /<form[^>]*id="fm1"[^>]*action="([^"]*)"/.exec(p.corps);
  if (!action) return { ok: false, etat: "formulaire CAS inconnu" };
  const champs = new URLSearchParams();
  for (const [balise] of p.corps.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const nom = /name="([^"]*)"/.exec(balise);
    const val = /value="([^"]*)"/.exec(balise);
    if (nom) champs.set(nom[1], val ? entites(val[1]) : "");
  }
  champs.set("username", id.u);
  champs.set("password", id.p);
  const r = await passer(new URL(entites(action[1]), p.url).href, true, { method: "POST", body: champs });
  if (r && !surFormulaireCas(r.url)) return { ok: true, etat: "connectée en arrière-plan", corps: r.corps };

  await chrome.storage.local.set({ casRefus: Date.now() });
  const refus = r && /loginErrorsPanel|banner-danger|alert-danger/.test(r.corps);
  const etat = refus ? "mot de passe refusé par CAS" : "CAS demande autre chose (un code ?)";
  chrome.notifications.create("fac-" + Date.now(), {
    type: "basic",
    iconUrl: "icone.png",
    title: "Connexion à la fac",
    message: refus
      ? "CAS a refusé ton mot de passe. Vérifie ~/.config/fac/identifiants. Plus d'essai automatique pendant 24 h."
      : "CAS demande une étape en plus. Connecte-toi une fois à la main ; plus d'essai automatique pendant 24 h.",
    priority: 2
  });
  return { ok: false, etat };
}

async function moodle(forcee) {
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
  // une redirection = plus connecté
  const essai = await fetch(`${MOODLE_URL}/my/`, { credentials: "include", cache: "no-store", redirect: "manual" }).catch(() => null);
  if (essai && essai.type !== "opaqueredirect" && essai.ok) {
    const p = await passer(`${MOODLE_URL}/my/`, true);
    const k = p && cleDe(p.corps);
    if (k) await chrome.storage.local.set({ sesskey: k });
    return "connectée";
  }
  // Onglet Moodle ou CAS ouvert : pas de connexion en douce (deux sessions se
  // croiseraient). La page ouverte se reconnecte toute seule au prochain clic.
  const ouverts = await chrome.tabs.query({ url: [MOODLE_URL + "/*", CAS + "/*"] });
  if (ouverts.length && !forcee) return "onglet ouvert : reconnexion au prochain clic";
  const c = await connexion(MOODLE_CAS, forcee);
  const k = c.ok && cleDe(c.corps);
  if (k) await chrome.storage.local.set({ sesskey: k });
  return c.etat;
}

async function prose(forcee) {
  const p = await passer(PROSE);
  if (!p) return "injoignable";
  if (!surFormulaireCas(p.url)) return "à jour";
  return (await connexion(PROSE, forcee)).etat;
}

let enCours = false;
async function rafraichir(forcee = false) {
  if (enCours) return;
  enCours = true;
  try {
    const { vuMoodle = 0, vuProse = 0 } = await chrome.storage.local.get(["vuMoodle", "vuProse"]);
    const bilan = {};
    if (forcee || Date.now() - vuMoodle < RECENT) bilan.moodle = await moodle(forcee);
    if (forcee || Date.now() - vuProse < RECENT) bilan.prose = await prose(forcee);
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

chrome.webNavigation.onCompleted.addListener(
  (d) => {
    if (d.frameId !== 0) return;
    const cle = d.url.startsWith(MOODLE_URL) ? "vuMoodle" : "vuProse";
    chrome.storage.local.set({ [cle]: Date.now() });
  },
  { url: [{ hostEquals: "moodle.umontpellier.fr" }, { hostEquals: "app.umontpellier.fr", pathPrefix: "/prose-etudiant" }] }
);
