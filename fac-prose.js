/* Prose « session invalide » : on recharge le planning, qui repasse par CAS
   (connexion automatique) et revient tout seul. */
if (/\/prose-etudiant\/invalidSession/.test(location.pathname)) {
  const CLE = "fac-auto-prose";
  if (Date.now() - Number(sessionStorage.getItem(CLE) || 0) > 30e3) {
    sessionStorage.setItem(CLE, String(Date.now()));
    location.replace("/prose-etudiant/protected/planning");
  }
}
