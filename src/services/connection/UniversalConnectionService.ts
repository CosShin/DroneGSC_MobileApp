import { ConnectionConfig, ConnectionType, VehicleType, AutopilotType } from '../../settings/types/connection';
import { DEFAULT_CONNECTION_CONFIG } from '../../settings/defaults/connection';
import { SensorState } from '../../store/telemetry/telemetrySlice';
import { FlightControlInput } from '../../types/joystick';
import {
  MavlinkCommandAck,
  MavlinkManager,
  MavlinkPacketEvent,
  MavlinkStatusText,
  MavlinkTrafficDiagnostics,
  MavlinkVehicleState,
} from '../mavlink/MavlinkManager';
import { UdpTransport } from '../mavlink/UdpTransport';
import { WebSocketTransport } from '../mavlink/WebSocketTransport';
import { MavlinkTransport } from '../mavlink/MavlinkTransport';
import { MavlinkMissionService } from '../mission/MavlinkMissionService';
import { MissionItemInt } from '../mission/MissionTypes';
import { ConnectionLogger } from './ConnectionLogger';
import { ConnectionPhase, ConnectionStateMachine } from './ConnectionStateMachine';
import { platformCapabilities } from '../../platform/PlatformCapabilities';
import { validateConnectionConfig } from './ConnectionValidation';
import type { MavlinkSigningPolicy } from '../mavlink/MavlinkSigning';
import { MavlinkSigningSession } from '../mavlink/MavlinkSigning';
import { loadMavlinkSigningKey } from '../mavlink/MavlinkSigningKeyStore';
import { precisionLandingAdvisor } from '../vision/PrecisionLandingAdvisor';
import { createDevDiagnostics } from '../../utils/devDiagnostics';
import { HeartbeatMonitor } from './HeartbeatMonitor';
import { LinkQualityService } from './LinkQualityService';
import { ReconnectPolicy } from './ReconnectPolicy';
import {
  emptyConnectionHealth,
  type ConnectionHealthSnapshot,
  type NetworkSnapshot,
} from './ConnectionHealth';

export type UniversalConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
export type NetworkState = 'DISCONNECTED' | 'BOUND' | 'ERROR';
export type MavlinkState = 'IDLE' | 'WAITING_HEARTBEAT' | 'ACTIVE' | 'HEARTBEAT_LOST';
export type VehicleState = 'NO_VEHICLE' | 'CONNECTED' | 'STALE';

export interface UniversalLinkState {
  phase: ConnectionPhase;
  network: NetworkState;
  mavlink: MavlinkState;
  vehicle: VehicleState;
  error: string | null;
}

export interface UniversalTelemetryData {
  latitude: number | null; longitude: number | null; altitude: number | null;
  altitudeMsl: number | null; relativeAltitude: number | null;
  speed: number | null; climb: number | null;
  battery: number | null; mode: string; armed: boolean; timestamp: number;
  roll: number | null; pitch: number | null; yaw: number | null; heading: number | null;
  satellites: number | null; gpsFix: number | null; hdop: number | null;
  voltage: number | null; current: number | null; sensors: SensorState[];
  homeLatitude: number | null; homeLongitude: number | null; homeAltitude: number | null; homeUpdatedAt: number | null;
  gpsTimestamp: number; attitudeTimestamp: number; velocityTimestamp: number; batteryTimestamp: number;
  vehicleType: VehicleType; vehicleName: string; autopilot: AutopilotType;
  bytesRx: number; bytesTx: number; packetsPerSec: number; packetsLost: number;
  packetsTx: number; rxPacketsPerSec: number; txPacketsPerSec: number;
  rxBytesPerSec: number; txBytesPerSec: number; mavlinkVersion: 1 | 2 | null;
  latencyMs: number | null; lastHeartbeatAt: number | null; stale: boolean;
}

type TelemetryListener = (data: UniversalTelemetryData) => void;
type StatusListener = (status: UniversalConnectionStatus) => void;
const devLog = createDevDiagnostics('CONNECTION', { minIntervalMs: 500, maxPerKey: 160 });

const emptyTelemetry = (): UniversalTelemetryData => ({
  latitude: null, longitude: null, altitude: null, altitudeMsl: null, relativeAltitude: null,
  speed: null, climb: null, battery: null,
  mode: 'UNKNOWN', armed: false, timestamp: 0, roll: null, pitch: null, yaw: null,
  heading: null, satellites: null, gpsFix: null, hdop: null, voltage: null, current: null,
  sensors: [], homeLatitude: null, homeLongitude: null, homeAltitude: null, homeUpdatedAt: null,
  vehicleType: 'GENERIC', vehicleName: 'NO VEHICLE', autopilot: 'ARDUPILOT',
  bytesRx: 0, bytesTx: 0, packetsPerSec: 0, packetsLost: 0, packetsTx: 0,
  rxPacketsPerSec: 0, txPacketsPerSec: 0, rxBytesPerSec: 0, txBytesPerSec: 0,
  mavlinkVersion: null, latencyMs: null,
  gpsTimestamp: 0, attitudeTimestamp: 0, velocityTimestamp: 0, batteryTimestamp: 0,
  lastHeartbeatAt: null, stale: false,
});

const SENSOR_NAMES: Record<number, string> = {
  0x01: 'Gyroscope',
  0x02: 'Accelerometer',
  0x04: 'Compass',
  0x08: 'Barometer',
  0x20: 'Attitude',
  0x400: 'RC Receiver',
  0x800: 'Gyroscope (Secondary)',
  0x1000: 'Accelerometer (Secondary)',
  0x2000: 'Compass (Secondary)',
  0x4000: 'Geofence',
  0x8000: 'AHRS',
  0x10000: 'Terrain',
  0x20000: 'Motors',
  0x40000: 'Logging',
  0x80000: 'Battery',
  0x400000: 'Pre-arm checks',
};

