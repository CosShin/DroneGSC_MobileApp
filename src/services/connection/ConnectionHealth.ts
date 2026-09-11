import type { TransportKind, TransportStatus } from '../mavlink/MavlinkTransport';

export type NetworkStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'DEGRADED' | 'RECONNECTING';
export type MavlinkStatus = 'NO_HEARTBEAT' | 'WAITING' | 'HEARTBEAT_OK' | 'HEARTBEAT_STALE' | 'LOST';
export type VehicleStatus = 'NO_VEHICLE' | 'AVAILABLE' | 'UNRESPONSIVE';
export type ControlStatus = 'DISABLED' | 'READY' | 'DEGRADED' | 'LOST';
export type LinkQuality = 'EXCELLENT' | 'GOOD' | 'DEGRADED' | 'POOR' | 'CRITICAL';
export type VideoQualityPolicy = 'NORMAL' | 'REDUCED' | 'MINIMUM' | 'OFF';
export type HeartbeatHealth = 'NO_HEARTBEAT' | 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'LOST';

export interface HeartbeatSnapshot {
  health: HeartbeatHealth;
  lastHeartbeatAt: number | null;
  heartbeatAgeMs: number | null;
  heartbeatIntervalMs: number | null;
  jitterMs: number | null;
  missedHeartbeatCount: number;
}

export interface NetworkSnapshot {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string | null;
  changedAt: number;
}

export interface ConnectionHealthSnapshot {
  networkStatus: NetworkStatus;
  mavlinkStatus: MavlinkStatus;
  vehicleStatus: VehicleStatus;
  controlStatus: ControlStatus;
  linkQuality: LinkQuality;
  linkQualityScore: number;
  rttMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
  lastHeartbeatAt: number | null;
  heartbeatAgeMs: number | null;
  heartbeatIntervalMs: number | null;
  missedHeartbeatCount: number;
  lastAckLatencyMs: number | null;
  reconnectCount: number;
  transport: TransportKind | null;
  transportStatus: TransportStatus | null;
  rxPacketsPerSec: number;
  txPacketsPerSec: number;
  controlAvailable: boolean;
  videoAvailable: boolean;
  videoQualityPolicy: VideoQualityPolicy;
  networkType: string | null;
  internetReachable: boolean | null;
  updatedAt: number;
}

export const emptyConnectionHealth = (): ConnectionHealthSnapshot => ({
  networkStatus: 'DISCONNECTED',
  mavlinkStatus: 'NO_HEARTBEAT',
  vehicleStatus: 'NO_VEHICLE',
  controlStatus: 'DISABLED',
  linkQuality: 'CRITICAL',
  linkQualityScore: 0,
  rttMs: null,
  jitterMs: null,
  packetLossPct: null,
  lastHeartbeatAt: null,
  heartbeatAgeMs: null,
  heartbeatIntervalMs: null,
  missedHeartbeatCount: 0,
  lastAckLatencyMs: null,
  reconnectCount: 0,
  transport: null,
  transportStatus: null,
  rxPacketsPerSec: 0,
  txPacketsPerSec: 0,
  controlAvailable: false,
  videoAvailable: false,
  videoQualityPolicy: 'OFF',
  networkType: null,
  internetReachable: null,
  updatedAt: Date.now(),
});
