import type { RootState } from '../../store';
import { buildFlightContext } from './FlightContextBuilder';
import type { FlightContextSnapshot } from './AiTypes';

export interface AniToolSnapshot {
  capturedAt: number;
  flightContext: FlightContextSnapshot;
  video: {
    status: string;
    currentUrl: string | null;
    lastError: string | null;
  };
  availableCapabilities: Array<{
    name: string;
    support: string;
    visible: boolean;
    reason: string | null;
  }>;
}

function getRuntimeCapabilities() {
  return {
    webSocket: { support: 'SUPPORTED', visible: true, reason: null },
    udp: { support: 'UNKNOWN', visible: false, reason: 'Check Settings > About for platform-specific native UDP support.' },
    tcp: { support: 'UNKNOWN', visible: false, reason: 'Check Settings > About for platform-specific native TCP support.' },
    usbSerial: { support: 'UNKNOWN', visible: false, reason: 'USB Serial is platform-specific and hidden unless the native module is verified.' },
    webRtc: { support: 'SUPPORTED', visible: true, reason: null },
    rtsp: { support: 'UNKNOWN', visible: false, reason: 'RTSP/VLC is native and hidden unless verified on the current platform.' },
    secureStorage: { support: 'SUPPORTED', visible: true, reason: null },
    systemVpn: { support: 'SUPPORTED', visible: true, reason: null },
  };
}

export function buildAniToolSnapshot(state: RootState): AniToolSnapshot {
  const flightContext = buildFlightContext(state);
  const maybeVideo = (state as Partial<RootState>).video;
  const capabilities = getRuntimeCapabilities();
  return {
    capturedAt: Date.now(),
    flightContext,
    video: {
      status: maybeVideo?.status ?? 'IDLE',
      currentUrl: maybeVideo?.currentUrl ?? null,
      lastError: maybeVideo?.lastError ?? null,
    },
    availableCapabilities: [
      { name: 'WebSocket/WSS', ...capabilities.webSocket },
      { name: 'UDP direct MAVLink', ...capabilities.udp },
      { name: 'TCP direct MAVLink', ...capabilities.tcp },
      { name: 'USB Serial', ...capabilities.usbSerial },
      { name: 'WebRTC Video', ...capabilities.webRtc },
      { name: 'RTSP/VLC Video', ...capabilities.rtsp },
      { name: 'Secure Storage', ...capabilities.secureStorage },
      { name: 'System VPN', ...capabilities.systemVpn },
    ].map(item => ({
      name: item.name,
      support: item.support,
      visible: item.visible,
      reason: item.reason,
    })),
  };
}