function parseSensors(present: number | null, enabled: number | null, health: number | null): SensorState[] {
  if (present === null || enabled === null || health === null) return [];
  const sensors: SensorState[] = [];
  for (const [bitStr, name] of Object.entries(SENSOR_NAMES)) {
    const bit = parseInt(bitStr, 10);
    if ((present & bit) === 0) continue;
    const isEnabled = (enabled & bit) !== 0;
    const isHealthy = (health & bit) !== 0;
    if (isEnabled || !isHealthy) {
      sensors.push({
        name,
        health: isHealthy ? 'GOOD' : 'CRITICAL',
        value: isHealthy ? 'OK' : 'ERROR',
        message: isHealthy ? 'Sensor is healthy' : 'Sensor error detected',
      });
    }
  }
  return sensors;
}

type RealTransportType = 'UDP' | 'WEBSOCKET' | 'TCP' | 'USB_SERIAL';
type TransportFactory = (type: RealTransportType) => MavlinkTransport;

function createTransport(type: RealTransportType): MavlinkTransport {
  if (type === 'UDP') return new UdpTransport();
  if (type === 'WEBSOCKET') return new WebSocketTransport();
  if (type === 'USB_SERIAL') {
    const { UsbSerialTransport } = require('../mavlink/UsbSerialTransport') as typeof import('../mavlink/UsbSerialTransport');
    return new UsbSerialTransport();
  }
  // Keep the native TCP package out of Expo Go's startup module graph. It is
  // evaluated only after capability checks and an explicit TCP connection.
  const { TcpTransport } = require('../mavlink/TcpTransport') as typeof import('../mavlink/TcpTransport');
  return new TcpTransport();
}

export class UniversalConnectionService {
  private status: UniversalConnectionStatus = 'DISCONNECTED';
  private readonly phaseMachine = new ConnectionStateMachine();
  private readonly logger = new ConnectionLogger();
  private linkState: UniversalLinkState = { phase: 'IDLE', network: 'DISCONNECTED', mavlink: 'IDLE', vehicle: 'NO_VEHICLE', error: null };
  private state = emptyTelemetry();
  private manager: MavlinkManager;
  private missionService: MavlinkMissionService;
  private readonly transportFactory: TransportFactory;
  private telemetryListeners = new Set<TelemetryListener>();
  private statusListeners = new Set<StatusListener>();
  private linkListeners = new Set<(state: UniversalLinkState) => void>();
  private heartbeatListeners = new Set<(timestamp: number) => void>();
  private ackListeners = new Set<(ack: MavlinkCommandAck) => void>();
  private statusTextListeners = new Set<(message: MavlinkStatusText) => void>();
  private removers: Array<() => void> = [];
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutMs = 3000;
  private connectionTimeoutMs = 5000;
  private reconnectDelayMs = 1000;
  private reconnectEnabled = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private activeConfig: ConnectionConfig | null = null;
  private intentionalDisconnect = true;
  private connectAttempt = 0;
  private lastHeartbeatAt = 0;
  private lastWatchdogTime = 0;
  private reconnectCount = 0;
  private reconnectAttemptStreak = 0;
  private readonly heartbeatMonitor = new HeartbeatMonitor();
  private readonly linkQualityService = new LinkQualityService();
  private readonly reconnectPolicy = new ReconnectPolicy();
  private health = emptyConnectionHealth();
  private healthListeners = new Set<(health: ConnectionHealthSnapshot) => void>();
  private networkSnapshot: NetworkSnapshot = {
    isConnected: null,
    isInternetReachable: null,
    type: null,
    changedAt: Date.now(),
  };
  private previousTraffic = { packetsRx: 0, packetsLost: 0 };
  private packetLossPct: number | null = null;
  private lastAckLatencyMs: number | null = null;
  private lastHealthEmitAt = 0;

  constructor(
    manager = new MavlinkManager(),
    transportFactory: TransportFactory = createTransport,
  ) {
    this.manager = manager;
    this.missionService = new MavlinkMissionService(manager);
    this.transportFactory = transportFactory;
  }

  getMissionService(): MavlinkMissionService {
    return this.missionService;
  }

  private now() { return typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now(); }

  async configureMavlinkSigning(policy: MavlinkSigningPolicy, linkId: number) {
    if (this.status !== 'DISCONNECTED' && this.status !== 'ERROR') throw new Error('SIGNING_CHANGE_REQUIRES_DISCONNECT');
    if (policy === 'DISABLED') {
      this.manager.configureSigning(null);
      return;
    }
    const key = await loadMavlinkSigningKey();
    if (!key) throw new Error('MAVLINK_SIGNING_KEY_NOT_CONFIGURED');
    this.manager.configureSigning(new MavlinkSigningSession(policy, key, linkId));
  }


