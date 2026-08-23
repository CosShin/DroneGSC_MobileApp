import { ConnectionConfig } from '../types/connection';

export const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  type: 'UDP',
  vehicleType: 'COPTER',
  autopilot: 'ARDUPILOT',
  protocol: 'MAVLINK_V2',
  udp: {
    remoteHost: '192.168.1.12',
    remotePort: 14550,
    localPort: 14550,
    autoConnect: true,
    reconnect: true,
    reconnectDelayMs: 1000,
    connectionTimeoutMs: 5000,
    heartbeatTimeoutMs: 3000,
  },
  tcp: {
    host: '192.168.1.12',
    port: 5760,
    autoConnect: false,
    reconnect: true,
  },
  serial: {
    baudRate: 115200,
    port: 'COM_USB_1',
    autoConnect: false,
  },
  bluetooth: {
    deviceName: 'HC-05-DRONE',
    deviceId: '00:14:03:05:5A:B1',
    baudRate: 57600,
  },
  mock: {
    vehicleType: 'COPTER',
    autopilot: 'ARDUPILOT',
    simulateSensors: true,
    simulateBatteryDrain: true,
  },
};
