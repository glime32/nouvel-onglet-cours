/* Moteur du nouvel onglet : pas besoin d'y toucher. Tout se règle dans cours.js. */
(() => {
  "use strict";

  const C = window.NOUVEL_ONGLET;
  const MOODLE = "https://moodle.umontpellier.fr/course/view.php?id=";
  const DESSINS = new Set(["algo", "lambda", "terminal", "automate", "ensembles", "matrice", "courbe", "triangle", "integrale", "etoile"]);
  const SVG = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);

  if (!C) {
    document.body.textContent = "cours.js est introuvable ou contient une erreur (touche F12, onglet Console).";
    return;
  }

  const urlOf = (x) => x.url || MOODLE + x.id;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function icon(id, cls) {
    const s = document.createElementNS(SVG, "svg");
    s.setAttribute("class", cls || "ico");
    s.setAttribute("aria-hidden", "true");
    const u = document.createElementNS(SVG, "use");
    u.setAttribute("href", "#" + id);
    s.appendChild(u);
    return s;
  }

  // Dessin technique : 3 copies (bleu, violet, trait clair) qui se rejoignent au survol
  function art(name) {
    const id = "d-" + (DESSINS.has(name) ? name : "etoile");
    const s = document.createElementNS(SVG, "svg");
    s.setAttribute("class", "art");
    s.setAttribute("viewBox", "0 0 120 64");
    s.setAttribute("aria-hidden", "true");
    for (const k of ["art__a", "art__b", "art__c"]) {
      const u = document.createElementNS(SVG, "use");
      u.setAttribute("href", "#" + id);
      u.setAttribute("class", k);
      s.appendChild(u);
    }
    return s;
  }

  // Icône du site (API favicon de Chromium, locale), sinon une initiale
  const canFav = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
  const favBase = canFav ? chrome.runtime.getURL("/_favicon/") : "";
  function favicon(titre, url) {
    const letter = el("span", "fav__letter", titre.trim().charAt(0).toUpperCase());
    if (!canFav) return letter;
    const img = new Image(36, 36);
    img.alt = "";
    img.decoding = "async";
    img.className = "fav";
    img.src = favBase + "?pageUrl=" + encodeURIComponent(url) + "&size=64";
    img.addEventListener("error", () => img.replaceWith(letter), { once: true });
    return img;
  }

  // Bouton « nuancier » du portfolio : carré + barre. Sans lien, c'est un vrai bouton.
  function swatch(item, color, tileContent, cls, i, onClick) {
    const li = el("li");
    const a = el(onClick ? "button" : "a", "swatch swatch--" + color + (cls ? " " + cls : ""));
    if (onClick) {
      a.type = "button";
      a.addEventListener("click", onClick);
    } else {
      a.href = urlOf(item);
    }
    a.style.setProperty("--i", i);
    const tile = el("span", "swatch__tile");
    tile.setAttribute("aria-hidden", "true");
    tile.append(tileContent);
    const bar = el("span", "swatch__bar");
    if (item.kicker || item.info) bar.append(el("span", "swatch__kicker", item.kicker || item.info));
    bar.append(el("span", "swatch__name", item.titre), icon("i-arrow", "ico swatch__arrow"));
    a.append(tile, bar);
    li.append(a);
    return li;
  }

  function fill(id, frag) { $(id).append(frag); }

  /* ---------- Barre du haut ---------- */
  $("brand-name").textContent = C.marque || "";
  const now = new Date();
  const jour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(now);
  const t = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const semaine = Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  $("today").append(el("span", "today__day", jour), el("span", "today__week", "Semaine " + semaine));

  /* ---------- Écran 1 : raccourcis ---------- */
  let f = document.createDocumentFragment();
  (C.raccourcis || []).forEach((r, i) => {
    const row = Math.floor(i / 4);
    const color = (i + row) % 2 ? "violet" : "bleu";
    f.append(swatch(r, color, favicon(r.titre, urlOf(r)), "swatch--big", i));
  });
  fill("raccourcis", f);

  /* ---------- Écran 1 : le raccourci « Mode révision », centré sous les autres ----------
     Un clic : la suite du site de révisions (son bouton Continuer) et la séance démarre.
     Pendant la séance : le temps qui reste, et « Arrêter » à côté. La séance tourne dans seance.js. */
  const R = C.revision;
  if (R && canFav) {
    const nom = (d) => ({ "youtube.com": "YouTube", "tiktok.com": "TikTok", "instagram.com": "Insta" }[d] || d);
    const sites = [...new Set((R.bloquer || []).map(nom))];
    const enPause = sites.length ? sites.slice(0, -1).join(", ") + (sites.length > 1 ? " et " : "") + sites.at(-1) : "";
    const mmss = (ms) => {
      const s = Math.max(0, Math.round(ms / 1000));
      return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    };
    const ul = $("revision");
    const nbRaccourcis = (C.raccourcis || []).length;
    let seance = null;
    let tic = 0;
    let sur = 0;

    const etiquette = () =>
      seance ? `${seance.phase === "travail" ? "Travail" : "Pause"} · ${mmss(seance.fin - Date.now())}` : "Mode révision";

    function compte() {
      const k = ul.querySelector(".swatch__kicker");
      if (k) k.textContent = etiquette();
    }

    // Deux clics pour arrêter : court, pour ne jamais être coupé par « … »
    function arreter(e) {
      const nm = e.currentTarget.querySelector(".swatch__name");
      const kick = e.currentTarget.querySelector(".swatch__kicker");
      if (Date.now() > sur) {
        sur = Date.now() + 4000;
        const avant = kick.textContent;
        nm.textContent = "Sûr ?";
        kick.textContent = "Clique encore";
        setTimeout(() => {
          if (Date.now() >= sur) {
            nm.textContent = "Arrêter";
            kick.textContent = avant;
          }
        }, 4100);
        return;
      }
      chrome.runtime.sendMessage({ type: "arreter" });
    }

    function montrer() {
      clearInterval(tic);
      const f = document.createDocumentFragment();
      const li = swatch({ kicker: etiquette(), titre: "Continuer" }, "violet", icon("i-star"), "swatch--big", nbRaccourcis, () =>
        chrome.runtime.sendMessage({ type: seance ? "rouvrir" : "commencer" })
      );
      li.firstChild.title = seance
        ? "Revenir à la séance"
        : `Ouvre la suite de tes révisions. ${R.travail || 25} min de travail, ${R.pause || 5} min de pause, ${R.blocs || 4} fois.` +
          (enPause ? ` ${enPause} en pause pendant le travail, notifications coupées.` : "");
      f.append(li);
      if (seance) {
        f.append(swatch({ kicker: `Bloc ${seance.bloc} sur ${seance.blocs}`, titre: "Arrêter" }, "bleu", icon("i-star"), "swatch--big", nbRaccourcis + 1, arreter));
      }
      ul.classList.toggle("is-deux", !!seance);
      ul.replaceChildren(f);
      ul.hidden = false;
      if (seance && !document.hidden) tic = setInterval(compte, 1000);
    }

    // Onglet caché : plus aucun réveil ; il se remet à l'heure en revenant
    document.addEventListener("visibilitychange", () => {
      clearInterval(tic);
      if (seance && !document.hidden) { compte(); tic = setInterval(compte, 1000); }
    });

    chrome.storage.local.get("seance").then(({ seance: s }) => { seance = s || null; montrer(); });
    chrome.storage.onChanged.addListener((ch, zone) => {
      if (zone === "local" && ch.seance) { seance = ch.seance.newValue || null; montrer(); }
    });
  }

  /* ---------- Écran 2 : en-tête ---------- */
  $("titre").textContent = C.titre || "Mes cours";
  $("sous-titre").textContent = C.sousTitre || "";
  f = document.createDocumentFragment();
  (C.boutons || []).forEach((b, i) => f.append(swatch(b, i % 2 ? "violet" : "bleu", icon("i-star"), "", i)));
  let n = (C.boutons || []).length;
  fill("boutons", f);

  /* ---------- Écran 2 : l'écrin ---------- */
  f = document.createDocumentFragment();
  (C.groupes || []).forEach((g, gi) => {
    const sec = el("section", "group group--" + (g.couleur === "violet" ? "violet" : "bleu"));
    const hid = "g-" + gi;
    sec.setAttribute("aria-labelledby", hid);
    sec.style.setProperty("--n", String(Math.max(1, g.cours.length)));

    const head = el("div", "group__head");
    const ht = el("span", "group__tile");
    ht.setAttribute("aria-hidden", "true");
    ht.append(icon("i-star"));
    const h3 = el("h3", "group__name", g.nom);
    h3.id = hid;
    head.append(ht, h3, el("span", "group__count", g.cours.length + " UE"));

    const ul = el("ul", "group__grid");
    g.cours.forEach((c) => {
      const li = el("li", "slot");
      const a = el("a", "piece");
      a.href = urlOf(c);
      a.style.setProperty("--i", n++);
      const spark = el("span", "piece__spark");
      spark.setAttribute("aria-hidden", "true");
      spark.append(icon("i-star8", "s8"));
      const paper = el("span", "piece__paper");
      paper.append(art(c.dessin));
      const text = el("span", "piece__text");
      text.append(el("span", "piece__title", c.titre));
      if (c.court) text.append(el("span", "piece__meta", c.court));
      a.append(el("span", "tag", c.code || ""), spark, paper, text);
      li.append(a);
      ul.append(li);
    });
    sec.append(head, ul);
    f.append(sec);
  });
  fill("groupes", f);

  /* ---------- Écran 2 : infos & admin ---------- */
  f = document.createDocumentFragment();
  (C.infos || []).forEach((x, i) => f.append(swatch(x, i % 2 ? "violet" : "bleu", icon("i-star"), "swatch--small", n++)));
  fill("infos", f);

  /* ==========================================================================
     Animations. Installées juste après le premier affichage (0 ms ajoutée
     au chargement), et rien ne tourne tant qu'il n'y a pas de geste.
     ========================================================================== */
  requestAnimationFrame(() => setTimeout(initAnimations, 0));

  function initAnimations() {
    const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scr = { top: $("ecran-raccourcis"), cours: $("cours") };
    const wipe = $("wipe");
    const bands = Array.from(wipe.children);
    let state = "top";
    let busy = false;
    let cool = 0;
    let lastScroll = 0;
    let acc = 0;
    let accT = 0;

    /* ---------- Passer d'un écran à l'autre : le volet du portfolio ---------- */
    function show(next) {
      scr.top.hidden = next !== "top";
      scr.cours.hidden = next !== "cours";
      window.scrollTo(0, 0);
      state = next;
      const s = scr[next];
      if (!REDUCED) {
        s.classList.remove("is-enter");
        void s.offsetWidth;
        s.classList.add("is-enter");
        setTimeout(() => s.classList.remove("is-enter"), 1100);
      }
      const h = s.querySelector("h2");
      if (h) h.focus({ preventScroll: true });
    }

    function go(next) {
      if (busy || next === state) return;
      if (REDUCED) { show(next); cool = performance.now() + 300; return; }
      busy = true;
      wipe.dataset.to = next;
      wipe.classList.toggle("is-rev", next === "top");
      bands.forEach((b) => b.style.setProperty("--d", Math.floor(Math.random() * 50) + "ms"));
      wipe.classList.remove("is-out");
      void wipe.offsetWidth;
      wipe.classList.add("is-in");
      setTimeout(() => {
        show(next);
        wipe.classList.remove("is-in");
        void wipe.offsetWidth;
        wipe.classList.add("is-out");
        setTimeout(() => {
          wipe.classList.remove("is-out");
          busy = false;
          cool = performance.now() + 250;
        }, 400);
      }, 260);
    }

    // Au bord de l'écran (en haut ou en bas), et pas en plein défilement
    const atEdge = (dir) => dir > 0
      ? innerHeight + scrollY >= document.documentElement.scrollHeight - 2
      : scrollY <= 0;
    const wanted = () => (state === "top" ? 1 : -1);
    const other = () => (state === "top" ? "cours" : "top");

    addEventListener("scroll", () => { lastScroll = performance.now(); }, { passive: true });

    addEventListener("wheel", (e) => {
      if (e.ctrlKey || busy) return;
      const now = performance.now();
      const dir = Math.sign(e.deltaY);
      if (now < cool || dir !== wanted() || !atEdge(dir) || now - lastScroll < 200) { acc = 0; return; }
      if (now - accT > 250) acc = 0;
      accT = now;
      acc += Math.abs(e.deltaMode ? e.deltaY * 40 : e.deltaY);
      if (acc > 40) { acc = 0; go(other()); }
    }, { passive: true });

    // Écran tactile : glisser vers le haut ou vers le bas
    let touch = null;
    addEventListener("touchstart", (e) => {
      touch = e.touches.length === 1 ? { y: e.touches[0].clientY, edge: atEdge(wanted()) } : null;
    }, { passive: true });
    addEventListener("touchend", (e) => {
      if (!touch || busy) return;
      const dy = touch.y - e.changedTouches[0].clientY;
      const ok = touch.edge && Math.abs(dy) > 60 && Math.sign(dy) === wanted();
      touch = null;
      if (ok) go(other());
    }, { passive: true });

    addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeZoom(); return; }
      if (e.altKey || e.ctrlKey || e.metaKey || busy) return;
      const k = e.key;
      const down = k === "ArrowDown" || k === "PageDown" || k === "End" || (k === " " && !e.shiftKey);
      const up = k === "ArrowUp" || k === "PageUp" || k === "Home" || (k === " " && e.shiftKey);
      if ((state === "top" && down && atEdge(1)) || (state === "cours" && up && atEdge(-1))) {
        e.preventDefault();
        go(other());
      }
    });

    document.querySelectorAll("[data-go]").forEach((a) => {
      a.addEventListener("click", (e) => { e.preventDefault(); go(a.dataset.go); });
    });

    /* ---------- Ouvrir un lien : la carte s'agrandit jusqu'à l'écran ---------- */
    let zoom = null;
    function closeZoom() {
      if (zoom) { zoom.remove(); zoom = null; }
    }
    function openZoom(a) {
      closeZoom();
      const r = a.getBoundingClientRect();
      const cs = getComputedStyle(a);
      const z = el("div", "zoom");
      z.setAttribute("aria-hidden", "true");
      z.style.setProperty("--c", cs.getPropertyValue("--c").trim() || "#D980FF");
      z.style.setProperty("--c-deep", cs.getPropertyValue("--c-deep").trim() || "#610089");
      const inner = el("div", "zoom__inner");
      const ic = a.querySelector(".fav, .fav__letter, .art, .swatch__tile .ico");
      if (ic) {
        const k = ic.cloneNode(true);
        k.classList.add("zoom__icon");
        inner.append(k);
      }
      const name = a.querySelector(".swatch__name, .piece__title");
      inner.append(el("p", "zoom__title", name ? name.textContent : ""), el("p", "zoom__kicker", "Ouverture"));
      z.append(inner);
      z.addEventListener("click", closeZoom);
      document.body.append(z);
      zoom = z;
      const W = innerWidth;
      const H = innerHeight;
      const from = "inset(" + r.top + "px " + (W - r.right) + "px " + (H - r.bottom) + "px " + r.left + "px round 20px)";
      z.animate([{ clipPath: from }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }],
        { duration: 520, easing: "cubic-bezier(.45,.05,.2,1)", fill: "both" });
      inner.animate([{ opacity: 0, transform: "translateY(16px) scale(.94)" }, { opacity: 1, transform: "none" }],
        { duration: 320, delay: 220, easing: "cubic-bezier(.2,.9,.25,1)", fill: "both" });
    }

    document.addEventListener("click", (e) => {
      if (REDUCED || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest("a.swatch, a.piece");
      if (!a || !a.href.startsWith("http")) return;
      // Le site commence à charger tout de suite (pas de preventDefault) :
      // l'animation est dessinée à l'image suivante, pendant le chargement.
      requestAnimationFrame(() => openZoom(a));
    });

    // Retour arrière (cache du navigateur) ou chargement annulé : on referme
    addEventListener("pageshow", (e) => { if (e.persisted) closeZoom(); });
    if (window.navigation) navigation.addEventListener("navigateerror", closeZoom);

    /* ---------- Gagner du temps : ouvrir la connexion dès le survol ---------- */
    const warm = new Set();
    function preconnect(e) {
      const a = e.target.closest && e.target.closest("a[href^='http']");
      if (!a) return;
      const o = new URL(a.href).origin;
      if (warm.has(o)) return;
      warm.add(o);
      const l = document.createElement("link");
      l.rel = "preconnect";
      l.href = o;
      document.head.append(l);
    }
    document.addEventListener("pointerover", preconnect, { passive: true });
    document.addEventListener("focusin", preconnect);
  }
})();
