<p align="center"><img src="docs/banner-nouvel-onglet-cours.png" alt="nouvel-onglet-cours" width="100%"></p>

<p align="center"><img src="https://img.shields.io/badge/browser-Chromium%20·%20Helium-000000?style=flat-square" alt="browser"> <img src="https://img.shields.io/badge/manifest-v3-610089?style=flat-square" alt="manifest"> <img src="https://img.shields.io/badge/license-MIT-610089?style=flat-square" alt="license"></p>

<p align="center"><a href="README.md">🇬🇧 English version</a></p>

**Une page « Nouvel onglet » pour étudiant : tes raccourcis en haut et, d'un coup de molette, tous les cours Moodle du semestre en cartes. Noir OLED, bleu et violet.**

Faite pour la double licence maths-info de l'Université de Montpellier, mais tout est dans un seul fichier, `cours.js` : change la liste des cours et elle est à toi.

<p align="center"><img src="docs/nt-haut.png" width="820" alt="écran des raccourcis"></p>

<p align="center"><img src="docs/nt-cours.png" width="820" alt="écran des cours"></p>

## Fonctionnalités

- **Deux écrans** : les raccourcis, puis *Mes cours*. Molette, flèches du clavier ou glissement sur l'écran tactile pour passer de l'un à l'autre.
- **Une carte par UE**, avec son code sur une petite étiquette et un dessin (algorithme, lambda, terminal, automate, ensembles, matrice, courbe, triangle, intégrale). Un clic : le site charge tout de suite pendant que la carte s'agrandit. Ctrl+clic ou clic molette : nouvel onglet.
- **Date et numéro de semaine** dans la barre du haut.
- La barre d'adresse garde le curseur : tu peux toujours taper une recherche.
- Les icônes viennent du cache local de Chromium, les polices sont incluses (Archivo et Gloock, licence OFL).

## Mode révision

Un raccourci centré sous les huit autres, « Continuer » : un clic ouvre ton site de révisions là où tu t'étais arrêté (son adresse `#/continuer`, comme sur [revisions-s1](https://github.com/glime32/revisions-s1)) dans un groupe d'onglets « Révision », et lance une séance de 4 × 25 min de travail avec 5 min de pause.

- Pendant le travail, les sites de la liste `bloquer` (YouTube, TikTok, Instagram par défaut) affichent « Pas maintenant » et reviennent tout seuls à la pause.
- Le raccourci affiche le temps qui reste ; « Arrêter » apparaît à côté et demande un deuxième clic.
- Sous KDE Plasma, les notifications sont coupées pendant le travail (« Ne pas déranger ») grâce à un petit programme en C, `hote/calme.c`. Pour l'installer : `sh hote/installer.sh`. Sans lui, tout le reste marche.

## Fac : connexion et sessions

Pour l'Université de Montpellier (les adresses sont dans `manifest.json` et `fac-*.js`) :

- **CAS** : mets ton identifiant et ton mot de passe dans `~/.config/fac/identifiants` (droits 600, préparé vide par `sh hote/installer.sh`). Un petit programme en C, `hote/identifiants.c`, ne les donne qu'à la vraie page CAS, qui est remplie et validée tout de suite, ou à la tâche de fond. Sans ce fichier, l'extension attend ton gestionnaire de mots de passe. Jamais après une erreur, au plus une fois par minute.
- **Connexion en arrière-plan** : quand CAS t'a oublié, l'extension refait la connexion sans afficher de page, pour Moodle comme pour Prose. Un refus (mauvais mot de passe, étape en plus) arrête tout essai automatique pendant 24 h, avec une notification.
- **Moodle** : la page de connexion et toute page vue « connecté anonymement » mènent tout droit à CAS (`regles-fac.json`), ce qui évite 3 à 5 s de détour, et un bouton « Tout télécharger » sur chaque cours, qui range ses fichiers dans `Téléchargements/Moodle-S1/<site>` (sans retélécharger ce qui l'a déjà été).
- **Sessions qui tiennent** : toutes les 20 minutes, au démarrage du navigateur et quand tu reviens au PC, si tu as utilisé Moodle ou Prose dans les 12 dernières heures, l'extension garde les sessions en vie en fond (`core_session_touch` de Moodle, sans jamais en créer une nouvelle, donc sans risque pour un test en cours).
- Si tu utilises aussi [pdf-moodle-restore](https://github.com/glime32/pdf-moodle-restore), les deux extensions se partagent le clic sur CAS au lieu de valider deux fois.

## Installation

1. Télécharge ce dépôt (*Code → Download ZIP*) et décompresse-le.
2. Ouvre `chrome://extensions` (ou `helium://extensions`) et active le *Mode développeur*.
3. *Charger l'extension non empaquetée* → choisis le dossier. Ouvre un nouvel onglet et clique *Conserver*.

## La personnaliser

Tout se passe dans `cours.js` :

- un cours Moodle : son `id` (le nombre après `?id=` dans l'adresse du cours), un titre, un nom court et un `dessin` ;
- un autre lien : `url` à la place de `id` ;
- le lien de ton emploi du temps Prose (il est personnel : celui d'ici renvoie à l'accueil) ;
- `revision` : l'adresse de ton site de révisions, la durée des blocs et la liste des sites à mettre en pause ;
- `site` sur un cours : le nom du dossier où « Tout télécharger » range ses fichiers.

Ensuite, ouvre un nouvel onglet. Si rien ne change, bouton ↻ sur la carte de l'extension.
