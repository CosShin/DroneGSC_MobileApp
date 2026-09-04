import { FlightControlInput } from '../../types/joystick';
import {
  encodeMavlinkV2,
  MavlinkFrame,
  MavlinkParser,
  MavlinkParserDiagnostics,
} from './MavlinkProtocol';
import { MavlinkTransport, TransportDiagnostics, TransportEndpoint, TransportRemoteInfo } from './MavlinkTransport';
import { getArduCopterModeName } from './ArduPilotModes';
import { MavlinkSigningSession } from './MavlinkSigning';

export interface MavlinkCommandAck {
  command: number;
  result: number;
  progress: number | null;
  resultParam2: number | null;
  sourceSystemId: number;
  sourceComponentId: number;
  targetSystemId: number | null;
  targetComponentId: number | null;
  sessionId: number;
  receivedAt: number;
}

export interface MavlinkStatusText {
  severity: number;
  text: string;
  id: number | null;
  chunkSequence: number | null;
  receivedAt: number;
}

export interface DetectedMavlinkVehicle {
  systemId: number;
  componentId: number;
  mavType: number;
  autopilotType: number;
  lastHeartbeatAt: number;
  remote: TransportRemoteInfo;
  selected: boolean;
}

export interface MavlinkVehicleState {
  systemId: number | null; componentId: number | null; armed: boolean; mode: string;
  systemStatus: number | null; latitude: number | null; longitude: number | null;
  altitude: number | null; altitudeMsl: number | null; relativeAltitude: number | null;
  speed: number | null; climb: number | null;
  roll: number | null; pitch: number | null; yaw: number | null; heading: number | null;
  satellites: number | null; gpsFix: number | null; hdop: number | null;
  voltage: number | null; current: number | null; battery: number | null;
  batteryUpdatedAt: number | null;
  sensorsPresent: number | null; sensorsEnabled: number | null; sensorsHealth: number | null;
  homeLatitude: number | null; homeLongitude: number | null; homeAltitude: number | null;
  homeUpdatedAt: number | null;
  rcRssi: number | null; distanceSensorM: number | null; opticalFlowQuality: number | null;
  opticalFlowGroundDistanceM: number | null; missionCurrent: number | null;
  missionReached: number | null; lastStatusText: MavlinkStatusText | null;
  landingTargetDistanceM: number | null; landingTargetAngleX: number | null;
  landingTargetAngleY: number | null; landingTargetNum: number | null;
  landingTargetUpdatedAt: number | null;
  lastHeartbeatAt: number | null; receivedAt: number | null;
  messageTimestamps: Record<number, number>; bytesRx: number; bytesTx: number;
  packetsRx: number; packetsLost: number; packetsPerSec: number;
  packetsTx: number; rxPacketsPerSec: number; txPacketsPerSec: number;
  rxBytesPerSec: number; txBytesPerSec: number; mavlinkVersion: 1 | 2 | null;
}

export interface MavlinkPacketEvent {
  direction: 'RX' | 'TX';
  timestamp: number;
  sessionId: number;
  frame: MavlinkFrame;
}

export interface MavlinkTrafficDiagnostics {
  sessionId: number;
  systemId: number | null;
  componentId: number | null;
  packetsRx: number;
  packetsTx: number;
  rxPacketsPerSec: number;
  txPacketsPerSec: number;
  bytesRx: number;
  bytesTx: number;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  packetsLost: number;
  mavlinkVersion: 1 | 2 | null;
  parser: MavlinkParserDiagnostics;
}

