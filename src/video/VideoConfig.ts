import type { VideoSettings } from '../settings/types/video';
import type { WebRtcVideoConfig } from './VideoTypes';

export const WEBRTC_DEFAULTS: WebRtcVideoConfig = {
  scheme: 'http',
  host: '',
  port: 8889,
  streamPath: 'landing-cam',
  autoplay: true,
  muted: true,
  controls: false,
  playsInline: true,
  autoReconnect: true,
};

export function selectWebRtcConfig(settings: VideoSettings): WebRtcVideoConfig {
  return {
    scheme: settings.scheme,
    host: settings.host,
    port: settings.port,
    streamPath: settings.streamPath,
    autoplay: settings.autoplay,
    muted: settings.muted,
    controls: settings.controls,
    playsInline: settings.playsInline,
    autoReconnect: settings.autoReconnect,
  };
}
