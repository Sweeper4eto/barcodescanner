/**
 * Admin minimart locator basemap.
 * Carto dark tiles fit the app chrome and avoid a blank/black OSM pane when
 * Leaflet CSS fails to paint light tiles cleanly on dark UI.
 */
export const MINIMART_MAP_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export const MINIMART_MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const MINIMART_MAP_MAX_ZOOM = 19;