  async connect(config?: Partial<ConnectionConfig>) {
    devLog('connect-called', { type: config?.type ?? DEFAULT_CONNECTION_CONFIG.type, currentStatus: this.status });
    this.intentionalDisconnect = false;
    this.activeConfig = {
      ...DEFAULT_CONNECTION_CONFIG,
      ...config,
      udp: { ...DEFAULT_CONNECTION_CONFIG.udp, ...config?.udp },
      websocket: { ...DEFAULT_CONNECTION_CONFIG.websocket, ...config?.websocket },
      tcp: { ...DEFAULT_CONNECTION_CONFIG.tcp, ...config?.tcp },
      serial: { ...DEFAULT_CONNECTION_CONFIG.serial, ...config?.serial },
      bluetooth: { ...DEFAULT_CONNECTION_CONFIG.bluetooth, ...config?.bluetooth },
      mock: { ...DEFAULT_CONNECTION_CONFIG.mock, ...config?.mock },
    };
    this.reconnectCount = 0;
    this.reconnectAttemptStreak = 0;
    this.lastAckLatencyMs = null;
    this.packetLossPct = null;
    this.previousTraffic = { packetsRx: 0, packetsLost: 0 };
    this.clearReconnectTimer();
    this.logger.write({
      level: 'INFO',
      category: 'TRANSPORT',
      code: 'CONNECT',
      message: `Connecting to ${this.activeConfig.type}`,
    });
    return this.openConnection(this.activeConfig, false);
  }

  private async openConnection(config: ConnectionConfig, reconnecting: boolean) {
    const attempt = ++this.connectAttempt;
    devLog('open-connection', { attempt, reconnecting, type: config.type, reconnectCount: this.reconnectCount });
    this.teardownRuntime();
    this.reconnectEnabled = false;
    const type: ConnectionType = config?.type ?? 'WEBSOCKET';
    this.transition('OPENING_TRANSPORT', reconnecting ? `Reopening ${type}` : `Opening ${type}`);
    const validationIssues = validateConnectionConfig(config);
    if (validationIssues.length > 0) {
      this.fail(`INVALID_CONNECTION_CONFIG: ${validationIssues[0].message}`);
      return;
    }
    if (type !== 'UDP' && type !== 'WEBSOCKET' && type !== 'TCP' && type !== 'USB_SERIAL') {
      this.fail(`UNSUPPORTED_REAL_TRANSPORT_${type}`);
      return;
    }
    const capability = type === 'UDP'
      ? platformCapabilities.udp
      : type === 'TCP'
        ? platformCapabilities.tcp
        : type === 'USB_SERIAL'
          ? platformCapabilities.usbSerial
          : platformCapabilities.webSocket;
    if (capability.support !== 'SUPPORTED') {
      this.fail(`${type}_UNAVAILABLE: ${capability.reason ?? 'Unsupported on this build'}`);
      return;
    }
    const udpHost = config?.udp?.mode === 'LISTEN' ? '' : config?.udp?.remoteHost?.trim();
    const endpoint = type === 'UDP'
      ? {
          host: udpHost || undefined,
          port: udpHost ? config?.udp?.remotePort : undefined,
          localAddress: config?.udp?.localAddress?.trim() || '0.0.0.0',
          localPort: config?.udp?.localPort,
        }
      : type === 'TCP'
        ? {
            host: config?.tcp?.host?.trim(),
            port: config?.tcp?.port,
            timeoutMs: config?.tcp?.connectTimeoutMs,
          }
        : type === 'USB_SERIAL'
          ? {
              baudRate: config?.serial?.baudRate ?? 57600,
              deviceId: config?.serial?.port || 'default',
            }
          : { url: config?.websocket?.url?.trim() };
    const transport = this.transportFactory(type);
    this.heartbeatTimeoutMs = type === 'WEBSOCKET'
      ? config.websocket?.heartbeatTimeoutMs ?? 3000
      : type === 'TCP'
        ? config.tcp?.heartbeatTimeoutMs ?? 3000
        : type === 'UDP'
          ? config.udp?.heartbeatTimeoutMs ?? 3000
          : 3000;
    this.connectionTimeoutMs = type === 'TCP'
      ? config.tcp?.connectTimeoutMs ?? 5000
      : type === 'WEBSOCKET'
        ? config.websocket?.connectionTimeoutMs ?? 5000
        : type === 'USB_SERIAL'
          ? 5000
          : config.udp?.connectionTimeoutMs ?? 5000;
    this.reconnectDelayMs = type === 'WEBSOCKET'
      ? config.websocket?.reconnectDelayMs ?? 1000
      : type === 'TCP'
        ? config.tcp?.reconnectDelayMs ?? 1000
        : type === 'UDP'
          ? config.udp?.reconnectDelayMs ?? 1000
          : 1000;
    this.reconnectEnabled = type === 'WEBSOCKET'
      ? config.websocket?.reconnect ?? false
      : type === 'TCP'
        ? config.tcp?.reconnect ?? false
        : type === 'UDP'
          ? config.udp?.reconnect ?? false
          : false;
    this.setStatus('CONNECTING');
    this.setLink({ network: 'DISCONNECTED', mavlink: 'WAITING_HEARTBEAT', vehicle: 'NO_VEHICLE', error: null });
    this.refreshHealth(true);
    this.removers = [
      this.manager.onState(raw => this.updateFromMavlink(raw, config)),
      this.manager.onHeartbeat(timestamp => this.handleHeartbeat(timestamp)),
      this.manager.onCommandAck(ack => this.ackListeners.forEach(listener => listener(ack))),
      this.manager.onStatusText(message => this.statusTextListeners.forEach(listener => listener(message))),
      this.manager.onError(error => this.fail(`${type}_TRANSPORT_ERROR: ${error.message}`)),
    ];
    devLog('runtime-listeners-registered', { attempt, removers: this.removers.length, type });

    try {
      await this.withTimeout(this.manager.connect(transport, endpoint), this.connectionTimeoutMs, `${type}_OPEN_TIMEOUT`);
      if (attempt !== this.connectAttempt || this.intentionalDisconnect) {
        transport.disconnect();
        return;
      }
      if (this.phaseMachine.getSnapshot().phase === 'OPENING_TRANSPORT') {
        this.transition('TRANSPORT_READY', `${type} ready`);
      }
      if (this.phaseMachine.getSnapshot().phase === 'TRANSPORT_READY') {
        this.transition('WAITING_HEARTBEAT', 'Waiting for a vehicle heartbeat');
      }
      if (this.phaseMachine.getSnapshot().phase !== 'LINK_ACTIVE') {
        this.setLink({ network: 'BOUND', mavlink: 'WAITING_HEARTBEAT', vehicle: 'NO_VEHICLE', error: null });
      }
      this.lastWatchdogTime = this.now();
      this.watchdog = setInterval(() => this.checkHeartbeat(), 250);
      this.logger.write({ level: 'INFO', category: 'TRANSPORT', code: 'TRANSPORT_READY', message: `${type} ready; waiting for HEARTBEAT` });
      devLog('transport-ready', { attempt, type, watchdog: Boolean(this.watchdog), reconnectEnabled: this.reconnectEnabled });
      this.refreshHealth(true);
    } catch (error) {
      if (attempt !== this.connectAttempt || this.intentionalDisconnect) return;
      this.manager.disconnect();
      this.fail(error instanceof Error ? `${type}_OPEN_FAILED: ${error.message}` : `${type}_OPEN_FAILED`);
    }
  }

