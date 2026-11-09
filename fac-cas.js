/* Page de connexion CAS de l'université : dès que Bitwarden (ou Helium) a rempli
   l'identifiant et le mot de passe, on clique « Login » à ta place.
   Jamais deux fois de suite : après une erreur, c'est toi qui reprends la main.
   Le mot de passe n'est jamais lu ni gardé par l'extension. */
(() => {
  "use strict";

  const u = document.getElementById("username");
  const p = document.getElementById("password");
  const bouton = document.getElementById("submitBtn");
  if (!u || !p || !bouton) return;

  // Une erreur affichée (mauvais mot de passe, compte bloqué…) : on ne touche à rien
  if (document.querySelector("#loginErrorsPanel, .banner-danger, .alert-danger")) return;

  // Au plus un essai par minute dans cet onglet, pour ne jamais boucler
  const CLE = "fac-auto-cas";
  const dernier = Number(sessionStorage.getItem(CLE) || 0);
  if (Date.now() - dernier < 60e3) return;

  const rempli = (el) => el.value !== "" || el.matches(":autofill");
  let fait = false;

  // On réagit dès que la page bouge (remplissage de Bitwarden compris), avec un
  // petit sondage en filet ; on abandonne au bout de 8 s et on explique.
  // « PDF Moodle Restore » clique aussi : s'il vient de le faire, on le laisse faire.
  const autreVientDeCliquer = () => Date.now() - Number(sessionStorage.getItem("autoLogin") || 0) < 30e3;
  const tenter = () => {
    if (fait || !rempli(u) || !rempli(p)) return;
    fait = true;
    arreter();
    // 60 ms : le temps que Bitwarden finisse son dernier champ (et que l'autre extension passe)
    setTimeout(() => {
      if (autreVientDeCliquer()) return;
      sessionStorage.setItem(CLE, String(Date.now()));
      sessionStorage.setItem("autoLogin", String(Date.now()));
      bouton.click();
    }, 60);
  };
  const obs = new MutationObserver(tenter);
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["value", "class"] });
  document.addEventListener("input", tenter, true);
  document.addEventListener("change", tenter, true);
  const tic = setInterval(tenter, 100);
  const abandon = setTimeout(() => {
    arreter();
    if (!fait) conseil();
  }, 8000);
  function arreter() {
    obs.disconnect();
    clearInterval(tic);
    clearTimeout(abandon);
    document.removeEventListener("input", tenter, true);
    document.removeEventListener("change", tenter, true);
  }
  tenter();

  // Rien n'a rempli la page : on explique une fois par jour comment ne plus rien taper
  function conseil() {
    const jour = new Date().toDateString();
    if (localStorage.getItem("fac-conseil") === jour) return;
    localStorage.setItem("fac-conseil", jour);
    // Le bandeau d'information de la page CAS elle-même, au-dessus du formulaire
    const d = document.createElement("div");
    d.className = "banner banner-info mb-4";
    d.setAttribute("role", "note");
    const texte = document.createElement("p");
    texte.textContent =
      "Connexion automatique : enregistre ce mot de passe dans Bitwarden et active « Remplissage automatique au chargement de la page » " +
      "(Bitwarden → Paramètres → Remplissage automatique). Ensuite, l'extension « Nouvel onglet : mes cours » validera cette page toute seule.";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "mdc-button mdc-button--outline btn btn-outline-secondary";
    ok.textContent = "OK";
    ok.addEventListener("click", () => d.remove());
    d.append(texte, ok);
    const form = u.form || document.getElementById("fm1");
    form.parentNode.insertBefore(d, form);
  }
})();
