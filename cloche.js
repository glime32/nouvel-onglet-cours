/* Cloche du bureau : une notification qu'Helium a oubliée ouvre https://cloche.invalid/<site>.
   On passe sur l'onglet déjà ouvert de ce site et on ferme le nouveau ; sans onglet, on ouvre le site à sa place. */
(() => {
  const SITE = /^[a-z0-9.-]+(:[0-9]+)?$/;
  const sansWww = (h) => h.replace(/^www\./, "");

  function hote(url) {
    try {
      return new URL(url).host;
    } catch {
      return "";
    }
  }

  chrome.webNavigation.onBeforeNavigate.addListener(
    async (d) => {
      if (d.frameId !== 0) return;
      const site = new URL(d.url).pathname.slice(1).toLowerCase();
      if (!SITE.test(site)) return;
      const onglets = (await chrome.tabs.query({})).filter((t) => t.id !== d.tabId && sansWww(hote(t.url || t.pendingUrl)) === sansWww(site));
      const t = onglets.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
      if (!t) {
        chrome.tabs.update(d.tabId, { url: "https://" + site + "/" }).catch(() => {});
        return;
      }
      await chrome.tabs.update(t.id, { active: true }).catch(() => {});
      await chrome.windows.update(t.windowId, { focused: true }).catch(() => {});
      chrome.tabs.remove(d.tabId).catch(() => {});
    },
    { url: [{ hostEquals: "cloche.invalid" }] }
  );
})();
