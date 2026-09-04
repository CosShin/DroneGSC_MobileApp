import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

export interface TelemetryValue<T> {
  value: T;
  timestamp: number;
}

export interface GpsData {
  latitude: number;
  longitude: number;
  /** Height above the vehicle Home datum, in metres. */
  altitude: number;
  /** Absolute altitude above mean sea level from GLOBAL_POSITION_INT.alt. */
  altitudeMsl?: number | null;
  relativeAltitude?: number | null;
  satellites: number | null;
  hdop: number | null;
  gpsFix: number | null;
}

export interface AttitudeData {
  roll: number;
  pitch: number;
  yaw: number;
}

export interface VelocityData {
  groundSpeed: number;
  verticalSpeed: number | null;
  velocityX: number | null;
  velocityY: number | null;
  velocityZ: number | null;
}

export interface BatteryData {
  voltage: number | null;
  current: number | null;
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
  stale: boolean;
  statusTexts: Array<{ severity: number; text: string; timestamp: number }>;
}

export interface TelemetrySnapshotPayload {
  timestamp: number;
  gpsTimestamp?: number;
  attitudeTimestamp?: number;
  velocityTimestamp?: number;
  stale: boolean;
  gps: GpsData | null;
  attitude: AttitudeData | null;
  velocity: VelocityData | null;
}

const initialState: TelemetryState = {
  gps: null,
  attitude: null,
  velocity: null,
  battery: null,
  sensors: null,
  stale: false,
  statusTexts: [],
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
    clearBattery: (state) => {
      state.battery = null;
    },
    updateSensors: (state, action: PayloadAction<TelemetryValue<SensorState[]>>) => {
      state.sensors = action.payload;
    },
    updateTelemetrySnapshot: (state, action: PayloadAction<TelemetrySnapshotPayload>) => {
      const { timestamp, stale, gps, attitude, velocity } = action.payload;
      const gpsTimestamp = action.payload.gpsTimestamp || timestamp;
      const attitudeTimestamp = action.payload.attitudeTimestamp || timestamp;
      const velocityTimestamp = action.payload.velocityTimestamp || timestamp;
      if (state.stale !== stale) state.stale = stale;

      if (gps) {
        const current = state.gps?.value;
        if (!current || current.latitude !== gps.latitude || current.longitude !== gps.longitude ||
            current.altitude !== gps.altitude || current.altitudeMsl !== gps.altitudeMsl ||
            current.relativeAltitude !== gps.relativeAltitude || current.satellites !== gps.satellites ||
            current.gpsFix !== gps.gpsFix || current.hdop !== gps.hdop) {
          state.gps = { value: gps, timestamp: gpsTimestamp };
        } else {
          state.gps!.timestamp = gpsTimestamp;
        }
      }
      if (attitude) {
        const current = state.attitude?.value;
        if (!current || current.roll !== attitude.roll || current.pitch !== attitude.pitch || current.yaw !== attitude.yaw) {
          state.attitude = { value: attitude, timestamp: attitudeTimestamp };
        } else {
          state.attitude!.timestamp = attitudeTimestamp;
        }
      }
      if (velocity) {
        const current = state.velocity?.value;
        if (!current || current.groundSpeed !== velocity.groundSpeed || current.verticalSpeed !== velocity.verticalSpeed) {
          state.velocity = { value: velocity, timestamp: velocityTimestamp };
        } else {
          state.velocity!.timestamp = velocityTimestamp;
        }
      }
    },
    setTelemetryStale: (state, action: PayloadAction<boolean>) => {
      state.stale = action.payload;
    },
    addStatusText: (state, action: PayloadAction<{ severity: number; text: string; timestamp: number }>) => {
      state.statusTexts.unshift(action.payload);
      state.statusTexts = state.statusTexts.slice(0, 50);
    },
    clearTelemetry: (state) => {
      state.gps = null;
      state.attitude = null;
      state.velocity = null;
      state.battery = null;
      state.sensors = null;
      state.stale = false;
      state.statusTexts = [];
    },
  },
});

export const { updateGps, updateAttitude, updateVelocity, updateBattery, clearBattery, updateSensors, updateTelemetrySnapshot, setTelemetryStale, addStatusText, clearTelemetry } = telemetrySlice.actions;

export const selectGps = (state: RootState) => state.telemetry.gps;
export const selectAttitude = (state: RootState) => state.telemetry.attitude;
export const selectVelocity = (state: RootState) => state.telemetry.velocity;
export const selectBattery = (state: RootState) => state.telemetry.battery;
export const selectSensors = (state: RootState) => state.telemetry.sensors;
export const selectTelemetryStale = (state: RootState) => state.telemetry.stale;
export const selectStatusTexts = (state: RootState) => state.telemetry.statusTexts;

// Micro selectors for high-frequency data to prevent large component re-renders
export const selectRoll = (state: RootState) => state.telemetry.attitude?.value.roll ?? null;
export const selectPitch = (state: RootState) => state.telemetry.attitude?.value.pitch ?? null;
export const selectYaw = (state: RootState) => state.telemetry.attitude?.value.yaw ?? null;
export const selectAltitude = (state: RootState) => state.telemetry.gps?.value.altitude ?? null;
export const selectGroundSpeed = (state: RootState) => state.telemetry.velocity?.value.groundSpeed ?? null;
export const selectVerticalSpeed = (state: RootState) => state.telemetry.velocity?.value.verticalSpeed ?? null;
export const selectHeading = (state: RootState) => {
  const yaw = state.telemetry.attitude?.value.yaw;
  return yaw != null ? ((Math.round(yaw) % 360) + 360) % 360 : null;
};
export const selectBatteryPercentage = (state: RootState) => state.telemetry.battery?.value.percentage ?? null;
export const selectBatteryVoltage = (state: RootState) => state.telemetry.battery?.value.voltage ?? null;
export const selectSatellites = (state: RootState) => state.telemetry.gps?.value.satellites ?? null;
export const selectGpsFix = (state: RootState) => state.telemetry.gps?.value.gpsFix ?? null;

export default telemetrySlice.reducer;