  disconnect() {
    devLog('disconnect-called', { status: this.status, reconnectCount: this.reconnectCount });
    this.logger.write({
      level: 'INFO',
      category: 'TRANSPORT',
      code: 'DISCONNECT',
      message: 'Transport disconnected by user',
    });
    this.intentionalDisconnect = true;
    this.activeConfig = null;
    this.connectAttempt++;
    this.clearReconnectTimer();
    this.teardownRuntime();
  }

  private teardownRuntime() {
    devLog('teardown-runtime', {
      watchdog: Boolean(this.watchdog),
      removers: this.removers.length,
      reconnectTimer: Boolean(this.reconnectTimer),
      status: this.status,
      phase: this.phaseMachine.getSnapshot().phase,
    });
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    this.removers.forEach(remove => remove());
    this.removers = [];
    this.manager.disconnect();
    this.lastHeartbeatAt = 0;
    this.heartbeatMonitor.reset();
    this.previousTraffic = { packetsRx: 0, packetsLost: 0 };
    this.packetLossPct = null;
    this.state = emptyTelemetry();
    this.emitTelemetry();
    this.phaseMachine.close('Disconnected');
    this.setLink({ network: 'DISCONNECTED', mavlink: 'IDLE', vehicle: 'NO_VEHICLE', error: null });
    this.setStatus('DISCONNECTED');
    this.refreshHealth(true);
  }

  getStatus() { return this.status; }
  getState() { return { ...this.state }; }
  getLinkState() { return { ...this.linkState }; }
  getHealth() { return { ...this.health }; }
  getConnectionPhase() { return this.phaseMachine.getSnapshot(); }
  getDiagnostics() {
    return {
      phase: this.phaseMachine.getSnapshot(),
      parser: this.manager.getParserDiagnostics(),
      traffic: this.manager.getTrafficDiagnostics(),
      transport: this.manager.getTransportDiagnostics(),
      selectedTransport: this.activeConfig?.type ?? null,
      reconnectCount: this.reconnectCount,
      health: this.getHealth(),
      vehicles: this.manager.getVehicles(),
      logs: this.logger.list(),
    };
  }
  isVehicleFresh() {
    return this.status === 'CONNECTED'
      && this.health.controlAvailable
      && this.health.vehicleStatus === 'AVAILABLE'
      && this.lastHeartbeatAt > 0;
  }
  onTelemetry(listener: TelemetryListener) { this.telemetryListeners.add(listener); return () => this.telemetryListeners.delete(listener); }
  onStatusChange(listener: StatusListener) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  onLinkState(listener: (state: UniversalLinkState) => void) { this.linkListeners.add(listener); return () => this.linkListeners.delete(listener); }
  onHealth(listener: (health: ConnectionHealthSnapshot) => void) { this.healthListeners.add(listener); return () => this.healthListeners.delete(listener); }
  onHeartbeat(listener: (timestamp: number) => void) { this.heartbeatListeners.add(listener); return () => this.heartbeatListeners.delete(listener); }
  onCommandAck(listener: (ack: MavlinkCommandAck) => void) { this.ackListeners.add(listener); return () => this.ackListeners.delete(listener); }
  onStatusText(listener: (message: MavlinkStatusText) => void) { this.statusTextListeners.add(listener); return () => this.statusTextListeners.delete(listener); }
  onMavlinkPacket(listener: (event: MavlinkPacketEvent) => void) { return this.manager.onPacket(listener); }
  getMavlinkTrafficDiagnostics(): MavlinkTrafficDiagnostics { return this.manager.getTrafficDiagnostics(); }
  getMavlinkSessionId() { return this.manager.getTrafficDiagnostics().sessionId; }

