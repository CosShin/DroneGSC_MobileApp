import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import { ConnectionType, VehicleType, AutopilotType } from '../../settings/types/connection';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface ConnectionState {
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
  error: string | null;
}

const initialState: ConnectionState = {
  status: 'DISCONNECTED',
  activeType: 'UDP',
  activePortInfo: 'UDP: 14550',
  vehicleName: 'ArduCopter V4.5.1',
  vehicleType: 'COPTER',
  autopilot: 'ARDUPILOT',
  latencyMs: null,
  lastHeartbeat: null,
  lastPacket: null,
  bytesReceived: 0,
  bytesSent: 0,
  packetsPerSec: 0,
  error: null,
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
    updateTrafficStats: (state, action: PayloadAction<{ bytesRx: number; bytesTx: number; pps: number }>) => {
      state.bytesReceived = action.payload.bytesRx;
      state.bytesSent = action.payload.bytesTx;
      state.packetsPerSec = action.payload.pps;
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
  updateTrafficStats
} = connectionSlice.actions;

export const selectConnectionStatus = (state: RootState) => state.connection.status;
export const selectIsConnected = (state: RootState) => state.connection.status === 'CONNECTED';
export const selectActiveType = (state: RootState) => state.connection.activeType;
export const selectActivePortInfo = (state: RootState) => state.connection.activePortInfo;
export const selectVehicleName = (state: RootState) => state.connection.vehicleName;
export const selectVehicleType = (state: RootState) => state.connection.vehicleType;
export const selectAutopilot = (state: RootState) => state.connection.autopilot;
export const selectBytesReceived = (state: RootState) => state.connection.bytesReceived;
export const selectPacketsPerSec = (state: RootState) => state.connection.packetsPerSec;
export const selectLatencyMs = (state: RootState) => state.connection.latencyMs;
export const selectLastHeartbeat = (state: RootState) => state.connection.lastHeartbeat;

export default connectionSlice.reducer;
