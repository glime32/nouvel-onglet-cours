/* Encadré « Nouvelle chaîne » : mis dans la page ouverte par youtube-fond.js
   quand une vidéo vient d'une chaîne pas encore rangée. Une question à la fois. */
(() => {
  if (window.__triYoutube) return window.__triYoutube();

  const SVG = "http://www.w3.org/2000/svg";
  const CATEGORIES = {
    1: "Film et animation", 2: "Auto", 10: "Musique", 15: "Animaux", 17: "Sport", 19: "Voyages",
    20: "Jeux vidéo", 22: "Vlogs", 23: "Humour", 24: "Divertissement", 25: "Actualités",
    26: "Vie pratique", 27: "Éducation", 28: "Science et techno", 29: "Associations"
  };

  let hote = null;
  let racine = null;
  let pret = null;

  function el(tag, attrs = {}, ...enfants) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.append(...enfants);
    return e;
  }

  function icone(d, trait, classe = "ico") {
    const s = document.createElementNS(SVG, "svg");
    s.setAttribute("class", classe);
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    const p = document.createElementNS(SVG, "path");
    p.setAttribute("d", d);
    if (trait) {
      for (const [k, v] of Object.entries({ fill: "none", stroke: "currentColor", "stroke-width": "2.6", "stroke-linecap": "round", "stroke-linejoin": "round" })) p.setAttribute(k, v);
    } else p.setAttribute("fill", "currentColor");
    s.append(p);
    return s;
  }
  const etoile = () => icone("M12 0c.75 6.6 5.4 11.25 12 12-6.6.75-11.25 5.4-12 12-.75-6.6-5.4-11.25-12-12C6.6 11.25 11.25 6.6 12 0z");
  const fleche = () => icone("M7 17 17 7M9 7h8v8", true, "ico swatch__arrow");
  const croix = () => icone("M6 6l12 12M18 6 6 18", true);

  function bouton(couleur, kicker, nom, yt, q) {
    const b = el("button", { type: "button", class: "swatch swatch--" + couleur },
      el("span", { class: "swatch__tile", "aria-hidden": "true" }, etoile()),
      el("span", { class: "swatch__bar" }, el("span", { class: "swatch__kicker" }, kicker), el("span", { class: "swatch__name" }, nom), fleche()));
    b.addEventListener("click", (e) => {
      if (e.isTrusted) envoyer({ type: "ytChoix", c: q.c, yt, nom: q.nom });
    });
    return b;
  }

  // Les polices et le style viennent du service worker : rien de visible pour la page
  async function preparer() {
    const r = await chrome.runtime.sendMessage({ type: "ytStyles" });
    if (!r) throw new Error("styles");
    const feuilles = r.css.map((texte) => {
      const f = new CSSStyleSheet();
      // les rem suivraient la taille de texte de la page : ramenés à 16 px
      f.replaceSync(texte.replace(/@font-face\s*\{[^}]*\}/g, "").replace(/(\d*\.?\d+)rem\b/g, (_, n) => n * 16 + "px"));
      return f;
    });
    const deja = new Set([...document.fonts].map((f) => f.family.replace(/"/g, "")));
    for (const p of r.polices) {
      if (deja.has(p.famille)) continue;
      const octets = Uint8Array.from(atob(p.donnees), (c) => c.charCodeAt(0));
      const f = new FontFace(p.famille, octets.buffer, p.options);
      document.fonts.add(f);
      f.load().catch(() => {});
    }
    return feuilles;
  }

  const court = (t) => (t.length > 60 ? t.slice(0, 58).trimEnd() + "…" : t);

  function fermer() {
    if (hote) hote.remove();
    hote = racine = null;
  }

  // boutons coupés le temps que le tri se fasse : pas de double clic
  async function envoyer(message) {
    const boite = racine && racine.querySelector(".yt");
    if (boite) {
      boite.inert = true;
      boite.setAttribute("aria-busy", "true");
    }
    await chrome.runtime.sendMessage(message).catch(() => {});
    rafraichir();
  }

  function dessiner(q, feuilles) {
    const neuf = !hote;
    if (neuf) {
      hote = document.createElement("tri-youtube-glime");
      racine = hote.attachShadow({ mode: "closed" });
      racine.adoptedStyleSheets = feuilles;
      document.documentElement.append(hote);
    }
    hote.style.cssText = `all: initial !important; position: fixed !important; top: 16px !important; right: 16px !important;
      z-index: 2147483647 !important; width: min(360px, calc(100vw - 32px)) !important;`;

    const rang = q.total > 1 ? ` · ${q.rang} sur ${q.total}` : "";
    const categorie = CATEGORIES[q.cat];
    const fermeture = el("button", { type: "button", class: "yt__fermer", "aria-label": "Fermer (la question reviendra)" }, croix());
    fermeture.addEventListener("click", (e) => {
      if (e.isTrusted) envoyer({ type: "ytFermer" });
    });
    const boite = el("div", { class: "yt swatch--violet" + (neuf ? " is-entree" : ""), role: "dialog", "aria-labelledby": "yt-kicker yt-nom" },
      fermeture,
      el("p", { class: "zoom__kicker", id: "yt-kicker" }, "Nouvelle chaîne" + rang),
      el("p", { class: "yt__nom", id: "yt-nom" }, q.nom),
      el("p", { class: "pause__info yt__info" }, court(q.titre) + (categorie ? " · " + categorie : "")),
      el("ul", { class: "yt__btns" },
        el("li", {}, bouton("violet", "À voir plus tard", "Dans YouTube", true, q)),
        el("li", {}, bouton("bleu", "Cours ou musique", "Garder", false, q))));
    boite.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && e.isTrusted) envoyer({ type: "ytFermer" });
    });
    racine.replaceChildren(boite);
  }

  async function rafraichir() {
    const q = await chrome.runtime.sendMessage({ type: "ytQuestion" }).catch(() => null);
    if (!q) return fermer();
    pret = pret || preparer();
    let feuilles;
    try {
      feuilles = await pret;
    } catch {
      pret = null;
      return;
    }
    dessiner(q, feuilles);
  }

  window.__triYoutube = rafraichir;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && hote) rafraichir();
  });
  rafraichir();
})();