  async sendMavlinkCommand(command: number, params: number[] = []) {
    if (!this.isVehicleFresh()) return Promise.reject(new Error('NO_FRESH_VEHICLE'));
    const sentAt = Date.now();
    this.logger.write({ level: 'INFO', category: 'COMMAND', code: 'COMMAND_SENT', message: `MAV_CMD ${command} sent` });
    try {
      const ack = await this.manager.sendCommandLongAwaitAck(command, params);
      this.lastAckLatencyMs = Math.max(0, ack.receivedAt - sentAt);
      this.logger.write({
        level: 'INFO',
        category: 'COMMAND',
        code: 'COMMAND_ACK',
        message: `MAV_CMD ${command} ACK ${ack.result}`,
        context: { command, result: ack.result, latencyMs: this.lastAckLatencyMs },
      });
      this.refreshHealth(true);
      return ack;
    } catch (error) {
      const code = error instanceof Error && error.message === 'COMMAND_TIMEOUT' ? 'COMMAND_TIMEOUT' : 'COMMAND_FAILED';
      this.logger.write({ level: 'WARN', category: 'COMMAND', code, message: `MAV_CMD ${command} ${code.toLowerCase()}` });
      throw error;
    }
  }
  sendMavlinkMode(customMode: number) { return this.sendMavlinkCommand(176, [1, customMode]); }
  sendPilotControl(input: FlightControlInput, options: { finalNeutral?: boolean } = {}) {
    if (!this.isVehicleFresh()) return Promise.reject(new Error('JOYSTICK_LINK_NOT_FRESH'));
    return this.manager.sendManualControl(input, options);
  }

  setVideoAvailable(available: boolean) {
    if (this.health.videoAvailable === available) return;
    this.health = { ...this.health, videoAvailable: available, updatedAt: Date.now() };
    this.emitHealth();
  }

  handleNetworkChange(snapshot: NetworkSnapshot, previous?: NetworkSnapshot) {
    this.networkSnapshot = { ...snapshot };
    const pathChanged = previous?.type != null && snapshot.type != null && previous.type !== snapshot.type;
    if (snapshot.isConnected === false) {
      this.logger.write({ level: 'WARN', category: 'LIFECYCLE', code: 'NETWORK_LOST', message: 'Device network unavailable' });
      this.refreshHealth(true);
      this.scheduleReconnect('Network unavailable');
      return;
    }
    if ((previous?.isConnected === false || pathChanged) && this.activeConfig && !this.intentionalDisconnect) {
      this.logger.write({
        level: 'INFO',
        category: 'LIFECYCLE',
        code: pathChanged ? 'NETWORK_CHANGED' : 'NETWORK_RECOVERED',
        message: pathChanged ? `Network path changed to ${snapshot.type ?? 'unknown'}` : 'Device network recovered',
      });
      this.reconnectNow(pathChanged ? 'Network path changed' : 'Network recovered');
      return;
    }
    this.refreshHealth(true);
  }

  validateConnectionOnForeground() {
    if (!this.activeConfig || this.intentionalDisconnect) return;
    const transportReady = this.manager.getTransportDiagnostics()?.status === 'READY';
    const heartbeat = this.heartbeatMonitor.getSnapshot();
    if (!transportReady || heartbeat.health === 'CRITICAL' || heartbeat.health === 'LOST' || heartbeat.health === 'NO_HEARTBEAT') {
      this.logger.write({ level: 'INFO', category: 'LIFECYCLE', code: 'FOREGROUND_REVALIDATE', message: 'Revalidating vehicle link after foreground' });
      this.reconnectNow('Foreground validation');
    } else {
      this.refreshHealth(true);
    }
  }
  uploadMission(items: MissionItemInt[], progress?: (value: number) => void) {
    if (!this.isVehicleFresh()) return Promise.reject(new Error('NO_FRESH_VEHICLE'));
    return this.missionService.upload(items, progress);
  }
  downloadMission(progress?: (value: number) => void) {
    if (!this.isVehicleFresh()) return Promise.reject(new Error('NO_FRESH_VEHICLE'));
    return this.missionService.download(progress);
  }
  clearVehicleMission() {
    if (!this.isVehicleFresh()) return Promise.reject(new Error('NO_FRESH_VEHICLE'));
    return this.missionService.clear();
  }

  requestHomePosition() {
    if (!this.isVehicleFresh()) return Promise.reject(new Error('NO_FRESH_VEHICLE'));
    // MAV_CMD_REQUEST_MESSAGE (512), param1 = 242 (HOME_POSITION)
    return this.sendMavlinkCommand(512, [242, 0, 0, 0, 0, 0, 0]);
  }

  private handleHeartbeat(timestamp: number) {
    if (this.reconnectTimer) {
      this.clearReconnectTimer();
    }
    this.lastHeartbeatAt = this.now();
    this.heartbeatMonitor.recordHeartbeat(timestamp);
    this.reconnectAttemptStreak = 0;
    this.state.lastHeartbeatAt = timestamp;
    this.state.stale = false;
    const phase = this.phaseMachine.getSnapshot().phase;
    if (phase === 'OPENING_TRANSPORT') this.transition('TRANSPORT_READY', 'Data arrived while opening');
    if (this.phaseMachine.getSnapshot().phase === 'TRANSPORT_READY') this.transition('WAITING_HEARTBEAT', 'Waiting for heartbeat');
    if (this.phaseMachine.getSnapshot().phase === 'WAITING_HEARTBEAT') this.transition('VEHICLE_DETECTED', 'Vehicle heartbeat received');
    if (this.phaseMachine.getSnapshot().phase === 'VEHICLE_DETECTED' || this.phaseMachine.getSnapshot().phase === 'DEGRADED') {
      this.transition('LINK_ACTIVE', 'Heartbeat fresh');
    }
    if (this.phaseMachine.getSnapshot().phase === 'RECONNECTING') {
      this.transition('LINK_ACTIVE', 'Heartbeat recovered before reconnect');
    }
    this.setLink({ network: 'BOUND', mavlink: 'ACTIVE', vehicle: 'CONNECTED', error: null });
    this.setStatus('CONNECTED');
    this.manager.setTelemetryRatePolicy('FULL');
    const prevMavlinkStatus = this.health.mavlinkStatus;
    if (prevMavlinkStatus === 'HEARTBEAT_STALE' || prevMavlinkStatus === 'LOST') {
      this.logger.write({
        level: 'INFO',
        category: 'MAVLINK',
        code: 'HEARTBEAT_RECOVERED',
        message: 'Vehicle heartbeat recovered',
      });
    }
    this.refreshHealth(true);
    devLog('heartbeat-ok', {
      heartbeatAgeMs: Date.now() - timestamp,
      phase: this.phaseMachine.getSnapshot().phase,
      reconnectCount: this.reconnectCount,
      link: this.linkState,
    });
    this.heartbeatListeners.forEach(listener => listener(timestamp));
  }

