#!/bin/sh
# Übersetzt BRouter und die App-Klasse Routing ohne Android und rechnet Probe-Routen auf den gebauten Routendaten.
# Aufruf: sh karten/routing-probe.sh <ausgabeordner> ["lon,lat;lon,lat;profil" …]   (ohne Strecken: Proben in Oberbayern)
# Braucht Java 17+; vorher sh werkzeuge/brouter-holen.sh.
set -e
cd "$(dirname "$0")/.."
AUS="$1"
shift
T=$(mktemp -d)
mkdir -p "$T/seg" "$T/klassen"
# Routendaten unter den Namen, die BRouter erwartet (wie der Verweis-Ordner der App)
for f in "$AUS"/routing-*.rd5; do
  k=$(basename "$f" | sed -E 's/^routing-([ew])([0-9]+)-([ns])([0-9]+)-.*\.rd5$/\1\2_\3\4/' | tr 'ewns' 'EWNS')
  ln -s "$(cd "$(dirname "$f")" && pwd)/$(basename "$f")" "$T/seg/$k.rd5"
done
ls -la "$T/seg"
[ -f "$T/json.jar" ] || curl -sfL -o "$T/json.jar" https://repo.maven.apache.org/maven2/org/json/json/20240303/json-20240303.jar
find android/brouter/brouter-util/src/main android/brouter/brouter-codec/src/main android/brouter/brouter-expressions/src/main \
  android/brouter/brouter-mapaccess/src/main android/brouter/brouter-core/src/main -name '*.java' > "$T/quellen.txt"
echo android/app/src/main/java/io/github/thomasaurh/gipfelundgasse/Routing.java >> "$T/quellen.txt"
echo karten/RoutingProbe.java >> "$T/quellen.txt"
javac -nowarn -d "$T/klassen" -cp "$T/json.jar" @"$T/quellen.txt"
if [ $# -eq 0 ]; then
  # Penzberg → Herzogstand (Bergwege), Marienplatz → Englischer Garten (Stadt), Murnau → Kochel (Rad)
  set -- "11.3747,47.7535;11.3170,47.6290;hiking-mountain" "11.5755,48.1374;11.5925,48.1590;hiking-mountain" "11.2005,47.6781;11.3784,47.6532;trekking"
fi
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$T/klassen:$T/json.jar" RoutingProbe "$T/seg" android/app/src/main/assets/brouter "$@"