const emptyState = (): MavlinkVehicleState => ({
  systemId: null, componentId: null, armed: false, mode: 'UNKNOWN', systemStatus: null,
  latitude: null, longitude: null, altitude: null, altitudeMsl: null, relativeAltitude: null,
  speed: null, climb: null,
  roll: null, pitch: null, yaw: null, heading: null, satellites: null, gpsFix: null,
  hdop: null, voltage: null, current: null, battery: null, batteryUpdatedAt: null,
  sensorsPresent: null, sensorsEnabled: null, sensorsHealth: null,
  homeLatitude: null, homeLongitude: null, homeAltitude: null, homeUpdatedAt: null,
  rcRssi: null, distanceSensorM: null,
  opticalFlowQuality: null, opticalFlowGroundDistanceM: null, missionCurrent: null,
  missionReached: null, lastStatusText: null,
  landingTargetDistanceM: null, landingTargetAngleX: null,
  landingTargetAngleY: null, landingTargetNum: null,
  landingTargetUpdatedAt: null,
  lastHeartbeatAt: null, receivedAt: null,
  messageTimestamps: {}, bytesRx: 0, bytesTx: 0, packetsRx: 0, packetsLost: 0,
  packetsPerSec: 0, packetsTx: 0, rxPacketsPerSec: 0, txPacketsPerSec: 0,
  rxBytesPerSec: 0, txBytesPerSec: 0, mavlinkVersion: null,
});

interface BatterySample {
  percentage: number | null;
  voltage: number | null;
  current: number | null;
  receivedAt: number;
}

const PRIMARY_AUTOPILOT_COMPONENT_ID = 1;
const BATTERY_SOURCE_FRESH_MS = 3_000;

export class MavlinkManager {
  private parser = new MavlinkParser();
  private transport: MavlinkTransport | null = null;
  private state = emptyState();
  private sequence = 0;
  private packetsThisSecond = 0;
  private txPacketsThisSecond = 0;
  private rxBytesThisSecond = 0;
  private txBytesThisSecond = 0;
  private sessionId = 0;
  private statsLogTick = 0;
  private intervalsRequested = false;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEmitAt = 0;
  private gcsHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private removeDataListener: (() => void) | null = null;
  private removeErrorListener: (() => void) | null = null;
  private stateListeners = new Set<(state: MavlinkVehicleState) => void>();
  private heartbeatListeners = new Set<(timestamp: number) => void>();
  private ackListeners = new Set<(ack: MavlinkCommandAck) => void>();
  private statusTextListeners = new Set<(message: MavlinkStatusText) => void>();
  private missionFrameListeners = new Set<(frame: MavlinkFrame) => void>();
  private errorListeners = new Set<(error: Error) => void>();
  private lastSequenceBySource = new Map<string, number>();
  private vehicles = new Map<string, DetectedMavlinkVehicle>();
  private vehicleListeners = new Set<(vehicles: DetectedMavlinkVehicle[]) => void>();
  private packetListeners = new Set<(event: MavlinkPacketEvent) => void>();
  private pendingAckKeys = new Set<string>();
  private vehicleSelectionExplicit = false;
  private sysBatterySample: BatterySample | null = null;
  private batteryStatusSamples = new Map<number, BatterySample>();
  private primaryBatteryId: number | null = null;
  private signing: MavlinkSigningSession | null = null;

  configureSigning(session: MavlinkSigningSession | null) {
    if (this.transport) throw new Error('SIGNING_CHANGE_REQUIRES_DISCONNECT');
    this.signing = session;
    this.parser.setSigning(session);
  }

  async connect(transport: MavlinkTransport, endpoint: TransportEndpoint) {
    this.disconnect();
    this.sessionId++;
    this.transport = transport;
    this.removeDataListener = transport.onData((data, remote) => this.handleDatagram(data, remote));
    this.removeErrorListener = transport.onError(error => {
      console.warn('[MAVLink transport]', error.message);
      this.errorListeners.forEach(listener => listener(error));
    });
    await transport.connect(endpoint);
    console.log('[MAVLink] transport ready; waiting for vehicle heartbeat');
    const sendHeartbeat = () => {
      this.sendGcsHeartbeat().catch(error => {
        console.warn('[MAVLink] GCS heartbeat send failed', error);
      });
    };
    sendHeartbeat();
    this.gcsHeartbeatTimer = setInterval(sendHeartbeat, 1000);
    this.statsTimer = setInterval(() => {
      this.state.packetsPerSec = this.packetsThisSecond;
      this.state.rxPacketsPerSec = this.packetsThisSecond;
      this.state.txPacketsPerSec = this.txPacketsThisSecond;
      this.state.rxBytesPerSec = this.rxBytesThisSecond;
      this.state.txBytesPerSec = this.txBytesThisSecond;
      this.packetsThisSecond = 0;
      this.txPacketsThisSecond = 0;
      this.rxBytesThisSecond = 0;
      this.txBytesThisSecond = 0;
      this.statsLogTick++;
      if (this.statsLogTick % 5 === 0) {
        const now = Date.now();
        const heartbeatAge = this.state.lastHeartbeatAt === null ? '--' : `${now - this.state.lastHeartbeatAt}ms`;
        const attitudeAt = this.state.messageTimestamps[30];
        const attitudeAge = attitudeAt === undefined ? '--' : `${now - attitudeAt}ms`;
        const roll = this.state.roll === null ? '--' : this.state.roll.toFixed(1);
        const pitch = this.state.pitch === null ? '--' : this.state.pitch.toFixed(1);
        console.log(`[MAVLink] RX ${this.state.packetsPerSec}pps heartbeatAge=${heartbeatAge} attitudeAge=${attitudeAge} roll=${roll} pitch=${pitch}`);
      }
      this.emit();
    }, 1000);
  }

