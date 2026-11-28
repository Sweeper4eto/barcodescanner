/**
 * Admin minimart locator basemap.
 *
 * CARTO dark tiles fit the app chrome, but since Sep 2026 they require
 * `?key=` or every tile is an "API KEY REQUIRED" watermark.
 * Set NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY (free from carto.com/basemaps/apikey)
 * to keep CARTO Dark Matter. Without a key we use Esri dark-gray (no key).
 */

const CARTO_KEY = (
  process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY ?? ""
).trim();

const CARTO_DARK_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

/** Esri Canvas World Dark Gray. No API key; {z}/{y}/{x} order. */
const ESRI_DARK_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";

export const MINIMART_MAP_TILE_URL = CARTO_KEY
  ? `${CARTO_DARK_URL}?key=${encodeURIComponent(CARTO_KEY)}`
  : ESRI_DARK_URL;

export const MINIMART_MAP_TILE_ATTRIBUTION = CARTO_KEY
  ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  : "Tiles &copy; Esri | Esri, HERE, Garmin, FAO, NOAA, USGS";

export const MINIMART_MAP_MAX_ZOOM = CARTO_KEY ? 19 : 16;

export function usesCartoBasemap(): boolean {
  return Boolean(CARTO_KEY);
}
