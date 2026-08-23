import { SensorState } from '../../store/telemetry/telemetrySlice';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

export interface TelemetryData {
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
  sensors?: SensorState[];
}

type TelemetryListener = (data: TelemetryData) => void;
type StatusListener = (status: ConnectionStatus) => void;

class MockConnectionService {
  private status: ConnectionStatus = 'DISCONNECTED';
  private telemetryListeners: TelemetryListener[] = [];
  private statusListeners: StatusListener[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  // Mock initial drone state
  private currentTelemetry: TelemetryData = {
    latitude: 10.823099,
    longitude: 106.629664,
    altitude: 0.0,
    speed: 0.0,
    battery: 100,
    mode: 'LOITER',
    armed: false,
    timestamp: Date.now(),
    sensors: [
      { name: 'GPS', health: 'GOOD', value: '3D Fix (17 Satellites)' },
      { name: 'IMU', health: 'GOOD', value: 'Calibrated' },
      { name: 'Compass', health: 'GOOD', value: 'Offset OK' },
      { name: 'Optical Flow', health: 'GOOD', value: 'Tracking' },
      { name: 'Rangefinder', health: 'GOOD', value: '1.2m' },
      { name: 'EKF', health: 'GOOD', value: 'Velocity Var: Low' },
    ],
  };

  connect() {
    if (this.status !== 'DISCONNECTED') return;

    this.setStatus('CONNECTING');
    
    // Simulate network delay
    setTimeout(() => {
      this.setStatus('CONNECTED');
      this.startMockTelemetry();
    }, 1000);
  }

  disconnect() {
    this.setStatus('DISCONNECTED');
    this.stopMockTelemetry();
  }

  getStatus() {
    return this.status;
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

  private setStatus(newStatus: ConnectionStatus) {
    this.status = newStatus;
    this.statusListeners.forEach(listener => listener(newStatus));
  }

  private startMockTelemetry() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      // Simulate minor variations
      
      // Simulate random sensor issues
      const sensors = [...(this.currentTelemetry.sensors || [])];
      
      if (Math.random() < 0.05) { // 5% chance every second to trigger an issue
        const idx = Math.floor(Math.random() * sensors.length);
        sensors[idx] = {
          ...sensors[idx],
          health: Math.random() > 0.5 ? 'WARNING' : 'CRITICAL',
          message: 'Signal degradation or interference detected',
        };
      } else if (Math.random() < 0.2) { // 20% chance to recover
         sensors.forEach((s, i) => {
            if (s.health !== 'GOOD') {
              sensors[i] = { ...s, health: 'GOOD', message: undefined };
            }
         });
      }

      this.currentTelemetry = {
        ...this.currentTelemetry,
        battery: Math.max(0, this.currentTelemetry.battery - 0.01), // slowly drain
        timestamp: Date.now(),
        sensors,
      };
      
      this.telemetryListeners.forEach(listener => listener(this.currentTelemetry));
    }, 1000); // 1 Hz mock telemetry
  }

  private stopMockTelemetry() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Commands
  sendCommand(command: string, payload?: any) {
    if (this.status !== 'CONNECTED') {
      console.warn('Cannot send command while disconnected');
      return false;
    }
    console.log(`[MOCK] Command sent: ${command}`, payload);
    return true;
  }

  // Backdoor for MockCommandService to simulate drone behavior
  updateMockState(updates: Partial<TelemetryData>) {
    this.currentTelemetry = {
      ...this.currentTelemetry,
      ...updates,
      timestamp: Date.now(),
    };
    // Publish immediately on state change for responsiveness
    this.telemetryListeners.forEach(listener => listener(this.currentTelemetry));
  }
}

export const connectionService = new MockConnectionService();