  disconnect() {
    if (this.gcsHeartbeatTimer) clearInterval(this.gcsHeartbeatTimer);
    this.gcsHeartbeatTimer = null;
    this.transport?.disconnect();
    this.transport = null;
    this.removeDataListener?.(); this.removeDataListener = null;
    this.removeErrorListener?.(); this.removeErrorListener = null;
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;
    if (this.emitTimer) clearTimeout(this.emitTimer);
    this.emitTimer = null;
    this.lastEmitAt = 0;
    this.statsLogTick = 0;
    this.packetsThisSecond = 0;
    this.txPacketsThisSecond = 0;
    this.rxBytesThisSecond = 0;
    this.txBytesThisSecond = 0;
    this.parser = new MavlinkParser();
    this.parser.setSigning(this.signing);
    this.parser.setRawCaptureEnabled(this.packetListeners.size > 0);
    this.state = emptyState();
    this.intervalsRequested = false;
    this.lastSequenceBySource.clear();
    this.vehicles.clear();
    this.pendingAckKeys.clear();
    this.vehicleSelectionExplicit = false;
    this.sysBatterySample = null;
    this.batteryStatusSamples.clear();
    this.primaryBatteryId = null;
    this.emitVehicles();
  }

  getState() { return { ...this.state, messageTimestamps: { ...this.state.messageTimestamps } }; }
  getSessionId() { return this.sessionId; }
  getParserDiagnostics(): MavlinkParserDiagnostics { return this.parser.getDiagnostics(); }
  getTransportDiagnostics(): TransportDiagnostics | null { return this.transport?.getDiagnostics?.() ?? null; }
  getTrafficDiagnostics(): MavlinkTrafficDiagnostics {
    return {
      sessionId: this.sessionId,
      systemId: this.state.systemId,
      componentId: this.state.componentId,
      packetsRx: this.state.packetsRx,
      packetsTx: this.state.packetsTx,
      rxPacketsPerSec: this.state.rxPacketsPerSec,
      txPacketsPerSec: this.state.txPacketsPerSec,
      bytesRx: this.state.bytesRx,
      bytesTx: this.state.bytesTx,
      rxBytesPerSec: this.state.rxBytesPerSec,
      txBytesPerSec: this.state.txBytesPerSec,
      packetsLost: this.state.packetsLost,
      mavlinkVersion: this.state.mavlinkVersion,
      parser: this.parser.getDiagnostics(),
    };
  }
  getVehicles() { return this.vehicleSnapshot(); }
  onState(listener: (state: MavlinkVehicleState) => void) { this.stateListeners.add(listener); return () => this.stateListeners.delete(listener); }
  onHeartbeat(listener: (timestamp: number) => void) { this.heartbeatListeners.add(listener); return () => this.heartbeatListeners.delete(listener); }
  onCommandAck(listener: (ack: MavlinkCommandAck) => void) { this.ackListeners.add(listener); return () => this.ackListeners.delete(listener); }
  onStatusText(listener: (message: MavlinkStatusText) => void) { this.statusTextListeners.add(listener); return () => this.statusTextListeners.delete(listener); }
  onMissionFrame(listener: (frame: MavlinkFrame) => void) { this.missionFrameListeners.add(listener); return () => this.missionFrameListeners.delete(listener); }
  onError(listener: (error: Error) => void) { this.errorListeners.add(listener); return () => this.errorListeners.delete(listener); }
  onVehiclesChanged(listener: (vehicles: DetectedMavlinkVehicle[]) => void) { this.vehicleListeners.add(listener); return () => this.vehicleListeners.delete(listener); }
  onPacket(listener: (event: MavlinkPacketEvent) => void) {
    this.packetListeners.add(listener);
    this.parser.setRawCaptureEnabled(true);
    return () => {
      this.packetListeners.delete(listener);
      this.parser.setRawCaptureEnabled(this.packetListeners.size > 0);
    };
  }