  private updateFromMavlink(raw: MavlinkVehicleState, config?: Partial<ConnectionConfig>) {
    const stale = raw.lastHeartbeatAt === null || Date.now() - raw.lastHeartbeatAt > this.heartbeatTimeoutMs;
    const positionAt = raw.messageTimestamps[33] ?? 0;
    const gpsStatusAt = raw.messageTimestamps[24] ?? 0;
    const gpsTimestamp = positionAt && gpsStatusAt ? Math.min(positionAt, gpsStatusAt) : positionAt || gpsStatusAt;
    this.state = {
      latitude: raw.latitude,
      longitude: raw.longitude,
      altitude: raw.altitude,
      altitudeMsl: raw.altitudeMsl,
      relativeAltitude: raw.relativeAltitude,
      speed: raw.speed,
      climb: raw.climb,
      battery: raw.battery, mode: raw.mode, armed: raw.armed, timestamp: raw.receivedAt ?? 0,
      roll: raw.roll, pitch: raw.pitch, yaw: raw.yaw, heading: raw.heading,
      satellites: raw.satellites, gpsFix: raw.gpsFix, hdop: raw.hdop,
      voltage: raw.voltage, current: raw.current, sensors: parseSensors(raw.sensorsPresent, raw.sensorsEnabled, raw.sensorsHealth),
      homeLatitude: raw.homeLatitude,
      homeLongitude: raw.homeLongitude,
      homeAltitude: raw.homeAltitude,
      homeUpdatedAt: raw.homeUpdatedAt,
      gpsTimestamp,
      attitudeTimestamp: raw.messageTimestamps[30] ?? 0,
      velocityTimestamp: Math.max(raw.messageTimestamps[33] ?? 0, raw.messageTimestamps[74] ?? 0),
      batteryTimestamp: raw.batteryUpdatedAt ?? 0,
      vehicleType: config?.vehicleType ?? 'GENERIC',
      vehicleName: raw.systemId === null ? 'NO VEHICLE' : `MAVLink SYS ${raw.systemId}`,
      autopilot: config?.autopilot ?? 'ARDUPILOT', bytesRx: raw.bytesRx, bytesTx: raw.bytesTx,
      packetsPerSec: raw.packetsPerSec, packetsLost: raw.packetsLost, packetsTx: raw.packetsTx,
      rxPacketsPerSec: raw.rxPacketsPerSec, txPacketsPerSec: raw.txPacketsPerSec,
      rxBytesPerSec: raw.rxBytesPerSec, txBytesPerSec: raw.txBytesPerSec,
      mavlinkVersion: raw.mavlinkVersion, latencyMs: null,
      lastHeartbeatAt: raw.lastHeartbeatAt, stale,
    };
    if (!stale && this.lastHeartbeatAt && this.status !== 'CONNECTED') {
      this.setLink({ network: 'BOUND', mavlink: 'ACTIVE', vehicle: 'CONNECTED', error: null });
      this.setStatus('CONNECTED');
    }

    if (raw.landingTargetUpdatedAt && Date.now() - raw.landingTargetUpdatedAt < 5000) {
      precisionLandingAdvisor.updateTargetState({
        targetFound: true,
        tagId: raw.landingTargetNum,
        offsetXCentimeters: raw.landingTargetDistanceM != null && raw.landingTargetAngleX != null
          ? Math.sin(raw.landingTargetAngleX) * raw.landingTargetDistanceM * 100
          : null,
        offsetYCentimeters: raw.landingTargetDistanceM != null && raw.landingTargetAngleY != null
          ? Math.sin(raw.landingTargetAngleY) * raw.landingTargetDistanceM * 100
          : null,
        altitudeMeters: raw.landingTargetDistanceM,
        confidence: null,
        timestamp: raw.landingTargetUpdatedAt,
      });
    } else {
      precisionLandingAdvisor.updateTargetState({
        targetFound: false,
        tagId: null,
        offsetXCentimeters: null,
        offsetYCentimeters: null,
        altitudeMeters: null,
        confidence: null,
      });
    }

    this.emitTelemetry();
  }

