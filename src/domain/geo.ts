/** Great-circle distance between two lat/lon points, in kilometres. */
export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const R = 6371; // mean Earth radius, km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Friendly one-line distance: metres under 1 km, one decimal under 10 km,
 * whole kilometres above. */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
