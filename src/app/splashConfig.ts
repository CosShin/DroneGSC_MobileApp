export const MIN_SPLASH_DISPLAY_MS = 1100;
export const MAX_SPLASH_TIMEOUT_MS = 6000;
export const SPLASH_FADE_DURATION_MS = 350;
export const SPLASH_FALLBACK_BG = '#071722';

export type AppBootStatus =
  | 'STARTING'
  | 'LOADING_SETTINGS'
  | 'INITIALIZING_SERVICES'
  | 'READY'
  | 'ERROR';

export function calculateRemainingSplashTime(
  mountTimeMs: number,
  currentTimeMs: number = Date.now(),
  minDisplayMs: number = MIN_SPLASH_DISPLAY_MS
): number {
  const elapsed = currentTimeMs - mountTimeMs;
  return Math.max(0, minDisplayMs - elapsed);
}

export function isAppReadyForFlight(bootStatus: AppBootStatus): boolean {
  return bootStatus === 'READY';
}
