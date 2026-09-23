/** Haversine distance + friendly distance text. */

export interface LatLon {
  lat: number;
  lng: number;
}

export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const toRad = (x: number): number => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function distanceText(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/**
 * Shortest distance (km) from point `p` to the segment a→b — the core of the
 * SIMULATED "along my route" corridor. Local equirectangular projection around
 * the segment's mean latitude (accurate to a few metres at Kochi's scale).
 * No routing service, no API key: an honest straight-line approximation that
 * the UI clearly labels as simulated.
 */
export function distanceToSegmentKm(p: LatLon, a: LatLon, b: LatLon): number {
  const meanLat = (a.lat + b.lat) / 2;
  const kmPerDegLng = 111.32 * Math.cos((meanLat * Math.PI) / 180);
  const kmPerDegLat = 110.574;
  // Work in a local km frame with `a` at the origin.
  const bx = (b.lng - a.lng) * kmPerDegLng;
  const by = (b.lat - a.lat) * kmPerDegLat;
  const px = (p.lng - a.lng) * kmPerDegLng;
  const py = (p.lat - a.lat) * kmPerDegLat;
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
}
