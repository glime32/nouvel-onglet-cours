/* Page de connexion CAS de l'université : remplie tout de suite avec tes
   identifiants de ~/.config/fac/identifiants (sinon on attend Bitwarden), puis
   « Login » est cliqué à ta place. Jamais deux fois de suite : après une erreur,
   c'est toi qui reprends la main. */
(() => {
  "use strict";

  const u = document.getElementById("username");
  const p = document.getElementById("password");
  const bouton = document.getElementById("submitBtn");
  if (!u || !p || !bouton) return;

  // erreur affichée (mauvais mot de passe, compte bloqué…) : on ne touche à rien
  if (document.querySelector("#loginErrorsPanel, .banner-danger, .alert-danger")) return;

  // au plus un essai par minute dans cet onglet, pour ne jamais boucler
  const CLE = "fac-auto-cas";
  if (Date.now() - Number(sessionStorage.getItem(CLE) || 0) < 60e3) return;

  const rempli = (el) => el.value !== "" || el.matches(":autofill");
  // « PDF Moodle Restore » clique aussi : s'il vient de le faire, on le laisse faire
  const autreVientDeCliquer = () => Date.now() - Number(sessionStorage.getItem("autoLogin") || 0) < 30e3;
  let fait = false;

  const valider = () => {
    // 60 ms : le temps qu'un remplissage finisse (et que l'autre extension passe)
    setTimeout(() => {
      if (autreVientDeCliquer()) return;
      sessionStorage.setItem(CLE, String(Date.now()));
      sessionStorage.setItem("autoLogin", String(Date.now()));
      bouton.click();
    }, 60);
  };

  const ecrire = (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  chrome.runtime.sendMessage({ type: "identifiants" }).then((id) => {
    if (fait) return;
    if (id && id.u && id.p) {
      fait = true;
      arreter();
      ecrire(u, id.u);
      ecrire(p, id.p);
      valider();
    }
  }).catch(() => {});

  // sans fichier d'identifiants : on attend Bitwarden, 8 s au plus
  const tenter = () => {
    if (fait || !rempli(u) || !rempli(p)) return;
    fait = true;
    arreter();
    valider();
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

  // rien n'a rempli la page : on explique, une fois par jour, dans le bandeau d'information de CAS
  function conseil() {
    const jour = new Date().toDateString();
    if (localStorage.getItem("fac-conseil") === jour) return;
    localStorage.setItem("fac-conseil", jour);
    const d = document.createElement("div");
    d.className = "banner banner-info mb-4";
    d.setAttribute("role", "note");
    const texte = document.createElement("p");
    texte.textContent =
      "Connexion automatique : mets ton identifiant et ton mot de passe dans le fichier ~/.config/fac/identifiants " +
      "(droits 600). L'extension « Nouvel onglet : mes cours » remplira et validera cette page toute seule.";
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
