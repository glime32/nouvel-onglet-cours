// Onglet YouTube ouvert en arrière-plan : rien ne se charge avant qu'on l'ouvre.
const video = decodeURIComponent(location.hash.slice(1));

if (/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(video)) {
  const ouvrir = async () => {
    if (document.visibilityState !== "visible") return;
    const t = await chrome.tabs.getCurrent();
    if (t && t.active) location.replace(video);
  };
  document.addEventListener("visibilitychange", ouvrir);
  ouvrir();
  chrome.runtime.sendMessage({ type: "ytTitre", url: video }).then((titre) => {
    if (titre) document.title = titre;
  });
}
