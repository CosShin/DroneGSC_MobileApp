/**
 * Centralized telemetry freshness thresholds.
 *
 * Different MAVLink messages arrive at different rates:
 *   ATTITUDE  → ~10–20 Hz
 *   VFR_HUD   → ~4 Hz
 *   GPS       → ~1–5 Hz
 *   BATTERY   → ~0.2–1 Hz
 *
 * A single TELEMETRY_TIMEOUT cannot cover all categories without
 * either hiding genuinely stale data or flickering slower streams.
 *
 * This module is the single source of truth for freshness checks
 * across HUD, video overlay, validators, and AI context builders.
 */

/** Milliseconds after which a telemetry category is considered stale. */
export const FRESHNESS_THRESHOLDS = {
  /** ATTITUDE message (roll/pitch/yaw). High-rate stream (~10–20 Hz). */
  ATTITUDE_MS: 2_000,

  /** GPS_RAW_INT / GLOBAL_POSITION_INT. Moderate-rate (~1–5 Hz). */
  GPS_MS: 5_000,

  /** VFR_HUD (groundspeed, climb). Moderate-rate (~4 Hz). */
  VELOCITY_MS: 3_000,

  /** BATTERY_STATUS / SYS_STATUS battery fields. Slow-rate (~0.2–1 Hz). */
  BATTERY_MS: 30_000,

  /** HEARTBEAT. Covered by HeartbeatMonitor; this is a UI-level fallback. */
  HEARTBEAT_MS: 3_000,

  /** Generic fallback for any telemetry field without a specific threshold. */
  GENERIC_MS: 5_000,
} as const;

export type FreshnessCategory = keyof typeof FRESHNESS_THRESHOLDS;

/**
 * Check whether a telemetry timestamp is still fresh.
 * @param timestamp  Last received timestamp (ms since epoch), or null/0 if never received.
 * @param category   Which freshness threshold to use.
 * @param now        Current time (ms since epoch). Defaults to Date.now().
 * @returns `true` if the value is fresh; `false` if stale or never received.
 */
export function isFresh(
  timestamp: number | null | undefined,
  category: FreshnessCategory,
  now: number = Date.now(),
): boolean {
  if (!timestamp) return false;
  return now - timestamp <= FRESHNESS_THRESHOLDS[category];
}

/**
 * Returns the age in milliseconds, or null if never received.
 */
export function telemetryAge(
  timestamp: number | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!timestamp) return null;
  return Math.max(0, now - timestamp);
}
