export type ConnectionType = 'UDP' | 'TCP' | 'USB_SERIAL' | 'BLUETOOTH' | 'MOCK';

export type VehicleType = 'COPTER' | 'PLANE' | 'VTOL' | 'ROVER' | 'SUB' | 'GENERIC';
export type AutopilotType = 'ARDUPILOT' | 'PX4' | 'INAV';
export type ProtocolType = 'MAVLINK_V2' | 'MAVLINK_V1';

export interface UdpSettings {
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
  autoConnect: boolean;
  reconnect: boolean;
}

export interface SerialSettings {
  baudRate: number;
  port: string;
  autoConnect: boolean;
}

export interface BluetoothSettings {
  deviceName: string;
  deviceId: string;
  baudRate: number;
}

export interface MockSettings {
  vehicleType: VehicleType;
  autopilot: AutopilotType;
  simulateSensors: boolean;
  simulateBatteryDrain: boolean;
}

export interface ConnectionConfig {
  type: ConnectionType;
  vehicleType: VehicleType;
  autopilot: AutopilotType;
  protocol: ProtocolType;
  udp: UdpSettings;
  tcp: TcpSettings;
  serial: SerialSettings;
  bluetooth: BluetoothSettings;
  mock: MockSettings;
}
