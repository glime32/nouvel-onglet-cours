#!/bin/sh
# Installe l'hôte natif du mode révision (coupe les notifications KDE pendant le travail).
#   sh hote/installer.sh            ID de l'extension calculé depuis son dossier
#   sh hote/installer.sh <id>       si l'ID affiché dans chrome://extensions est différent
set -e
dossier=$(cd "$(dirname "$0")/.." && pwd)
# une extension non empaquetée a pour ID le sha256 de son chemin, chiffres 0-f écrits a-p
id=${1:-$(printf %s "$dossier" | sha256sum | head -c32 | tr '0-9a-f' 'a-p')}

mkdir -p "$HOME/.local/bin"
cc -O2 -Wall -o "$HOME/.local/bin/nouvel-onglet-calme" "$dossier/hote/calme.c"

n=0
for nav in net.imput.helium chromium google-chrome BraveSoftware/Brave-Browser; do
  [ -d "$HOME/.config/$nav" ] || continue
  mkdir -p "$HOME/.config/$nav/NativeMessagingHosts"
  cat > "$HOME/.config/$nav/NativeMessagingHosts/com.glime.revision.json" <<JSON
{
  "name": "com.glime.revision",
  "description": "Mode révision du nouvel onglet : coupe les notifications KDE pendant le travail",
  "path": "$HOME/.local/bin/nouvel-onglet-calme",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$id/"]
}
JSON
  n=$((n + 1))
done
echo "Hôte installé pour l'extension $id ($n navigateur(s)). Recharge l'extension."
