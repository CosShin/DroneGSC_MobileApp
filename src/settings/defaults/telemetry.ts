import { TelemetrySettings } from '../types/telemetry';

export const DEFAULT_TELEMETRY_CONFIG: TelemetrySettings = {
  gpsUpdateRateHz: 5,
  attitudeUpdateRateHz: 15,
  batteryUpdateRateHz: 1,
  positionUpdateRateHz: 5,
  statusUpdateRateHz: 2,
  uiRefreshRateHz: 30,
};