  selectVehicle(systemId: number, componentId: number) {
    const selected = this.vehicles.get(`${systemId}:${componentId}`);
    if (!selected) throw new Error('VEHICLE_NOT_DISCOVERED');
    this.state.systemId = systemId;
    this.state.componentId = componentId;
    this.state.lastHeartbeatAt = selected.lastHeartbeatAt;
    this.intervalsRequested = false;
    this.vehicleSelectionExplicit = true;
    this.transport?.setRemoteEndpoint?.(selected.remote);
    this.emitVehicles();
  }

  async sendCommandLong(command: number, params: number[] = []) {
    if (this.state.systemId === null || this.state.componentId === null) throw new Error('NO_VEHICLE');
    const payload = new Uint8Array(33);
    const view = new DataView(payload.buffer);
    for (let index = 0; index < 7; index++) view.setFloat32(index * 4, params[index] ?? 0, true);
    view.setUint16(28, command, true);
    payload[30] = this.state.systemId;
    payload[31] = this.state.componentId;
    console.log(`[MAVLink] COMMAND_LONG send command=${command} target=${this.state.systemId}:${this.state.componentId}`);
    await this.sendFrame(76, payload);
  }

  sendCommandLongAwaitAck(command: number, params: number[] = [], timeoutMs = 3000) {
    if (this.state.systemId === null || this.state.componentId === null) {
      return Promise.reject(new Error('NO_VEHICLE'));
    }
    const targetSystemId = this.state.systemId;
    const targetComponentId = this.state.componentId;
    const sessionId = this.sessionId;
    const pendingKey = `${sessionId}:${targetSystemId}:${targetComponentId}:${command}`;
    if (this.pendingAckKeys.has(pendingKey)) {
      return Promise.reject(new Error('COMMAND_ALREADY_PENDING'));
    }
    this.pendingAckKeys.add(pendingKey);

    return new Promise<MavlinkCommandAck>((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout>;
      let remove = () => {};
      const cleanup = () => {
        clearTimeout(timeout);
        remove();
        this.pendingAckKeys.delete(pendingKey);
      };
      const failOnTimeout = () => { cleanup(); reject(new Error('COMMAND_TIMEOUT')); };
      remove = this.onCommandAck(ack => {
        if (ack.command !== command
          || ack.sessionId !== sessionId
          || ack.sourceSystemId !== targetSystemId
          || ack.sourceComponentId !== targetComponentId
          || (ack.targetSystemId !== null && ack.targetSystemId !== 0 && ack.targetSystemId !== 255)
          || (ack.targetComponentId !== null && ack.targetComponentId !== 0 && ack.targetComponentId !== 190)) return;
        if (ack.result === 5) {
          clearTimeout(timeout);
          timeout = setTimeout(failOnTimeout, timeoutMs);
          return;
        }
        cleanup(); resolve(ack);
      });
      timeout = setTimeout(failOnTimeout, timeoutMs);
      this.sendCommandLong(command, params).catch(error => {
        cleanup();
        reject(error);
      });
    });
  }

  async sendManualControl(input: FlightControlInput) {
    if (this.state.systemId === null) throw new Error('NO_VEHICLE');
    const payload = new Uint8Array(11);
    const view = new DataView(payload.buffer);
    const invalid = 32767;
    view.setInt16(0, input.validAxes.pitch ? Math.round(this.clamp(input.pitch, -1, 1) * 1000) : invalid, true);
    view.setInt16(2, input.validAxes.roll ? Math.round(this.clamp(input.roll, -1, 1) * 1000) : invalid, true);
    view.setInt16(4, input.validAxes.throttle ? Math.round(this.clamp(input.throttle, 0, 1) * 1000) : invalid, true);
    view.setInt16(6, input.validAxes.yaw ? Math.round(this.clamp(input.yaw, -1, 1) * 1000) : invalid, true);
    view.setUint16(8, 0, true);
    payload[10] = this.state.systemId;
    await this.sendFrame(69, payload);
  }

