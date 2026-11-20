// Menu de l'icône : trier tout de suite, changer une chaîne de côté, la clé de l'API.
const $ = (id) => document.getElementById(id);
const nombre = (n) => n + (n > 1 ? " chaînes" : " chaîne");

function ligne(id, ch) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chaine";
  b.dataset.id = id;
  b.title = ch.yt ? "Passer dans « Garder »" : "Passer dans « Dans YouTube »";
  b.setAttribute("aria-label", `${ch.nom}, ${ch.yt ? "dans YouTube" : "gardée"}. ${b.title}`);
  const nom = document.createElement("span");
  nom.className = "chaine__nom";
  nom.textContent = ch.nom;
  const etat = document.createElement("span");
  etat.className = "chaine__etat swatch__kicker";
  etat.textContent = ch.yt ? "Dans YouTube" : "Garder";
  b.append(nom, etat);
  b.addEventListener("click", () => chrome.runtime.sendMessage({ type: "ytChoix", c: id, yt: !ch.yt, nom: ch.nom }).catch(() => {}));
  const li = document.createElement("li");
  li.append(b);
  return li;
}

function remplir(liste, compteur, chaines) {
  liste.replaceChildren(...chaines.map(([id, ch]) => ligne(id, ch)));
  compteur.textContent = nombre(chaines.length);
  if (!chaines.length) {
    const vide = document.createElement("li");
    vide.className = "pause__info";
    vide.textContent = "Aucune pour l'instant.";
    liste.append(vide);
  }
}

async function afficher() {
  const { ytChaines = {}, ytCle = "", ytErreur = "" } = await chrome.storage.local.get(["ytChaines", "ytCle", "ytErreur"]);
  // la ligne qui avait le focus le garde après le redessin, dans sa nouvelle section
  const focus = document.activeElement && document.activeElement.dataset.id;
  const recentes = Object.entries(ytChaines).sort(([, a], [, b]) => (b.quand || 0) - (a.quand || 0));
  remplir($("l-yt"), $("n-yt"), recentes.filter(([, ch]) => ch.yt));
  remplir($("l-garder"), $("n-garder"), recentes.filter(([, ch]) => !ch.yt));
  if (focus) document.querySelector(`.chaine[data-id="${CSS.escape(focus)}"]`)?.focus();

  // sans clé, la rubrique de la clé passe en haut
  if (ytCle) $("corps").append($("cle"));
  else $("corps").insertBefore($("cle"), $("trier-liste"));
  if (document.activeElement !== $("cle-champ")) $("cle-champ").value = ytCle;
  const etat = $("cle-etat");
  etat.classList.toggle("is-erreur", !!(ytCle && ytErreur));
  if (!ytCle) etat.textContent = "Sans clé, le tri marche aussi, mais la question ne donne pas la catégorie de la vidéo.";
  else if (ytErreur === "pas de réseau") etat.textContent = "Clé enregistrée, mais pas de réseau pour la vérifier.";
  else if (ytErreur) etat.textContent = `La clé ne marche pas (${ytErreur}). Les questions viennent sans catégorie en attendant.`;
  else etat.textContent = "Clé enregistrée.";
}

$("trier").addEventListener("click", async () => {
  $("trier-etat").textContent = "En cours…";
  const fait = await chrome.runtime.sendMessage({ type: "ytTrier" }).catch(() => false);
  $("trier-etat").textContent = fait ? "Fait" : "Raté, réessaie";
});

$("cle-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cle = $("cle-champ").value.trim();
  $("cle-champ").blur();
  $("cle-etat").textContent = cle ? "Vérification…" : "";
  await chrome.runtime.sendMessage({ type: "ytCle", cle }).catch(() => {});
  afficher();
});

chrome.storage.onChanged.addListener((ch, zone) => {
  if (zone === "local" && (ch.ytChaines || ch.ytCle || ch.ytErreur)) afficher();
});
afficher();
