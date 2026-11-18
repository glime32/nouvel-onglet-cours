/* Prose (lien direct de l'emploi du temps) : la dernière copie de la page s'affiche
   tout de suite par-dessus. Quand la vraie page a fini de se dessiner (texte présent
   et stable), elle prend la place de la copie, une notification le dit, et la copie
   est remplacée par la nouvelle. */
(() => {
  "use strict";
  const CLE = "proseCopie";
  const lien = location.pathname + location.search;
  const debut = Date.now();
  let calque = null;
  let finie = false;

  chrome.storage.local.get(CLE).then(({ [CLE]: copies = {} }) => {
    const c = copies[lien];
    if (!c || finie) return;
    calque = document.createElement("div");
    calque.style.cssText = `position:fixed;inset:0;z-index:2147483647;overflow:hidden;pointer-events:none;background:${c.fond}`;
    calque.innerHTML = c.html;
    document.documentElement.append(calque);
  });

  function garder() {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("script, iframe, noscript, object, embed").forEach((e) => e.remove());
    for (const e of clone.querySelectorAll("*")) {
      for (const a of [...e.attributes]) if (/^on/i.test(a.name)) e.removeAttribute(a.name);
    }
    const fond = getComputedStyle(document.body).backgroundColor;
    chrome.storage.local.get(CLE).then(({ [CLE]: copies = {} }) => {
      copies[lien] = { html: clone.innerHTML, fond, quand: Date.now() };
      // seulement les trois liens les plus récents
      const garde = Object.fromEntries(Object.entries(copies).sort((a, b) => b[1].quand - a[1].quand).slice(0, 3));
      chrome.storage.local.set({ [CLE]: garde });
    });
  }

  let dernier = -1;
  let stable = 0;
  const tic = setInterval(() => {
    const n = document.body ? document.body.innerText.length : 0;
    stable = n > 500 && n === dernier ? stable + 1 : 0;
    dernier = n;
    const prete = stable >= 3;
    if (!prete && Date.now() - debut < 60000) return;
    clearInterval(tic);
    finie = true;
    if (calque) {
      calque.remove();
      if (prete) chrome.runtime.sendMessage({ type: "proseAJour" }).catch(() => {});
    }
    if (prete) garder();
  }, 500);
})();