  getVehicleTarget() {
    if (this.state.systemId === null || this.state.componentId === null) throw new Error('NO_VEHICLE');
    return { systemId: this.state.systemId, componentId: this.state.componentId };
  }

  sendMissionFrame(messageId: number, payload: Uint8Array) { return this.sendFrame(messageId, payload); }

  private requestMessageIntervals() {
    const rates: Array<[number, number]> = [
      [0, 1_000_000], [30, 100_000], [33, 200_000], [24, 500_000], [74, 200_000],
      [1, 500_000], [147, 500_000], [65, 200_000], [132, 200_000],
      [100, 200_000], [42, 500_000], [46, 500_000],
    ];
    for (const [messageId, intervalUs] of rates) {
      this.sendCommandLong(511, [messageId, intervalUs]).catch(error => {
        console.warn(`[MAVLink] Rate request failed for ${messageId}`, error);
      });
    }
    // Home is session state, not high-rate telemetry. Fetch it once here;
    // HomeService explicitly requests it again after an accepted SET_HOME.
    this.sendCommandLong(512, [242, 0, 0, 0, 0, 0, 0]).catch(error => {
      console.warn('[MAVLink] Initial HOME_POSITION request failed', error);
    });
  }

  private async sendFrame(messageId: number, payload: Uint8Array) {
    if (!this.transport) throw new Error('TRANSPORT_NOT_CONNECTED');
    const sequence = this.sequence++ & 0xff;
    const wireFrame = encodeMavlinkV2(messageId, payload, sequence, 255, 190, this.signing);
    await this.transport.send(wireFrame);
    this.state.bytesTx += wireFrame.length;
    this.state.packetsTx++;
    this.txPacketsThisSecond++;
    this.txBytesThisSecond += wireFrame.length;
    if (this.packetListeners.size) {
      const event: MavlinkPacketEvent = {
        direction: 'TX',
        timestamp: Date.now(),
        sessionId: this.sessionId,
        frame: {
          version: 2,
          sequence,
          systemId: 255,
          componentId: 190,
          messageId,
          payload,
          rawFrame: wireFrame,
        },
      };
      this.packetListeners.forEach(listener => listener(event));
    }
  }

  private sendGcsHeartbeat() {
    const payload = new Uint8Array(9);
    payload[4] = 6; // MAV_TYPE_GCS
    payload[5] = 8; // MAV_AUTOPILOT_INVALID
    payload[7] = 4; // MAV_STATE_ACTIVE
    payload[8] = 3; // MAVLink protocol version
    return this.sendFrame(0, payload);
  }

  private handleDatagram(data: Uint8Array, remote: TransportRemoteInfo) {
    this.state.bytesRx += data.length;
    this.rxBytesThisSecond += data.length;
    const unsupportedBefore = this.parser.getDiagnostics().unsupportedFrames;
    const frames = this.transport?.kind === 'UDP'
      ? this.parser.pushDatagram(data)
      : this.parser.push(data);
    if (this.parser.getDiagnostics().unsupportedFrames > unsupportedBefore) {
      // Unknown dialect frames consume sequence numbers too. Reset the loss
      // baseline so a received-but-unsupported frame is not counted as lost.
      this.lastSequenceBySource.clear();
    }
    for (const frame of frames) {
      this.state.packetsRx++;
      this.packetsThisSecond++;
      this.decode(frame, remote);
    }
  }

