export type VideoTransport = 'WEBRTC' | 'RTSP' | 'UDP_H264' | 'NONE';

export type VideoStatus =
  | 'IDLE'
  | 'CONNECTING'
  | 'LIVE'
  | 'RECONNECTING'
  | 'OFFLINE'
  | 'ERROR';

export type VideoScheme = 'http' | 'https';

export interface WebRtcVideoConfig {
  scheme: VideoScheme;
  host: string;
  port: number;
  streamPath: string;
  autoplay: boolean;
  muted: boolean;
  controls: boolean;
  playsInline: boolean;
  autoReconnect: boolean;
}

export interface VideoRuntimeState {
  status: VideoStatus;
  currentUrl: string | null;
  lastConnectedAt: number | null;
  lastError: string | null;
  reconnectAttempt: number;
}
