// Eingang für das Offline-Bündel (esbuild): Vektorkarten aus PMTiles in Leaflet zeichnen.
// Wird von web/build.sh zu dist/offline.js gebündelt und in die HTML-Datei eingebettet.
import { leafletLayer } from 'protomaps-leaflet';
import { PMTiles } from 'pmtiles';
import { namedFlavor } from '@protomaps/basemaps';

window.GugOffline = { leafletLayer, PMTiles, namedFlavor };
