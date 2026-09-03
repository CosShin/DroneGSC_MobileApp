export type ConnectionType = 'UDP' | 'WEBSOCKET' | 'TCP' | 'USB_SERIAL' | 'BLUETOOTH' | 'MOCK';

export type VehicleType = 'COPTER' | 'PLANE' | 'VTOL' | 'ROVER' | 'SUB' | 'GENERIC';
export type AutopilotType = 'ARDUPILOT' | 'PX4' | 'INAV';
export type ProtocolType = 'MAVLINK_V2' | 'MAVLINK_V1';
export type NetworkProfileType = 'LOCAL_WIFI' | 'TELEMETRY_RADIO' | 'USB_DIRECT' | 'CELLULAR_VPN' | 'CUSTOM' | 'SITL';

export interface UdpSettings {
  mode: 'LISTEN' | 'CLIENT';
  localAddress: string;
  remoteHost: string;
  remotePort: number;
  localPort: number;
  autoConnect: boolean;
  reconnect: boolean;
  reconnectDelayMs: number;
  connectionTimeoutMs: number;
  heartbeatTimeoutMs: number;
}

export interface TcpSettings {
  host: string;
  port: number;
  connectTimeoutMs: number;
  heartbeatTimeoutMs: number;
  reconnectDelayMs: number;
  autoConnect: boolean;
  reconnect: boolean;
}

export interface WebSocketSettings {
  url: string;
  autoConnect: boolean;
  reconnect: boolean;
  reconnectDelayMs: number;
  connectionTimeoutMs: number;
  heartbeatTimeoutMs: number;
}

export interface SerialSettings {
  baudRate: number;
  port: string;
  deviceId: number | null;
  vendorId: number | null;
  productId: number | null;
  autoConnect: boolean;
}

export interface BluetoothSettings {
  mode: 'CLASSIC' | 'BLE';
  deviceName: string;
  deviceId: string;
  baudRate: number;
  autoConnect: boolean;
}

export interface MockSettings {
  vehicleType: VehicleType;
  autopilot: AutopilotType;
  simulateSensors: boolean;
  simulateBatteryDrain: boolean;
}

export interface ConnectionConfig {
  type: ConnectionType;
  networkProfile: NetworkProfileType;
  vehicleType: VehicleType;
  autopilot: AutopilotType;
  protocol: ProtocolType;
  udp: UdpSettings;
  websocket: WebSocketSettings;
  tcp: TcpSettings;
  serial: SerialSettings;
  bluetooth: BluetoothSettings;
  mock: MockSettings;
}

export interface SavedConnectionProfile {
  id: string;
  name: string;
  config: ConnectionConfig;
  createdAt: number;
  updatedAt: number;
}
