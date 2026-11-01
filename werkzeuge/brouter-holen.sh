#!/bin/sh
# Holt die Routen-Engine BRouter (MIT-Lizenz, https://github.com/abrensch/brouter) in einer festen Fassung nach
# android/brouter/ und legt die benutzten Profile samt Lizenz in die App (android/app/src/main/assets/brouter/).
# Beides liegt nicht im Repo; GitHub Actions ruft das Skript vor dem Bau auf. Neue Fassung: FASSUNG ändern.
set -e
cd "$(dirname "$0")/.."
FASSUNG=0b3506c31eb81f67c88affa0460291ccadcb1ec9
ZIEL=android/brouter
if [ ! -f "$ZIEL/.fassung" ] || [ "$(cat "$ZIEL/.fassung")" != "$FASSUNG" ]; then
  rm -rf "$ZIEL"
  mkdir -p "$ZIEL"
  (
    cd "$ZIEL"
    git init -q
    git remote add origin https://github.com/abrensch/brouter
    git fetch -q --depth 1 origin "$FASSUNG"
    git checkout -q FETCH_HEAD
    rm -rf .git
    echo "$FASSUNG" > .fassung
  )
fi
PROFILE=android/app/src/main/assets/brouter
mkdir -p "$PROFILE"
for f in hiking-mountain.brf trekking.brf shortest.brf lookups.dat; do cp "$ZIEL/misc/profiles2/$f" "$PROFILE/"; done
cp "$ZIEL/LICENSE" "$PROFILE/LICENSE-BRouter.txt"
echo "$FASSUNG" > "$PROFILE/fassung.txt"
echo "BRouter $FASSUNG bereit"