  private decode(frame: MavlinkFrame, remote: TransportRemoteInfo) {
    const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);
    const now = Date.now();
    this.state.mavlinkVersion = frame.version;
    if (this.packetListeners.size) {
      const event: MavlinkPacketEvent = { direction: 'RX', timestamp: now, sessionId: this.sessionId, frame };
      this.packetListeners.forEach(listener => listener(event));
    }
    this.trackSequence(frame);
    if (frame.messageId === 0 && frame.payload.length >= 9) {
      const mavType = frame.payload[4];
      const autopilotType = frame.payload[5];
      if (mavType === 6 || autopilotType === 8) return;
      this.registerVehicle(frame, mavType, autopilotType, now, remote);
      if (this.state.systemId === null || this.state.componentId === null) {
        this.state.systemId = frame.systemId;
        this.state.componentId = frame.componentId;
      } else if (!this.vehicleSelectionExplicit
        && frame.systemId === this.state.systemId
        && frame.componentId === PRIMARY_AUTOPILOT_COMPONENT_ID
        && this.state.componentId !== PRIMARY_AUTOPILOT_COMPONENT_ID) {
        this.state.componentId = frame.componentId;
        this.intervalsRequested = false;
      }
    }
    if (this.state.systemId !== null && frame.systemId !== this.state.systemId) return;
    const targetScoped = frame.messageId === 0 || frame.messageId === 77 || frame.messageId === 242
      || [39, 40, 43, 44, 45, 47, 51, 73].includes(frame.messageId);
    if (targetScoped && this.state.componentId !== null && frame.componentId !== this.state.componentId) return;
    this.state.receivedAt = now;
    this.state.messageTimestamps[frame.messageId] = now;
    if ([39, 40, 43, 44, 45, 47, 51, 73].includes(frame.messageId)) {
      this.missionFrameListeners.forEach(listener => listener(frame));
    }

