// Eingang für das Offline-Bündel (esbuild): Vektorkarten aus PMTiles in Leaflet zeichnen, dazu Capacitor.
// Wird von web/build.sh zu dist/offline.js gebündelt und in die HTML-Datei eingebettet.
// @capacitor/core ergänzt die native Brücke der Android-App um registerPlugin; die Brücke allein kennt nur
// isNativePlatform, ohne core bricht die App beim Anmelden der eigenen Plugins ab. Im Browser bleibt es „web“.
import { Capacitor } from '@capacitor/core';
import { leafletLayer } from 'protomaps-leaflet';
import { PMTiles } from 'pmtiles';
import { namedFlavor } from '@protomaps/basemaps';

window.GugOffline = { leafletLayer, PMTiles, namedFlavor };
window.GugCapacitor = Capacitor;
