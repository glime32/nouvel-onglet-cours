<p align="center"><img src="docs/banner-nouvel-onglet-cours.png" alt="nouvel-onglet-cours" width="100%"></p>

<p align="center"><img src="https://img.shields.io/badge/browser-Chromium%20·%20Helium-000000?style=flat-square" alt="browser"> <img src="https://img.shields.io/badge/manifest-v3-610089?style=flat-square" alt="manifest"> <img src="https://img.shields.io/badge/license-MIT-610089?style=flat-square" alt="license"></p>

<p align="center"><a href="README.fr.md">🇫🇷 Version française</a></p>

**A new-tab page for students: your shortcuts on top, and one scroll down, every Moodle course of the semester as a card. OLED black, blue and purple.**

Made for the maths & computer science double degree at the University of Montpellier, but everything lives in one file, `cours.js`: change the course list and it's yours.

<p align="center"><img src="docs/nt-haut.png" width="820" alt="shortcuts screen"></p>

<p align="center"><img src="docs/nt-cours.png" width="820" alt="courses screen"></p>

## Features

- **Two screens**: shortcuts, then *Mes cours*. Mouse wheel, arrow keys or a swipe on a touchscreen slide between them.
- **One card per course**, with its code on a little tag and a drawing (algorithm, lambda, terminal, automaton, sets, matrix, curve, triangle, integral). Click: the site loads right away while the card grows. Ctrl+click or middle-click opens a new tab.
- **Date and week number** in the top bar.
- The address bar keeps the focus: you can still type a search.
- No background script, no network request: icons come from Chromium's local favicon cache, fonts are bundled (Archivo and Gloock, OFL).

## Install

1. Download this repo (*Code → Download ZIP*) and unzip it.
2. Open `chrome://extensions` (or `helium://extensions`) and turn on *Developer mode*.
3. *Load unpacked* → pick the folder. Open a new tab and choose *Keep it*.

## Make it yours

Edit `cours.js` only:

- a Moodle course: its `id` (the number after `?id=` in the course URL), a title, a short name and a `dessin`;
- any other link: `url` instead of `id`;
- your Prose timetable link (it is personal, so the one here points to the home page).

Then open a new tab. If nothing changes, press ↻ on the extension card.
