import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import { ConnectionType, VehicleType, AutopilotType } from '../../settings/types/connection';
import { ConnectionPhase } from '../../services/connection/ConnectionStateMachine';
import {
  emptyConnectionHealth,
  type ConnectionHealthSnapshot,
} from '../../services/connection/ConnectionHealth';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface ConnectionState extends ConnectionHealthSnapshot {
  status: ConnectionStatus;
  activeType: ConnectionType;
  activePortInfo: string;
  vehicleName: string;
  vehicleType: VehicleType;
  autopilot: AutopilotType;
  latencyMs: number | null;
  lastHeartbeat: number | null;
  lastPacket: number | null;
  bytesReceived: number;
  bytesSent: number;
  packetsPerSec: number;
  txPacketsPerSec: number;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  mavlinkVersion: 1 | 2 | null;
  error: string | null;
  phase: ConnectionPhase;
  networkState: 'DISCONNECTED' | 'BOUND' | 'ERROR';
  mavlinkState: 'IDLE' | 'WAITING_HEARTBEAT' | 'ACTIVE' | 'HEARTBEAT_LOST';
  vehicleState: 'NO_VEHICLE' | 'CONNECTED' | 'STALE';
  packetsLost: number;
  sessionId: string | null;
}

const initialState: ConnectionState = {
  ...emptyConnectionHealth(),
  status: 'DISCONNECTED',
  activeType: 'WEBSOCKET',
  activePortInfo: 'ws://192.168.1.247:8765/mavlink',
  vehicleName: 'NO VEHICLE',
  vehicleType: 'GENERIC',
  autopilot: 'ARDUPILOT',
  latencyMs: null,
  lastHeartbeat: null,
  lastPacket: null,
  bytesReceived: 0,
  bytesSent: 0,
  packetsPerSec: 0,
  txPacketsPerSec: 0,
  rxBytesPerSec: 0,
  txBytesPerSec: 0,
  mavlinkVersion: null,
  error: null,
  phase: 'IDLE',
  networkState: 'DISCONNECTED',
  mavlinkState: 'IDLE',
  vehicleState: 'NO_VEHICLE',
  packetsLost: 0,
  sessionId: null,
};

export const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.status = action.payload;
    },
    setActiveConnectionInfo: (state, action: PayloadAction<{ type: ConnectionType; portInfo: string }>) => {
      state.activeType = action.payload.type;
      state.activePortInfo = action.payload.portInfo;
    },
    setDetectedVehicle: (state, action: PayloadAction<{ name: string; vehicleType: VehicleType; autopilot: AutopilotType }>) => {
      state.vehicleName = action.payload.name;
      state.vehicleType = action.payload.vehicleType;
      state.autopilot = action.payload.autopilot;
    },
    setHeartbeat: (state, action: PayloadAction<number>) => {
      state.lastHeartbeat = action.payload;
      state.lastHeartbeatAt = action.payload;
    },
    setLastPacket: (state, action: PayloadAction<number>) => {
      state.lastPacket = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setLatency: (state, action: PayloadAction<number | null>) => {
      state.latencyMs = action.payload;
    },
    updateTrafficStats: (state, action: PayloadAction<{
      bytesRx: number;
      bytesTx: number;
      pps: number;
      txPps?: number;
      rxBytesPerSec?: number;
      txBytesPerSec?: number;
      mavlinkVersion?: 1 | 2 | null;
    }>) => {
      state.bytesReceived = action.payload.bytesRx;
      state.bytesSent = action.payload.bytesTx;
      state.packetsPerSec = action.payload.pps;
      state.txPacketsPerSec = action.payload.txPps ?? state.txPacketsPerSec;
      state.rxBytesPerSec = action.payload.rxBytesPerSec ?? state.rxBytesPerSec;
      state.txBytesPerSec = action.payload.txBytesPerSec ?? state.txBytesPerSec;
      if (action.payload.mavlinkVersion !== undefined) state.mavlinkVersion = action.payload.mavlinkVersion;
    },
    setLinkState: (state, action: PayloadAction<{
      phase: ConnectionPhase;
      network: ConnectionState['networkState'];
      mavlink: ConnectionState['mavlinkState'];
      vehicle: ConnectionState['vehicleState'];
      error: string | null;
    }>) => {
      state.phase = action.payload.phase;
      state.networkState = action.payload.network;
      state.mavlinkState = action.payload.mavlink;
      state.vehicleState = action.payload.vehicle;
      state.error = action.payload.error;
    },
    setPacketsLost: (state, action: PayloadAction<number>) => {
      state.packetsLost = action.payload;
    },
    updateConnectionHealth: (state, action: PayloadAction<ConnectionHealthSnapshot>) => {
      Object.assign(state, action.payload);
    },
    setVehicleSessionId: (state, action: PayloadAction<string | null>) => {
      state.sessionId = action.payload;
    },
  },
});

