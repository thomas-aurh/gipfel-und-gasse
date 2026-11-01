#!/bin/sh
# Prüfung für die GitHub-Prüfung und von Hand: baut Gipfel & Gasse, prüft die Syntax und rechnet die Einheitstests.
set -e
cd "$(dirname "$0")"
sh build.sh
node --check dist/check.js
node test/syntax.js dist/Gipfel-und-Gasse.html
node test/einheit.js
echo "Gipfel & Gasse: Prüfung bestanden"
