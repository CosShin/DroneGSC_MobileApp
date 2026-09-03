import { NativeModules, Platform, UIManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type CapabilitySupport = 'SUPPORTED' | 'UNAVAILABLE' | 'UNSUPPORTED';

export interface PlatformCapability {
  support: CapabilitySupport;
  requiresDevelopmentBuild: boolean;
  reason: string | null;
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

const available = (requiresDevelopmentBuild = false): PlatformCapability => ({
  support: 'SUPPORTED',
  requiresDevelopmentBuild,
  reason: null,
});

const unavailable = (reason: string, requiresDevelopmentBuild = true): PlatformCapability => ({
  support: 'UNAVAILABLE',
  requiresDevelopmentBuild,
  reason,
});

const unsupported = (reason: string): PlatformCapability => ({
  support: 'UNSUPPORTED',
  requiresDevelopmentBuild: false,
  reason,
});

export function getPlatformCapabilities(): PlatformCapabilities {
  const expoGo = NativeModules.ExponentConstants?.appOwnership === 'expo';
  const nativeUdp = Boolean(NativeModules.UdpSockets);
  const nativeTcp = Boolean(NativeModules.TcpSockets ?? NativeModules.RNTcpSocket);
  const nativeUsb = Boolean(NativeModules.AnitechUsbSerial);
  const nativeVlc = Boolean(UIManager.getViewManagerConfig?.('RCTVLCPlayer'));
  const mobile = Platform.OS === 'android' || Platform.OS === 'ios';

  return Object.freeze({
    platform: Platform.OS,
    expoGo,
    udp: nativeUdp
      ? available(true)
      : unavailable('Native UDP module is not present. Rebuild the development client.'),
    tcp: nativeTcp
      ? available(true)
      : unavailable('Native TCP module is not installed in this build.'),
    usbSerial: Platform.OS === 'ios'
      ? unsupported('Direct USB serial is not supported by the current iOS architecture.')
      : Platform.OS !== 'android'
        ? unsupported('USB serial is available only on Android builds.')
        : nativeUsb
          ? available(true)
          : unavailable('ANITECH USB serial native module is not installed in this Android build.'),
    webSocket: available(false),
    webRtc: mobile
      ? available(false)
      : unsupported('The current WebRTC player is implemented for Android and iOS.'),
    rtsp: nativeVlc
      ? available(true)
      : mobile
        ? unavailable('Native VLC/RTSP view is not present. Rebuild the development client.')
        : unsupported('RTSP playback is not supported on this platform.'),
    secureStorage: typeof SecureStore.isAvailableAsync === 'function' && mobile
      ? available(false)
      : unavailable('expo-secure-store is not installed in this build.'),
    systemVpn: mobile
      ? available(false)
      : unsupported('VPN capability is provided by the Android/iOS operating system.'),
  });
}

export const platformCapabilities = getPlatformCapabilities();
