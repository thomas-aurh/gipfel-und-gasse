#!/bin/sh
# Baut dist/Gipfel-und-Gasse.html: eine einzige Datei mit Leaflet, Gestaltung und App-Code.
set -e
cd "$(dirname "$0")"
mkdir -p dist
JS="00-rechnen.js 10-dienste.js 20-karte.js 30-planen.js 40-profil.js 50-entdecken.js 55-stadt.js 57-drucken.js 60-touren.js 70-unterwegs.js 75-app.js 80-start.js"
{
  printf '<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,%s">\n' "$(base64 -w0 src/symbol.svg)"
  printf '<meta name="theme-color" content="#2f6b3a">\n<title>Gipfel &amp; Gasse – Touren für Berg und Stadt</title>\n'
  printf '<style>\n'; cat vendor/leaflet/leaflet.css; printf '\n</style>\n'
  cat src/head.html
  printf '</head>\n<body>\n'
  # Logo an die Stelle <!--LOGO--> im Gerüst
  sed '/<!--LOGO-->/{
r src/logo.svg
d
}' src/body.html
  # Leaflet mit vollständigem Lizenztext (BSD-2 verlangt ihn bei jeder Weitergabe)
  printf '<script>\n/* Leaflet 1.9.4\n'; tr -d '\r' < vendor/leaflet/LICENSE | sed 's#\*/#* /#g'; printf '*/\n'; cat vendor/leaflet/leaflet.js; printf '\n</script>\n'
  printf '<script id="gug-js">\n(function(){\n"use strict";\n'
  for f in $JS; do printf '// ---- %s ----\n' "$f"; cat "src/$f"; printf '\n'; done
  printf '})();\n</script>\n</body>\n</html>\n'
} > dist/Gipfel-und-Gasse.html
# App-Code allein für die Syntaxprüfung
{ printf '(function(){\n"use strict";\n'; for f in $JS; do cat "src/$f"; printf '\n'; done; printf '})();\n'; } > dist/check.js
wc -c dist/Gipfel-und-Gasse.html
