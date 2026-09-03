/**
 * WGS-84 ellipsoid and spherical trigonometric constants for GCS navigation.
 */
const EARTH_RADIUS_METERS = 6371000; // Mean Earth radius in meters

/**
 * Validates whether latitude and longitude are valid geographic coordinates
 * and not null island (0, 0) sentinels or NaN/Infinity.
 */
export function isValidCoordinate(latitude: number | null | undefined, longitude: number | null | undefined): boolean {
  if (latitude == null || longitude == null) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  // Guard against uninitialized 0.0, 0.0 unless both are explicitly tested
  if (Math.abs(latitude) < 1e-7 && Math.abs(longitude) < 1e-7) return false;
  return true;
}

/**
 * Calculates the great-circle distance between two coordinates in meters
 * using the Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates the initial bearing (forward azimuth) from point 1 to point 2 in degrees (0°..360°).
 */
export function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(radLat2);
  const x =
    Math.cos(radLat1) * Math.sin(radLat2) -
    Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(dLon);

  const initialBearingRad = Math.atan2(y, x);
  const bearingDeg = ((initialBearingRad * 180) / Math.PI + 360) % 360;

  return bearingDeg;
}

/**
 * Human-readable distance format:
 * - Below 1000m: `142 m`
 * - Above 1000m: `1.24 km`
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return '--';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Calculates destination point given distance (m) and bearing (deg) from start point.
 */
export function calculateDestination(
  startLat: number,
  startLon: number,
  distanceMeters: number,
  bearingDegrees: number,
): { latitude: number; longitude: number } {
  const dByR = distanceMeters / EARTH_RADIUS_METERS;
  const radBearing = (bearingDegrees * Math.PI) / 180;
  const radLat1 = (startLat * Math.PI) / 180;
  const radLon1 = (startLon * Math.PI) / 180;

  const radLat2 = Math.asin(
    Math.sin(radLat1) * Math.cos(dByR) +
    Math.cos(radLat1) * Math.sin(dByR) * Math.cos(radBearing)
  );

  const radLon2 = radLon1 + Math.atan2(
    Math.sin(radBearing) * Math.sin(dByR) * Math.cos(radLat1),
    Math.cos(dByR) - Math.sin(radLat1) * Math.sin(radLat2)
  );

  const lat2 = (radLat2 * 180) / Math.PI;
  const lon2 = (((radLon2 * 180) / Math.PI + 540) % 360) - 180;

  return { latitude: lat2, longitude: lon2 };
}

/**
 * Human-readable bearing format (e.g. `278°`).
 */
export function formatBearing(degrees: number | null | undefined): string {
  if (degrees == null || !Number.isFinite(degrees)) return '--°';
  const normalized = ((degrees % 360) + 360) % 360;
  return `${Math.round(normalized).toString().padStart(3, '0')}°`;
}


