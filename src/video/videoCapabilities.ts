import { platformCapabilities } from '../platform/PlatformCapabilities';

export const isExpoGo = platformCapabilities.expoGo;

export const videoCapabilities = Object.freeze({
  webRtcWebView: platformCapabilities.webRtc.support === 'SUPPORTED',
  nativeUdpH264: platformCapabilities.udp.support === 'SUPPORTED',
  nativeRtsp: platformCapabilities.rtsp.support === 'SUPPORTED',
});