  private checkHeartbeat() {
    const current = this.now();
    if (this.lastWatchdogTime > 0) {
      const lag = current - this.lastWatchdogTime - 250;
      if (lag > 500) { // If event loop was blocked > 500ms
        this.logger.write({ level: 'WARN', category: 'TRANSPORT', code: 'JS_LAG', message: `JS Event loop blocked for ${Math.round(lag)}ms` });
        this.lastWatchdogTime = current;
        return; // Skip this check to avoid false heartbeat lost
      }
    }
    this.lastWatchdogTime = current;

    const previousHealth = this.health.mavlinkStatus;
    const heartbeat = this.heartbeatMonitor.getSnapshot(Date.now());
    this.refreshHealth();
    if (heartbeat.health === 'NO_HEARTBEAT' || heartbeat.health === 'HEALTHY') return;

    if (heartbeat.health === 'DEGRADED') {
      if (this.phaseMachine.getSnapshot().phase === 'LINK_ACTIVE') this.transition('DEGRADED', 'Heartbeat delayed');
      this.manager.setTelemetryRatePolicy('DEGRADED');
      if (previousHealth !== 'HEARTBEAT_STALE') {
        this.logger.write({ level: 'WARN', category: 'MAVLINK', code: 'LINK_DEGRADED', message: 'Vehicle heartbeat delayed' });
      }
      return;
    }

    this.state.stale = true;
    this.emitTelemetry();
    this.manager.setTelemetryRatePolicy('ESSENTIAL');
    this.setLink({ network: 'BOUND', mavlink: 'HEARTBEAT_LOST', vehicle: 'STALE', error: 'HEARTBEAT_STALE' });
    if (heartbeat.health === 'CRITICAL') {
      if (previousHealth !== 'HEARTBEAT_STALE') {
        this.logger.write({ level: 'WARN', category: 'MAVLINK', code: 'LINK_CRITICAL', message: 'Vehicle heartbeat critically delayed' });
      }
      return;
    }

    if (previousHealth !== 'LOST') {
      devLog('heartbeat-lost', { ageMs: heartbeat.heartbeatAgeMs, timeoutMs: this.heartbeatTimeoutMs, phase: this.phaseMachine.getSnapshot().phase });
      this.logger.write({ level: 'ERROR', category: 'MAVLINK', code: 'HEARTBEAT_LOST', message: 'Vehicle heartbeat timed out' });
    }
    this.scheduleReconnect('Heartbeat timeout');
  }

  private fail(error: string) {
    devLog('fail', { error, phase: this.phaseMachine.getSnapshot().phase, reconnectEnabled: this.reconnectEnabled });
    const phase = this.phaseMachine.getSnapshot().phase;
    if (phase !== 'ERROR' && phase !== 'CLOSING') this.transition('ERROR', error);
    this.logger.write({ level: 'ERROR', category: 'TRANSPORT', code: 'CONNECTION_FAILED', message: error });
    this.state.stale = this.state.timestamp > 0;
    this.emitTelemetry();
    this.setLink({ network: 'ERROR', mavlink: this.lastHeartbeatAt ? 'HEARTBEAT_LOST' : 'WAITING_HEARTBEAT', vehicle: this.lastHeartbeatAt ? 'STALE' : 'NO_VEHICLE', error });
    this.setStatus('ERROR');
    this.scheduleReconnect(error);
  }

