/* ==========================================================================
   LE SEUL FICHIER À MODIFIER
   --------------------------------------------------------------------------
   - Un cours Moodle : mets juste son id (le nombre après "?id=" dans l'URL).
   - Un autre lien : mets "url" à la place de "id".
   - dessin : algo, lambda, terminal, automate, ensembles, matrice, courbe,
     triangle, integrale, etoile.
   - Emploi du temps : colle le lien de TON emploi du temps Prose (il est personnel).
   - site : nom court de la matière (geo, algo, pf…) : c'est le dossier où
     « Tout télécharger » range ses fichiers (Téléchargements/Moodle-S1/<site>).
   Enregistre, puis ouvre un nouvel onglet. C'est tout.
   (Le mode révision relit ce fichier au redémarrage d'Helium, ou avec le
   bouton ↻ de l'extension dans helium://extensions.)
   ========================================================================== */

self.NOUVEL_ONGLET = {
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

  // Mode révision (raccourci centré sous les autres) : un clic ouvre la suite de
  // ton site de révisions (son bouton Continuer) et lance la séance
  revision: {
    // ton site de révisions : une adresse web ou un fichier (file:///…)
    site: "https://glime32.github.io/revisions-s1/",
    travail: 25,  // minutes de travail par bloc
    pause: 5,     // minutes de pause entre deux blocs
    blocs: 4,     // blocs par séance (4 × 25 min ≈ 1 h 55 avec les pauses)
    // Sites en pause pendant le travail (les sous-domaines comptent aussi)
    bloquer: ["youtube.com", "tiktok.com", "instagram.com"]
  },

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
        { code: "HAI101I", titre: "Algorithmique 1", court: "Algo", id: 22676, dessin: "algo", site: "algo" },
        { code: "HAI102I", titre: "Programmation fonctionnelle", court: "Prog fonc", id: 21830, dessin: "lambda", site: "pf" },
        { code: "HAI103I", titre: "Systèmes informatiques", court: "USI", id: 22576, dessin: "terminal", site: "usi" },
        { code: "HAI104I", titre: "Jouons aux automates", court: "Automates", id: 23316, dessin: "automate" }
      ]
    },
    {
      nom: "Mathématiques",
      couleur: "violet",
      cours: [
        { code: "HAX101X", titre: "Raisonnement et ensembles", court: "Ensembles", id: 22955, dessin: "ensembles", site: "rai" },
        { code: "HAX102X", titre: "Algèbre linéaire", court: "Matrices", id: 27609, dessin: "matrice", site: "lin" },
        { code: "HAX103X", titre: "Analyse 1", court: "Fonctions, suites", id: 23566, dessin: "courbe", site: "ana" },
        { code: "HAX104X", titre: "Géométrie du plan", court: "Géo", id: 22882, dessin: "triangle", site: "geo" },
        { code: "HAX106X", titre: "Calculus", court: "Dérivées, intégrales", id: 23430, dessin: "integrale", site: "calc" }
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
