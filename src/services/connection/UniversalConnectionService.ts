import { NativeModules, Platform } from 'react-native';
import { ConnectionType, VehicleType, AutopilotType, ConnectionConfig } from '../../settings/types/connection';
import { SensorState } from '../../store/telemetry/telemetrySlice';

export type UniversalConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

function getAutoDevHost(): string | null {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
      return window.location.hostname;
    }
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/https?:\/\/([^/:]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        const host = match[1];
        if (host.includes('exp.direct') || host.includes('ngrok') || host.includes('expo.dev')) {
          return null;
        }
        return host;
      }
    }
  } catch (e) {}
  return null;
}

export interface UniversalTelemetryData {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  battery: number;
  mode: string;
  armed: boolean;
  timestamp: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
  heading?: number;
  satellites?: number;
  hdop?: number;
  voltage?: number;
  current?: number;
  sensors?: SensorState[];
  vehicleType: VehicleType;
  vehicleName: string;
  autopilot: AutopilotType;
  bytesRx: number;
  bytesTx: number;
  packetsPerSec: number;
  latencyMs: number;
}

type TelemetryListener = (data: UniversalTelemetryData) => void;
type StatusListener = (status: UniversalConnectionStatus) => void;

const createEmptyState = (): UniversalTelemetryData => ({
  latitude: 0,
  longitude: 0,
  altitude: 0.0,
  speed: 0.0,
  battery: 0,
  mode: 'DISCONNECTED',
  armed: false,
  timestamp: 0,
  roll: 0,
  pitch: 0,
  yaw: 0,
  heading: 0,
  satellites: 0,
  hdop: 0,
  voltage: 0.0,
  current: 0.0,
  vehicleType: 'COPTER',
  vehicleName: 'NO VEHICLE',
  autopilot: 'ARDUPILOT',
  bytesRx: 0,
  bytesTx: 0,
  packetsPerSec: 0,
  latencyMs: 0,
  sensors: [],
});