    if (frame.messageId === 0 && frame.payload.length >= 9) {
      this.transport?.setRemoteEndpoint?.(remote);
      this.state.systemId = frame.systemId;
      this.state.componentId = frame.componentId;
      this.state.armed = (frame.payload[6] & 0x80) !== 0;
      const customMode = view.getUint32(0, true);
      this.state.mode = getArduCopterModeName(customMode);
      this.state.systemStatus = frame.payload[7];
      this.state.lastHeartbeatAt = now;
      this.heartbeatListeners.forEach(listener => listener(now));
      if (!this.intervalsRequested) {
        this.intervalsRequested = true;
        this.requestMessageIntervals();
      }
    } else if (frame.messageId === 30 && frame.payload.length >= 16) {
      this.state.roll = view.getFloat32(4, true) * 180 / Math.PI;
      this.state.pitch = view.getFloat32(8, true) * 180 / Math.PI;
      this.state.yaw = (view.getFloat32(12, true) * 180 / Math.PI + 360) % 360;
    } else if (frame.messageId === 33 && frame.payload.length >= 28) {
      this.state.latitude = view.getInt32(4, true) / 1e7;
      this.state.longitude = view.getInt32(8, true) / 1e7;
      this.state.altitudeMsl = view.getInt32(12, true) / 1000;
      this.state.relativeAltitude = view.getInt32(16, true) / 1000;
      // Existing flight UI altitude is height above Home, not absolute elevation.
      this.state.altitude = this.state.relativeAltitude;
      this.state.speed = Math.hypot(view.getInt16(20, true), view.getInt16(22, true)) / 100;
      this.state.climb = -view.getInt16(24, true) / 100;
      const heading = view.getUint16(26, true);
      this.state.heading = heading === 65535 ? null : heading / 100;
    } else if (frame.messageId === 24 && frame.payload.length >= 30) {
      this.state.gpsFix = frame.payload[28];
      const hdop = view.getUint16(20, true);
      this.state.hdop = hdop === 65535 ? null : hdop / 100;
      this.state.satellites = frame.payload[29] === 255 ? null : frame.payload[29];
    } else if (frame.messageId === 1 && frame.payload.length >= 19) {
      const voltage = view.getUint16(14, true), current = view.getInt16(16, true), remaining = view.getInt8(18);
      this.sysBatterySample = {
        voltage: voltage === 0 || voltage === 65535 ? null : voltage / 1000,
        current: current === -1 ? null : current / 100,
        percentage: remaining < 0 ? null : this.clamp(remaining, 0, 100),
        receivedAt: now,
      };
      this.state.sensorsPresent = view.getUint32(0, true);
      this.state.sensorsEnabled = view.getUint32(4, true);
      this.state.sensorsHealth = view.getUint32(8, true);
    } else if (frame.messageId === 147 && frame.payload.length >= 36) {
      const batteryId = frame.payload[32];
      if (this.primaryBatteryId === null) this.primaryBatteryId = batteryId;
      if (batteryId === this.primaryBatteryId) {
        const current = view.getInt16(30, true), remaining = view.getInt8(35);
        this.batteryStatusSamples.set(batteryId, {
          voltage: this.sumBatteryCellVoltage(view),
          current: current === -1 ? null : current / 100,
          percentage: remaining < 0 ? null : this.clamp(remaining, 0, 100),
          receivedAt: now,
        });
      }
    } else if (frame.messageId === 74 && frame.payload.length >= 20) {
      this.state.speed = view.getFloat32(4, true);
      const heading = view.getInt16(8, true);
      this.state.heading = heading < 0 ? null : heading;
      this.state.climb = view.getFloat32(16, true);
    } else if (frame.messageId === 65 && frame.payload.length >= 42) {
      this.state.rcRssi = frame.payload[41] === 255 ? null : frame.payload[41];
    } else if (frame.messageId === 132 && frame.payload.length >= 14) {
      const distanceCm = view.getUint16(8, true);
      this.state.distanceSensorM = distanceCm === 65535 ? null : distanceCm / 100;
    } else if (frame.messageId === 100 && frame.payload.length >= 26) {
      this.state.opticalFlowGroundDistanceM = view.getFloat32(16, true);
      this.state.opticalFlowQuality = frame.payload[25];
    } else if (frame.messageId === 149 && frame.payload.length >= 30) {
      this.state.landingTargetAngleX = view.getFloat32(8, true);
      this.state.landingTargetAngleY = view.getFloat32(12, true);
      this.state.landingTargetDistanceM = view.getFloat32(16, true);
      this.state.landingTargetNum = frame.payload[28];
      this.state.landingTargetUpdatedAt = now;
    } else if (frame.messageId === 242 && frame.payload.length >= 12) {
      const latitude = view.getInt32(0, true) / 1e7;
      const longitude = view.getInt32(4, true) / 1e7;
      const altitudeMsl = view.getInt32(8, true) / 1000;
      const coordinateIsValid = latitude >= -90 && latitude <= 90
        && longitude >= -180 && longitude <= 180
        && (Math.abs(latitude) >= 1e-7 || Math.abs(longitude) >= 1e-7);
      if (coordinateIsValid) {
        this.state.homeLatitude = latitude;
        this.state.homeLongitude = longitude;
        this.state.homeAltitude = altitudeMsl;
        this.state.homeUpdatedAt = now;
      }
    } else if (frame.messageId === 42 && frame.payload.length >= 2) {
      this.state.missionCurrent = view.getUint16(0, true);
    } else if (frame.messageId === 46 && frame.payload.length >= 2) {
      this.state.missionReached = view.getUint16(0, true);
    } else if (frame.messageId === 77 && frame.payload.length >= 3) {
      const ack: MavlinkCommandAck = {
        command: view.getUint16(0, true), result: frame.payload[2],
        progress: frame.payload.length >= 4 && frame.payload[3] !== 255 ? frame.payload[3] : null,
        resultParam2: frame.payload.length >= 8 ? view.getInt32(4, true) : null,
        sourceSystemId: frame.systemId,
        sourceComponentId: frame.componentId,
        targetSystemId: frame.payload.length >= 9 ? frame.payload[8] : null,
        targetComponentId: frame.payload.length >= 10 ? frame.payload[9] : null,
        sessionId: this.sessionId,
        receivedAt: now,
      };
      console.log(`[MAVLink] COMMAND_ACK command=${ack.command} result=${ack.result}`);
      this.ackListeners.forEach(listener => listener(ack));
    } else if (frame.messageId === 253 && frame.payload.length >= 2) {
      const bytes = frame.payload.slice(1, Math.min(frame.payload.length, 51));
      const terminator = bytes.indexOf(0);
      const textBytes = terminator >= 0 ? bytes.slice(0, terminator) : bytes;
      const message: MavlinkStatusText = {
        severity: frame.payload[0], text: String.fromCharCode(...textBytes).trim(),
        id: frame.payload.length >= 53 ? view.getUint16(51, true) : null,
        chunkSequence: frame.payload.length >= 54 ? frame.payload[53] : null, receivedAt: now,
      };
      if (message.text) {
        this.state.lastStatusText = message;
        console.log(`[MAVLink] STATUSTEXT severity=${message.severity} ${message.text}`);
        this.statusTextListeners.forEach(listener => listener(message));
      }
    }
    this.applyPreferredBattery(now);
    this.scheduleEmit();
  }

  private sumBatteryCellVoltage(view: DataView) {
    let totalMillivolts = 0;
    for (let index = 0; index < 10; index++) {
      const millivolts = view.getUint16(10 + index * 2, true);
      if (millivolts > 0 && millivolts !== 65535) totalMillivolts += millivolts;
    }
    return totalMillivolts > 0 ? totalMillivolts / 1000 : null;
  }

  private applyPreferredBattery(now: number) {
    const sys = this.sysBatterySample && now - this.sysBatterySample.receivedAt <= BATTERY_SOURCE_FRESH_MS
      ? this.sysBatterySample
      : null;
    const statusCandidate = this.primaryBatteryId === null ? null : this.batteryStatusSamples.get(this.primaryBatteryId) ?? null;
    const status = statusCandidate && now - statusCandidate.receivedAt <= BATTERY_SOURCE_FRESH_MS
      ? statusCandidate
      : null;
    // BATTERY_STATUS is per-battery and is the most specific source. Some
    // Pixhawk/ArduPilot configurations keep SYS_STATUS.battery_remaining at 0
    // even while BATTERY_STATUS reports a usable percentage. Prefer any fresh,
    // positive reading over a conflicting zero; a real 0% remains visible once
    // neither source has a positive reading.
    const hasTrustedPercentage = (sample: BatterySample | null) => sample?.percentage !== null
      && sample?.percentage !== undefined
      && (sample.percentage > 0 || sample.voltage !== null);
    const percentageSource = [status, sys].find(sample => hasTrustedPercentage(sample) && (sample?.percentage ?? 0) > 0)
      ?? [status, sys].find(hasTrustedPercentage)
      ?? null;
    this.state.battery = percentageSource?.percentage ?? null;
    this.state.voltage = percentageSource?.voltage ?? status?.voltage ?? sys?.voltage ?? null;
    this.state.current = percentageSource?.current ?? status?.current ?? sys?.current ?? null;
    this.state.batteryUpdatedAt = percentageSource?.receivedAt ?? null;
  }

  private registerVehicle(
    frame: MavlinkFrame,
    mavType: number,
    autopilotType: number,
    now: number,
    remote: TransportRemoteInfo,
  ) {
    const key = `${frame.systemId}:${frame.componentId}`;
    this.vehicles.set(key, {
      systemId: frame.systemId,
      componentId: frame.componentId,
      mavType,
      autopilotType,
      lastHeartbeatAt: now,
      remote: { ...remote },
      selected: false,
    });
    this.emitVehicles();
  }

  private vehicleSnapshot() {
    return Array.from(this.vehicles.values()).map(vehicle => ({
      ...vehicle,
      remote: { ...vehicle.remote },
      selected: vehicle.systemId === this.state.systemId && vehicle.componentId === this.state.componentId,
    }));
  }

  private emitVehicles() {
    const snapshot = this.vehicleSnapshot();
    this.vehicleListeners.forEach(listener => listener(snapshot));
  }

  private trackSequence(frame: MavlinkFrame) {
    const key = `${frame.systemId}:${frame.componentId}`;
    const previous = this.lastSequenceBySource.get(key);
    if (previous !== undefined) {
      const gap = (frame.sequence - previous + 256) % 256;
      if (gap > 1) this.state.packetsLost += gap - 1;
    }
    this.lastSequenceBySource.set(key, frame.sequence);
  }

  private clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
  private scheduleEmit() {
    const now = Date.now();
    const remaining = 100 - (now - this.lastEmitAt);
    if (remaining <= 0) {
      this.emit();
      return;
    }
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      this.emit();
    }, remaining);
  }
  private emit() {
    this.lastEmitAt = Date.now();
    const snapshot = this.getState();
    this.stateListeners.forEach(listener => listener(snapshot));
  }
}
