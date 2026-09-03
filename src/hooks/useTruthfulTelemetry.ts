import { useAppSelector } from '../store/hooks';
import { selectConnectionStatus, selectMavlinkState, selectVehicleState } from '../store/connection/connectionSlice';
import { selectAttitude, selectBattery, selectGps, selectTelemetryStale, selectVelocity } from '../store/telemetry/telemetrySlice';

export type TelemetryStatus = 'UNAVAILABLE' | 'STALE' | 'LIVE';
export function useTruthfulTelemetry() {
  const connectionStatus = useAppSelector(selectConnectionStatus);
  const vehicleState = useAppSelector(selectVehicleState);
  const mavlinkState = useAppSelector(selectMavlinkState);
  const stale = useAppSelector(selectTelemetryStale);
  
  const connected = connectionStatus === 'CONNECTED' && vehicleState === 'CONNECTED';
  const telemetryStatus: TelemetryStatus = !connected ? 'UNAVAILABLE' : stale ? 'STALE' : 'LIVE';
  
  return { connected, connectionStatus, vehicleState, mavlinkState, telemetryStatus };
}
