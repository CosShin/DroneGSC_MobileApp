import { FRESHNESS_THRESHOLDS, isFresh } from '../config/TelemetryFreshness';

/**
 * Kiểm tra xem dữ liệu telemetry có bị cũ (stale) hay không.
 * Uses the centralized GENERIC threshold by default.
 * @param timestamp Thời điểm nhận dữ liệu (tính bằng ms)
 * @returns true nếu quá khoảng threshold, ngược lại false
 */
export function isTelemetryStale(timestamp: number | null): boolean {
  if (!timestamp) return true;
  return !isFresh(timestamp, 'GENERIC_MS');
}

/**
 * Check whether GPS telemetry is stale using the GPS-specific threshold.
 */
export function isGpsStale(timestamp: number | null): boolean {
  return !isFresh(timestamp, 'GPS_MS');
}

/**
 * Check whether battery telemetry is stale using the battery-specific threshold.
 */
export function isBatteryStale(timestamp: number | null): boolean {
  return !isFresh(timestamp, 'BATTERY_MS');
}

/** Re-export for convenience */
export { FRESHNESS_THRESHOLDS, isFresh };
