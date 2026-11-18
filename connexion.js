/* Moodle demande de se connecter : on se connecte en fond (seulement le formulaire
   CAS, 30 Ko, au lieu de la page et de ses 2,6 Mo), puis retour sur la page voulue.
   Sinon, la page CAS habituelle. Jamais deux essais en fond à moins d'une minute. */
const MOODLE = "https://moodle.umontpellier.fr/";
const CAS_DIRECT = "https://cas.umontpellier.fr/cas/login?service=" + encodeURIComponent(MOODLE + "login/index.php?authCAS=CAS");
const CLE = "fac-connexion-fond";

const recent = Date.now() - Number(sessionStorage.getItem(CLE) || 0) < 60e3;
sessionStorage.setItem(CLE, String(Date.now()));
const essai = recent ? Promise.resolve(null) : chrome.runtime.sendMessage({ type: "connecterFond" }).catch(() => null);
Promise.race([essai, new Promise((r) => setTimeout(() => r(null), 15000))]).then((r) => {
  const bonne = r && r.ok && r.url && r.url.startsWith(MOODLE) && !r.url.includes("/login/");
  location.replace(bonne ? r.url : CAS_DIRECT);
});