class UniversalConnectionService {
  private status: UniversalConnectionStatus = 'DISCONNECTED';
  private telemetryListeners: TelemetryListener[] = [];
  private statusListeners: StatusListener[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  
  private activeConfig: ConnectionConfig | null = null;
  private ws: WebSocket | null = null;
  private bytesRx = 0;
  private bytesTx = 0;
  private lastPacketCount = 0;
  private currentPps = 0;
  private connectionAttempt = 0;

  // Real Drone State (populated strictly by incoming MAVLink packets)
  private state: UniversalTelemetryData = createEmptyState();

  /**
   * Connect to specified transport and drone profile
   */
  connect(config?: Partial<ConnectionConfig>) {
    if (this.status === 'CONNECTED' || this.status === 'CONNECTING') return;

    this.setStatus('CONNECTING');
    
    // Determine target host
    const cType = config?.type || 'UDP';
    let remoteHost = '127.0.0.1';
    if (cType === 'UDP') {
      remoteHost = config?.udp?.remoteHost || '127.0.0.1';
      if (remoteHost === '0.0.0.0' || !remoteHost.trim()) remoteHost = '127.0.0.1';
    } else if (cType === 'TCP') {
      remoteHost = config?.tcp?.host || '127.0.0.1';
      if (!remoteHost.trim()) remoteHost = '127.0.0.1';
    }

    if (cType === 'MOCK') {
      this.startInternalLoop(config, cType);
      return;
    }

    const autoDev = getAutoDevHost();
    const candidateHosts: string[] = [];
    
    if (Platform.OS === 'web') {
      candidateHosts.push('127.0.0.1');
      candidateHosts.push('localhost');
      if (remoteHost && !candidateHosts.includes(remoteHost) && remoteHost !== '0.0.0.0') {
        candidateHosts.push(remoteHost);
      }
      if (!candidateHosts.includes('192.168.1.12')) {
        candidateHosts.push('192.168.1.12');
      }
    } else {
      // Mobile / Native: PC's LAN IP comes first
      if (!candidateHosts.includes('192.168.1.12')) {
        candidateHosts.push('192.168.1.12');
      }
      if (remoteHost && !candidateHosts.includes(remoteHost) && remoteHost !== '0.0.0.0') {
        candidateHosts.push(remoteHost);
      }
      if (autoDev && !candidateHosts.includes(autoDev)) {
        candidateHosts.push(autoDev);
      }
      if (!candidateHosts.includes('10.0.2.2')) candidateHosts.push('10.0.2.2');
      if (!candidateHosts.includes('127.0.0.1')) candidateHosts.push('127.0.0.1');
      if (!candidateHosts.includes('localhost')) candidateHosts.push('localhost');
    }

    this.activeConfig = config as ConnectionConfig;
    this.tryConnectCandidates(candidateHosts, 0, config, cType);
  }

  private tryConnectCandidates(
    candidates: string[], 
    index: number, 
    config?: Partial<ConnectionConfig>, 
    cType: ConnectionType = 'UDP'
  ) {
    if (index >= candidates.length) {
      console.warn('[Universal MAVLink] Could not connect to Python MAVLink Server. Please ensure Python server is running on port 8088.');
      this.setStatus('ERROR');
      return;
    }

    const host = candidates[index];
    const wsUrl = `ws://${host}:8088/ws`;
    console.log(`[Universal MAVLink] Attempting WebSocket connection to: ${wsUrl} (candidate ${index + 1}/${candidates.length})`);

    try {
      const socket = new WebSocket(wsUrl);
      this.ws = socket;
      let hasOpened = false;
      let handled = false;

      const proceedNext = () => {
        if (handled) return;
        handled = true;
        clearTimeout(timeout);
        try { socket.close(); } catch (e) {}
        this.tryConnectCandidates(candidates, index + 1, config, cType);
      };

      const timeout = setTimeout(() => {
        if (!hasOpened && this.status === 'CONNECTING') {
          proceedNext();
        }
      }, 1500);

      socket.onopen = () => {
        if (handled) return;
        hasOpened = true;
        handled = true;
        clearTimeout(timeout);
        console.log(`[Universal MAVLink] Successfully connected to Live MAVLink Bridge at ${wsUrl}`);
        this.setStatus('CONNECTED');
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'TELEMETRY' && parsed.data) {
            this.state = {
              ...this.state,
              ...parsed.data,
              timestamp: Date.now(),
            };
            this.telemetryListeners.forEach(l => l(this.state));
          }
        } catch (e) {}
      };

      socket.onerror = () => {
        if (!hasOpened) {
          proceedNext();
        } else {
          this.setStatus('ERROR');
        }
      };

      socket.onclose = () => {
        if (hasOpened && this.status === 'CONNECTED') {
          console.warn('[Universal MAVLink] WebSocket disconnected');
          this.setStatus('DISCONNECTED');
        } else if (!hasOpened) {
          proceedNext();
        }
        if (this.ws === socket) {
          this.ws = null;
        }
      };
    } catch (e) {
      this.tryConnectCandidates(candidates, index + 1, config, cType);
    }
  }

  private startInternalLoop(config: Partial<ConnectionConfig> | undefined, cType: ConnectionType) {
    const delay = config?.type === 'USB_SERIAL' ? 600 : config?.type === 'BLUETOOTH' ? 800 : 300;

    setTimeout(() => {
      const vType = config?.vehicleType || 'COPTER';
      const apType = config?.autopilot || 'ARDUPILOT';

      let vName = 'ArduCopter V4.5.1 (Virtual SITL)';
      let defaultMode = 'LOITER';

      if (vType === 'PLANE') {
        vName = apType === 'PX4' ? 'PX4 FixedWing v1.14' : 'ArduPlane V4.5.0';
        defaultMode = 'FBWA';
      } else if (vType === 'VTOL') {
        vName = 'QuadPlane VTOL V4.5.0';
        defaultMode = 'QLOITER';
      } else if (vType === 'ROVER') {
        vName = 'ArduRover V4.5.0';
        defaultMode = 'MANUAL';
      } else if (vType === 'SUB') {
        vName = 'ArduSub V4.5.0';
        defaultMode = 'STABILIZE';
      } else if (apType === 'PX4') {
        vName = 'PX4 Autopilot v1.14.2';
        defaultMode = 'POSCTL';
      }

      this.state.vehicleType = vType;
      this.state.autopilot = apType;
      this.state.vehicleName = vName;
      this.state.mode = defaultMode;

      this.state.armed = true;
      this.state.altitude = 12.5;
      this.state.speed = 3.2;
      this.state.battery = 88;
      this.state.satellites = 18;
      this.state.roll = 0.5;
      this.state.pitch = -0.5;
      this.state.yaw = 45;

      this.setStatus('CONNECTED');
      this.startTelemetryLoop(cType);
    }, delay);
  }

  disconnect() {
    this.setStatus('DISCONNECTED');
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.stopTelemetryLoop();
    this.state = createEmptyState();
    this.telemetryListeners.forEach(l => l(this.state));
  }

  getStatus() {
    return this.status;
  }

  getState() {
    return this.state;
  }

  onTelemetry(listener: TelemetryListener) {
    this.telemetryListeners.push(listener);
    return () => {
      this.telemetryListeners = this.telemetryListeners.filter(l => l !== listener);
    };
  }

  onStatusChange(listener: StatusListener) {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  private setStatus(newStatus: UniversalConnectionStatus) {
    this.status = newStatus;
    this.statusListeners.forEach(listener => listener(newStatus));
  }

  private startTelemetryLoop(connType: ConnectionType) {
    if (this.intervalId) return;

    let tick = 0;
    this.intervalId = setInterval(() => {
      tick++;

      // Simulating MAVLink packet throughput
      const packetSize = 142 + Math.floor(Math.random() * 80);
      this.bytesRx += packetSize;
      this.bytesTx += 36;
      this.currentPps = 10; // 10 Hz Telemetry

      // Jitter simulation
      const baseLatency = connType === 'USB_SERIAL' ? 4 : connType === 'UDP' ? 12 : 28;
      const latencyMs = baseLatency + Math.floor(Math.random() * 6);

      // Simulating realistic physics motion when armed
      if (this.state.armed && this.state.altitude > 0) {
        if (this.state.mode === 'TAKEOFF' && this.state.altitude < 15) {
          this.state.altitude = Math.min(15, this.state.altitude + 0.8);
          this.state.speed = 2.5;
        } else if (this.state.mode === 'LAND') {
          this.state.altitude = Math.max(0, this.state.altitude - 0.5);
          if (this.state.altitude === 0) {
            this.state.armed = false;
            this.state.speed = 0;
            this.state.mode = 'LOITER';
          }
        }

        // Advance GPS position slightly in flight
        const headingRad = ((this.state.yaw || 0) * Math.PI) / 180;
        const groundSpeed = this.state.speed || 1.0;
        this.state.latitude += Math.cos(headingRad) * groundSpeed * 0.0000004;
        this.state.longitude += Math.sin(headingRad) * groundSpeed * 0.0000004;
      }

      this.state = {
        ...this.state,
        timestamp: Date.now(),
        battery: Math.max(0, this.state.battery - 0.002),
        bytesRx: this.bytesRx,
        bytesTx: this.bytesTx,
        packetsPerSec: this.currentPps,
        latencyMs,
      };

      this.telemetryListeners.forEach(listener => listener(this.state));
    }, 100); // 10 Hz high-frequency telemetry update
  }

  private stopTelemetryLoop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // MAVLink Commands
  sendCommand(command: string, payload?: any): boolean {
    if (this.status !== 'CONNECTED') {
      console.warn('Cannot send command while disconnected');
      return false;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'COMMAND', command, payload }));
      } catch (e) {}
    }
    this.bytesTx += 48; // MAVLink command message payload
    console.log(`[Universal MAVLink] Sent: ${command}`, payload);
    return true;
  }

  updateMockState(updates: Partial<UniversalTelemetryData>) {
    this.state = {
      ...this.state,
      ...updates,
      timestamp: Date.now(),
    };
    this.telemetryListeners.forEach(listener => listener(this.state));
  }
}

export const universalConnectionService = new UniversalConnectionService();
