import { NativeModules, Platform, UIManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type CapabilitySupport = 'SUPPORTED' | 'UNAVAILABLE' | 'UNSUPPORTED';
export type CapabilityClassification =
  | 'SUPPORTED_IOS'
  | 'SUPPORTED_ANDROID'
  | 'SUPPORTED_BOTH'
  | 'PARTIAL_IOS'
  | 'BROKEN_IOS'
  | 'ANDROID_ONLY'
  | 'REPLACE_REQUIRED'
  | 'UNKNOWN';

export interface PlatformCapability {
  support: CapabilitySupport;
  classification: CapabilityClassification;
  requiresDevelopmentBuild: boolean;
  reason: string | null;
  visible: boolean;
}

export interface PlatformCapabilities {
  platform: typeof Platform.OS;
  expoGo: boolean;
  udp: PlatformCapability;
  tcp: PlatformCapability;
  usbSerial: PlatformCapability;
  webSocket: PlatformCapability;
  webRtc: PlatformCapability;
  rtsp: PlatformCapability;
  secureStorage: PlatformCapability;
  systemVpn: PlatformCapability;
}

const available = (
  requiresDevelopmentBuild = false,
  classification: CapabilityClassification = 'SUPPORTED_BOTH',
): PlatformCapability => ({
  support: 'SUPPORTED',
  classification,
  requiresDevelopmentBuild,
  reason: null,
  visible: true,
});

const unavailable = (
  reason: string,
  requiresDevelopmentBuild = true,
  classification: CapabilityClassification = 'UNKNOWN',
  visible = true,
): PlatformCapability => ({
  support: 'UNAVAILABLE',
  classification,
  requiresDevelopmentBuild,
  reason,
  visible,
});

const unsupported = (
  reason: string,
  classification: CapabilityClassification = 'UNKNOWN',
  visible = false,
): PlatformCapability => ({
  support: 'UNSUPPORTED',
  classification,
  requiresDevelopmentBuild: false,
  reason,
  visible,
});

export function getPlatformCapabilities(): PlatformCapabilities {
  const expoGo = NativeModules.ExponentConstants?.appOwnership === 'expo';
  const nativeUdp = Boolean(NativeModules.UdpSockets);
  const nativeTcp = Boolean(NativeModules.TcpSockets ?? NativeModules.RNTcpSocket);
  const nativeUsb = Boolean(NativeModules.AnitechUsbSerial);
  const nativeVlc = Boolean(UIManager.getViewManagerConfig?.('RCTVLCPlayer'));
  const mobile = Platform.OS === 'android' || Platform.OS === 'ios';
  const ios = Platform.OS === 'ios';
  const android = Platform.OS === 'android';

  const udp = ios
    ? unavailable(
        'Direct iOS UDP is not enabled until it passes real-iPhone reconnect and packet-rate validation. Use WebSocket/WSS through the Pi Gateway.',
        true,
        'UNKNOWN',
        false,
      )
    : nativeUdp
      ? available(true, android ? 'SUPPORTED_ANDROID' : 'UNKNOWN')
      : unavailable('Native UDP module is not present. Rebuild the development client.');
  const tcp = ios
    ? unavailable(
        'Direct iOS TCP is not enabled until it passes real-iPhone reconnect and lifecycle validation. Use WebSocket/WSS through the Pi Gateway.',
        true,
        'UNKNOWN',
        false,
      )
    : nativeTcp
      ? available(true, android ? 'SUPPORTED_ANDROID' : 'UNKNOWN')
      : unavailable('Native TCP module is not installed in this build.');
  const rtsp = ios
    ? unavailable(
        'Native VLC/RTSP is disabled on iOS until the current New Architecture build is verified on a real iPhone. Use WebRTC.',
        true,
        'REPLACE_REQUIRED',
        false,
      )
    : nativeVlc
      ? available(true, android ? 'SUPPORTED_ANDROID' : 'UNKNOWN')
      : mobile
        ? unavailable('Native VLC/RTSP view is not present. Rebuild the development client.')
        : unsupported('RTSP playback is not supported on this platform.', 'UNKNOWN');

  return Object.freeze({
    platform: Platform.OS,
    expoGo,
    udp,
    tcp,
    usbSerial: Platform.OS === 'ios'
      ? unsupported('Direct USB serial is not supported by the current iOS architecture.', 'ANDROID_ONLY')
      : Platform.OS !== 'android'
        ? unsupported('USB serial is available only on Android builds.', 'ANDROID_ONLY')
        : nativeUsb
          ? available(true, 'SUPPORTED_ANDROID')
          : unavailable('ANITECH USB serial native module is not installed in this Android build.', true, 'ANDROID_ONLY'),
    webSocket: available(false, mobile ? 'SUPPORTED_BOTH' : 'UNKNOWN'),
    webRtc: mobile
      ? available(false, 'SUPPORTED_BOTH')
      : unsupported('The current WebRTC player is implemented for Android and iOS.', 'UNKNOWN'),
    rtsp,
    secureStorage: typeof SecureStore.isAvailableAsync === 'function' && mobile
      ? available(false, 'SUPPORTED_BOTH')
      : unavailable('expo-secure-store is not installed in this build.', false, 'UNKNOWN'),
    systemVpn: mobile
      ? available(false, 'SUPPORTED_BOTH')
      : unsupported('VPN capability is provided by the Android/iOS operating system.', 'UNKNOWN'),
  });
}

export const platformCapabilities = getPlatformCapabilities();
