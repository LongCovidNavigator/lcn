# LCN map background

The local `assets/lcn-basemap-de.json` is derived from OpenFreeMap Positron:
https://tiles.openfreemap.org/styles/positron
https://openfreemap.org/quick_start/

Changes: single German label expression (`name:de`, `name_de`, local Latin name,
local name), no motorway shields or airport labels, street names from zoom 14,
light blue water. OpenFreeMap/OpenMapTiles/OSM attribution remains visible.
Original upstream style: `positron-original.json`.

Locally hosted runtime: MapLibre GL JS 5.6.2 and
@maplibre/maplibre-gl-leaflet 0.1.0. See the included license files.

`scripts/map_basemap.js` adapts the previous OSM raster factory calls to a
Leaflet vector background layer. Dependencies are loaded once per page, on
first map use. Existing Leaflet markers, popups and viewport controls remain
independent of the background. Removing a map also removes its WebGL layer.
