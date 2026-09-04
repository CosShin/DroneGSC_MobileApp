import type { VideoStatus } from './VideoTypes';

export type FlightDisplayMode = 'HUD' | 'VIDEO';
export type VideoAvailability = 'UNAVAILABLE' | 'CONNECTING' | 'LIVE' | 'ERROR';

export function getVideoAvailability(configured: boolean, status: VideoStatus): VideoAvailability {
  if (!configured || status === 'IDLE' || status === 'OFFLINE') return 'UNAVAILABLE';
  if (status === 'CONNECTING' || status === 'RECONNECTING') return 'CONNECTING';
  if (status === 'LIVE') return 'LIVE';
  return 'ERROR';
}

export function resolveInitialFlightDisplay(
  configured: boolean,
  status: VideoStatus,
): FlightDisplayMode {
  return getVideoAvailability(configured, status) === 'LIVE' ? 'VIDEO' : 'HUD';
}

export function canShowVideo(configured: boolean, status: VideoStatus): boolean {
  // Keep a configured player reachable while it connects or shows a retryable
  // error. Requiring LIVE here deadlocks a hidden WebView because the user
  // cannot reveal it before it emits VIDEO_PLAYING.
  return configured;
}

export function resolveFlightLayerVisibility(
  primaryView: 'FLIGHT' | 'MAP',
  displayMode: FlightDisplayMode,
  videoConfigured: boolean,
) {
  const map = primaryView === 'MAP';
  const video = primaryView === 'FLIGHT' && displayMode === 'VIDEO' && videoConfigured;
  return {
    map,
    video,
    hud: primaryView === 'FLIGHT' && !video,
  };
}

export function videoStatusLabel(configured: boolean, status: VideoStatus): string {
  const availability = getVideoAvailability(configured, status);
  if (availability === 'LIVE') return 'VIDEO LIVE';
  if (availability === 'CONNECTING') return 'VIDEO CONNECTING';
  if (availability === 'ERROR') return 'VIDEO ERROR';
  return 'VIDEO OFFLINE';
}