export const { 
  setStatus, 
  setActiveConnectionInfo,
  setDetectedVehicle,
  setHeartbeat, 
  setLastPacket, 
  setError, 
  setLatency,
  updateTrafficStats,
  setLinkState,
  setPacketsLost,
  updateConnectionHealth,
  setVehicleSessionId,
} = connectionSlice.actions;

export const selectConnectionStatus = (state: RootState) => state.connection.status;
export const selectIsConnected = (state: RootState) => state.connection.status === 'CONNECTED'
  && state.connection.vehicleStatus === 'AVAILABLE'
  && state.connection.mavlinkStatus === 'HEARTBEAT_OK';
export const selectActiveType = (state: RootState) => state.connection.activeType;
export const selectActivePortInfo = (state: RootState) => state.connection.activePortInfo;
export const selectVehicleName = (state: RootState) => state.connection.vehicleName;
export const selectVehicleType = (state: RootState) => state.connection.vehicleType;
export const selectAutopilot = (state: RootState) => state.connection.autopilot;
export const selectBytesReceived = (state: RootState) => state.connection.bytesReceived;
export const selectPacketsPerSec = (state: RootState) => state.connection.packetsPerSec;
export const selectTxPacketsPerSec = (state: RootState) => state.connection.txPacketsPerSec;
export const selectRxBytesPerSec = (state: RootState) => state.connection.rxBytesPerSec;
export const selectTxBytesPerSec = (state: RootState) => state.connection.txBytesPerSec;
export const selectMavlinkVersion = (state: RootState) => state.connection.mavlinkVersion;
export const selectLatencyMs = (state: RootState) => state.connection.latencyMs;
export const selectLastHeartbeat = (state: RootState) => state.connection.lastHeartbeat;
export const selectNetworkState = (state: RootState) => state.connection.networkState;
export const selectMavlinkState = (state: RootState) => state.connection.mavlinkState;
export const selectVehicleState = (state: RootState) => state.connection.vehicleState;
export const selectConnectionPhase = (state: RootState) => state.connection.phase;
export const selectNetworkStatus = (state: RootState) => state.connection.networkStatus;
export const selectMavlinkStatus = (state: RootState) => state.connection.mavlinkStatus;
export const selectVehicleStatus = (state: RootState) => state.connection.vehicleStatus;
export const selectVehicleAvailable = (state: RootState) => state.connection.vehicleStatus === 'AVAILABLE';
export const selectControlStatus = (state: RootState) => state.connection.controlStatus;
export const selectControlAvailable = (state: RootState) => state.connection.controlAvailable;
export const selectLinkQuality = (state: RootState) => state.connection.linkQuality;
export const selectLinkQualityScore = (state: RootState) => state.connection.linkQualityScore;
export const selectVideoQualityPolicy = (state: RootState) => state.connection.videoQualityPolicy;
export const selectConnectionHealth = (state: RootState) => state.connection;

export default connectionSlice.reducer;