  private scheduleReconnect(reason: string) {
    if (this.intentionalDisconnect || !this.activeConfig || !this.reconnectEnabled || this.reconnectTimer) return;
    const phase = this.phaseMachine.getSnapshot().phase;
    if (phase === 'ERROR' || phase === 'DEGRADED') this.transition('RECONNECTING', reason);
    this.setStatus('CONNECTING');
    this.refreshHealth(true);
    if (this.networkSnapshot.isConnected === false) return;
    const config = this.activeConfig;
    const delayMs = this.reconnectPolicy.delayForAttempt(this.reconnectAttemptStreak, this.reconnectDelayMs);
    this.logger.write({
      level: 'INFO',
      category: 'TRANSPORT',
      code: 'RECONNECT',
      message: `Scheduling reconnect in ${delayMs}ms: ${reason} (attempt ${this.reconnectAttemptStreak + 1})`,
    });
    devLog('schedule-reconnect', { reason, delayMs, reconnectAttemptStreak: this.reconnectAttemptStreak, reconnectCount: this.reconnectCount });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.intentionalDisconnect || this.activeConfig !== config) return;
      this.reconnectCount++;
      this.reconnectAttemptStreak++;
      devLog('reconnect-fired', { reconnectCount: this.reconnectCount, reconnectAttemptStreak: this.reconnectAttemptStreak });
      this.openConnection(config, true);
    }, delayMs);
  }

  private reconnectNow(reason: string) {
    if (this.intentionalDisconnect || !this.activeConfig || !this.reconnectEnabled) return;
    if (this.networkSnapshot.isConnected === false) {
      this.scheduleReconnect(reason);
      return;
    }
    this.clearReconnectTimer();
    const phase = this.phaseMachine.getSnapshot().phase;
    if (phase === 'LINK_ACTIVE' || phase === 'DEGRADED' || phase === 'ERROR' || phase === 'WAITING_HEARTBEAT') {
      this.transition('RECONNECTING', reason);
    }
    this.reconnectCount++;
    this.reconnectAttemptStreak++;
    this.logger.write({
      level: 'INFO',
      category: 'TRANSPORT',
      code: 'RECONNECT',
      message: `Reconnecting immediately: ${reason} (streak ${this.reconnectAttemptStreak})`,
    });
    this.setStatus('CONNECTING');
    this.refreshHealth(true);
    void this.openConnection(this.activeConfig, true);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) devLog('clear-reconnect-timer', { reconnectCount: this.reconnectCount });
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private refreshHealth(force = false) {
    const now = Date.now();
    if (!force && now - this.lastHealthEmitAt < 250) return;
    const heartbeat = this.heartbeatMonitor.getSnapshot(now);
    const traffic = this.manager.getTrafficDiagnostics();
    const packetDelta = traffic.packetsRx - this.previousTraffic.packetsRx;
    const lossDelta = traffic.packetsLost - this.previousTraffic.packetsLost;
    if (packetDelta > 0 || lossDelta > 0) {
      this.packetLossPct = Math.max(0, Math.min(100, (lossDelta / Math.max(1, packetDelta + lossDelta)) * 100));
      this.previousTraffic = { packetsRx: traffic.packetsRx, packetsLost: traffic.packetsLost };
    }
    const transport = this.manager.getTransportDiagnostics();
    const transportConnected = transport?.status === 'READY';
    const quality = this.linkQualityService.calculate({
      transportConnected,
      heartbeat,
      packetLossPct: this.packetLossPct,
      ackLatencyMs: this.lastAckLatencyMs,
      rttMs: null,
    });
    const phase = this.phaseMachine.getSnapshot().phase;
    const networkStatus = this.networkSnapshot.isConnected === false
      ? 'DISCONNECTED'
      : phase === 'RECONNECTING'
        ? 'RECONNECTING'
        : this.status === 'CONNECTING'
          ? 'CONNECTING'
          : transportConnected
            ? (quality.quality === 'POOR' || quality.quality === 'CRITICAL' && heartbeat.health !== 'NO_HEARTBEAT' ? 'DEGRADED' : 'CONNECTED')
            : 'DISCONNECTED';
    const mavlinkStatus = !transportConnected
      ? 'NO_HEARTBEAT'
      : heartbeat.health === 'NO_HEARTBEAT'
        ? 'WAITING'
        : heartbeat.health === 'HEALTHY'
          ? 'HEARTBEAT_OK'
          : heartbeat.health === 'LOST'
            ? 'LOST'
            : 'HEARTBEAT_STALE';
    const vehicleStatus = heartbeat.health === 'NO_HEARTBEAT'
      ? 'NO_VEHICLE'
      : heartbeat.health === 'CRITICAL' || heartbeat.health === 'LOST'
        ? 'UNRESPONSIVE'
        : 'AVAILABLE';
    const controlStatus = heartbeat.health === 'HEALTHY'
      ? 'READY'
      : heartbeat.health === 'DEGRADED'
        ? 'DEGRADED'
        : heartbeat.health === 'CRITICAL' || heartbeat.health === 'LOST'
          ? 'LOST'
          : 'DISABLED';
    const next: ConnectionHealthSnapshot = {
      networkStatus,
      mavlinkStatus,
      vehicleStatus,
      controlStatus,
      linkQuality: quality.quality,
      linkQualityScore: quality.score,
      rttMs: null,
      jitterMs: heartbeat.jitterMs,
      packetLossPct: this.packetLossPct,
      lastHeartbeatAt: heartbeat.lastHeartbeatAt,
      heartbeatAgeMs: heartbeat.heartbeatAgeMs,
      heartbeatIntervalMs: heartbeat.heartbeatIntervalMs,
      missedHeartbeatCount: heartbeat.missedHeartbeatCount,
      lastAckLatencyMs: this.lastAckLatencyMs,
      reconnectCount: this.reconnectCount,
      transport: transport?.kind ?? null,
      transportStatus: transport?.status ?? null,
      rxPacketsPerSec: traffic.rxPacketsPerSec,
      txPacketsPerSec: traffic.txPacketsPerSec,
      controlAvailable: controlStatus === 'READY' || controlStatus === 'DEGRADED',
      videoAvailable: this.health.videoAvailable,
      videoQualityPolicy: quality.videoPolicy,
      networkType: this.networkSnapshot.type,
      internetReachable: this.networkSnapshot.isInternetReachable,
      updatedAt: now,
    };
    const statusChanged = next.controlStatus !== this.health.controlStatus || next.linkQuality !== this.health.linkQuality;
    const prevControl = this.health.controlAvailable;
    const nextControl = next.controlAvailable;
    if (!prevControl && nextControl) {
      this.logger.write({
        level: 'INFO',
        category: 'VEHICLE',
        code: 'CONTROL_ENABLED',
        message: `Control link enabled (${next.controlStatus})`,
      });
    } else if (prevControl && !nextControl) {
      this.logger.write({
        level: 'WARN',
        category: 'VEHICLE',
        code: 'CONTROL_DISABLED',
        message: `Control link disabled (${next.controlStatus})`,
      });
    }
    this.health = next;
    this.lastHealthEmitAt = now;
    this.emitHealth();
    if (statusChanged) {
      devLog('health', {
        network: next.networkStatus,
        mavlink: next.mavlinkStatus,
        vehicle: next.vehicleStatus,
        control: next.controlStatus,
        quality: next.linkQuality,
        score: next.linkQualityScore,
      });
    }
  }

  private emitHealth() {
    const snapshot = this.getHealth();
    this.healthListeners.forEach(listener => listener(snapshot));
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string) {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(code)), timeoutMs);
      promise.then(
        value => { clearTimeout(timeout); resolve(value); },
        error => { clearTimeout(timeout); reject(error); },
      );
    });
  }
  private emitTelemetry() { this.telemetryListeners.forEach(listener => listener({ ...this.state })); }
  private setStatus(status: UniversalConnectionStatus) {
    if (this.status === status) return;
    devLog('status', { previous: this.status, next: status });
    this.status = status;
    this.statusListeners.forEach(listener => listener(status));
  }
  private setLink(state: Omit<UniversalLinkState, 'phase'>) {
    this.linkState = { ...state, phase: this.phaseMachine.getSnapshot().phase };
    devLog('link', { ...this.linkState });
    this.linkListeners.forEach(listener => listener({ ...this.linkState }));
  }
  private transition(phase: ConnectionPhase, reason: string) {
    const snapshot = this.phaseMachine.transition(phase, reason);
    devLog('phase', { previous: snapshot.previous, next: snapshot.phase, reason });
    this.linkState.phase = snapshot.phase;
    this.logger.write({
      level: phase === 'ERROR' || phase === 'DEGRADED' ? 'WARN' : 'INFO',
      category: 'STATE',
      code: `STATE_${phase}`,
      message: reason,
      context: { previous: snapshot.previous },
    });
  }
}

export const universalConnectionService = new UniversalConnectionService();
