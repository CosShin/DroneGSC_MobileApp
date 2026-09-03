import type { ConnectionConfig, NetworkProfileType, SavedConnectionProfile } from '../../settings/types/connection';

export const NETWORK_PROFILE_LABELS: Readonly<Record<NetworkProfileType, string>> = {
  LOCAL_WIFI: 'Local Wi-Fi / LAN',
  TELEMETRY_RADIO: 'Telemetry Radio',
  USB_DIRECT: 'USB Direct',
  CELLULAR_VPN: '4G / System VPN',
  CUSTOM: 'Custom',
  SITL: 'SITL',
};

export function applyNetworkProfile(config: ConnectionConfig, profile: NetworkProfileType): ConnectionConfig {
  if (profile === 'TELEMETRY_RADIO') {
    return { ...config, type: 'UDP', networkProfile: profile, udp: { ...config.udp, mode: 'LISTEN', localPort: 14550 } };
  }
  if (profile === 'USB_DIRECT') return { ...config, type: 'USB_SERIAL', networkProfile: profile };
  if (profile === 'SITL') {
    return { ...config, type: 'UDP', networkProfile: profile, udp: { ...config.udp, mode: 'LISTEN', localPort: 14550 } };
  }
  if (profile === 'LOCAL_WIFI') return { ...config, type: 'WEBSOCKET', networkProfile: profile };
  // VPN and custom profiles intentionally retain the chosen transport. The OS
  // VPN supplies routing; it is not represented as a MAVLink transport.
  return { ...config, networkProfile: profile };
}

export function createSavedConnectionProfile(id: string, name: string, config: ConnectionConfig, now = Date.now()): SavedConnectionProfile {
  return {
    id,
    name: name.trim(),
    config: {
      ...config,
      udp: { ...config.udp },
      websocket: { ...config.websocket },
      tcp: { ...config.tcp },
      serial: { ...config.serial },
      bluetooth: { ...config.bluetooth },
      mock: { ...config.mock },
    },
    createdAt: now,
    updatedAt: now,
  };
}

