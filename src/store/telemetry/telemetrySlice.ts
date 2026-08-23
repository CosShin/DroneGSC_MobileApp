import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

export interface TelemetryValue<T> {
  value: T;
  timestamp: number;
}

export interface GpsData {
  latitude: number;
  longitude: number;
  altitude: number;
  satellites: number;
  hdop: number;
  gpsFix: number;
}

export interface AttitudeData {
  roll: number;
  pitch: number;
  yaw: number;
}

export interface VelocityData {
  groundSpeed: number;
  verticalSpeed: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
}

export interface BatteryData {
  voltage: number;
  current: number;
  percentage: number;
}

export type SensorHealth = 'GOOD' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

export interface SensorState {
  name: string;
  health: SensorHealth;
  value?: string;
  message?: string;
}

export interface TelemetryState {
  gps: TelemetryValue<GpsData> | null;
  attitude: TelemetryValue<AttitudeData> | null;
  velocity: TelemetryValue<VelocityData> | null;
  battery: TelemetryValue<BatteryData> | null;
  sensors: TelemetryValue<SensorState[]> | null;
}

const initialState: TelemetryState = {
  gps: null,
  attitude: null,
  velocity: null,
  battery: null,
  sensors: null,
};

export const telemetrySlice = createSlice({
  name: 'telemetry',
  initialState,
  reducers: {
    updateGps: (state, action: PayloadAction<TelemetryValue<GpsData>>) => {
      state.gps = action.payload;
    },
    updateAttitude: (state, action: PayloadAction<TelemetryValue<AttitudeData>>) => {
      state.attitude = action.payload;
    },
    updateVelocity: (state, action: PayloadAction<TelemetryValue<VelocityData>>) => {
      state.velocity = action.payload;
    },
    updateBattery: (state, action: PayloadAction<TelemetryValue<BatteryData>>) => {
      state.battery = action.payload;
    },
    updateSensors: (state, action: PayloadAction<TelemetryValue<SensorState[]>>) => {
      state.sensors = action.payload;
    },
    clearTelemetry: (state) => {
      state.gps = null;
      state.attitude = null;
      state.velocity = null;
      state.battery = null;
      state.sensors = null;
    },
  },
});

export const { updateGps, updateAttitude, updateVelocity, updateBattery, updateSensors, clearTelemetry } = telemetrySlice.actions;

export const selectGps = (state: RootState) => state.telemetry.gps;
export const selectAttitude = (state: RootState) => state.telemetry.attitude;
export const selectVelocity = (state: RootState) => state.telemetry.velocity;
export const selectBattery = (state: RootState) => state.telemetry.battery;
export const selectSensors = (state: RootState) => state.telemetry.sensors;

export default telemetrySlice.reducer;
