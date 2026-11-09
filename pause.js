/* Page affichée à la place d'un site en pause pendant un bloc de travail.
   Dès que le bloc se termine (ou que la séance s'arrête), le site revient. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let cible = "";
  try {
    cible = decodeURIComponent(location.hash.slice(1));
  } catch {}
  const site = (() => {
    try {
      return new URL(cible).hostname.replace(/^www\./, "");
    } catch {
      return "Ce site";
    }
  })();

  let seance = null;
  let tic = 0;

  const mmss = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };

  function revenir() {
    clearInterval(tic);
    if (/^https?:/.test(cible)) location.replace(cible);
    else $("p-info").textContent = "La séance est finie, tu peux fermer cet onglet.";
  }

  function afficher() {
    if (!seance || seance.phase !== "travail" || Date.now() >= seance.fin) return revenir();
    $("pause").className = "zoom pause swatch--" + (seance.couleur === "bleu" ? "bleu" : "violet");
    $("p-bloc").textContent = `Bloc ${seance.bloc} sur ${seance.blocs} · ${seance.titre}`;
    $("p-info").textContent = `${site} revient dans ${mmss(seance.fin - Date.now())}, à la pause.`;
  }

  chrome.storage.local.get("seance").then(({ seance: s }) => {
    seance = s || null;
    afficher();
    if (!document.hidden) tic = setInterval(afficher, 1000);
  });
  // Onglet caché : on arrête le compte à rebours (le retour du site est géré par la séance)
  document.addEventListener("visibilitychange", () => {
    clearInterval(tic);
    if (!document.hidden) {
      afficher();
      tic = setInterval(afficher, 1000);
    }
  });
  chrome.storage.onChanged.addListener((ch, zone) => {
    if (zone !== "local" || !ch.seance) return;
    seance = ch.seance.newValue || null;
    afficher();
  });

  $("p-retour").addEventListener("click", () => chrome.runtime.sendMessage({ type: "rouvrir", garder: true }));
})();
