#!/bin/sh
# Installe les deux hôtes natifs : le mode révision (coupe les notifications KDE
# pendant le travail) et les identifiants de la fac (~/.config/fac/identifiants).
#   sh hote/installer.sh            ID de l'extension calculé depuis son dossier
#   sh hote/installer.sh <id>       si l'ID affiché dans chrome://extensions est différent
set -e
dossier=$(cd "$(dirname "$0")/.." && pwd)
# une extension non empaquetée a pour ID le sha256 de son chemin, chiffres 0-f écrits a-p
id=${1:-$(printf %s "$dossier" | sha256sum | head -c32 | tr '0-9a-f' 'a-p')}

mkdir -p "$HOME/.local/bin"
cc -O2 -Wall -o "$HOME/.local/bin/nouvel-onglet-calme" "$dossier/hote/calme.c"
cc -O2 -Wall -o "$HOME/.local/bin/fac-identifiants" "$dossier/hote/identifiants.c"

# fichier d'identifiants vide, lisible par toi seul ; jamais écrasé s'il existe
mkdir -p "$HOME/.config/fac"
chmod 700 "$HOME/.config/fac"
if [ ! -e "$HOME/.config/fac/identifiants" ]; then
  (umask 077; printf 'identifiant=\nmot_de_passe=\n' > "$HOME/.config/fac/identifiants")
fi

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
  cat > "$HOME/.config/$nav/NativeMessagingHosts/com.glime.fac.json" <<JSON
{
  "name": "com.glime.fac",
  "description": "Nouvel onglet : identifiants CAS de la fac (lus dans ~/.config/fac/identifiants)",
  "path": "$HOME/.local/bin/fac-identifiants",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$id/"]
}
JSON
  n=$((n + 1))
done
echo "Hôtes installés pour l'extension $id ($n navigateur(s)). Recharge l'extension."
echo "Identifiants de la fac : remplis ~/.config/fac/identifiants (droits 600)."
