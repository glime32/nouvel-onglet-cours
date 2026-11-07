/* ==========================================================================
   LE SEUL FICHIER À MODIFIER
   --------------------------------------------------------------------------
   - Un cours Moodle : mets juste son id (le nombre après "?id=" dans l'URL).
   - Un autre lien : mets "url" à la place de "id".
   - dessin : algo, lambda, terminal, automate, ensembles, matrice, courbe,
     triangle, integrale, etoile.
   - Emploi du temps : colle le lien de TON emploi du temps Prose (il est personnel).
   Enregistre, puis ouvre un nouvel onglet. C'est tout.
   ========================================================================== */

window.NOUVEL_ONGLET = {
  marque: "L1 · Maths-Info",

  // Écran du haut : les gros raccourcis
  raccourcis: [
    { titre: "Mail", info: "Gmail", url: "https://mail.google.com/mail/u/0/" },
    { titre: "Keep", info: "Notes", url: "https://keep.google.com/" },
    { titre: "YouTube", info: "Historique", url: "https://www.youtube.com/feed/history" },
    { titre: "Gemini", info: "IA", url: "https://gemini.google.com/app" },
    { titre: "Claude", info: "IA", url: "https://claude.ai/" },
    { titre: "Échecs", info: "chess.com", url: "https://chess.com/" },
    { titre: "SoundCloud", info: "Mes likes", url: "https://soundcloud.com/likes" },
    { titre: "Wikipédia", info: "Recherche", url: "https://fr.wikipedia.org/" }
  ],

  // Écran du bas : la fac
  titre: "Mes cours",
  sousTitre: "Semestre 1 · double licence mathématiques-informatique",

  boutons: [
    { kicker: "Université", titre: "ENT", url: "https://ent.umontpellier.fr/" },
    { kicker: "Prose", titre: "Emploi du temps", url: "https://proseconsult.umontpellier.fr/" },
    { kicker: "Moodle", titre: "Tableau de bord", url: "https://moodle.umontpellier.fr/my/" }
  ],

  // Les vrais cours, par couleur : "bleu" ou "violet"
  groupes: [
    {
      nom: "Informatique",
      couleur: "bleu",
      cours: [
        { code: "HAI101I", titre: "Algorithmique 1", court: "Algo", id: 22676, dessin: "algo" },
        { code: "HAI102I", titre: "Programmation fonctionnelle", court: "Prog fonc", id: 21830, dessin: "lambda" },
        { code: "HAI103I", titre: "Systèmes informatiques", court: "USI", id: 22576, dessin: "terminal" },
        { code: "HAI104I", titre: "Jouons aux automates", court: "Automates", id: 23316, dessin: "automate" }
      ]
    },
    {
      nom: "Mathématiques",
      couleur: "violet",
      cours: [
        { code: "HAX101X", titre: "Raisonnement et ensembles", court: "Ensembles", id: 22955, dessin: "ensembles" },
        { code: "HAX102X", titre: "Algèbre linéaire", court: "Matrices", id: 27609, dessin: "matrice" },
        { code: "HAX103X", titre: "Analyse 1", court: "Fonctions, suites", id: 23566, dessin: "courbe" },
        { code: "HAX104X", titre: "Géométrie du plan", court: "Géo", id: 22882, dessin: "triangle" },
        { code: "HAX106X", titre: "Calculus", court: "Dérivées, intégrales", id: 23430, dessin: "integrale" }
      ]
    }
  ],

  // Les "faux cours" (infos, admin), sous l'écrin
  infos: [
    { kicker: "Moodle", titre: "Double-licence", id: 41300 },
    { kicker: "Moodle", titre: "Infos L1 maths", id: 23132 },
    { kicker: "Moodle", titre: "Conf méthodo", id: 48283 },
    { kicker: "Moodle", titre: "Aide Moodle", id: 30697 }
  ]
};
