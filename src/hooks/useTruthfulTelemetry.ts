import { useAppSelector } from '../store/hooks';
import {
  selectConnectionStatus,
  selectMavlinkStatus,
  selectVehicleStatus,
} from '../store/connection/connectionSlice';
import { selectAttitude, selectBattery, selectGps, selectTelemetryStale, selectVelocity } from '../store/telemetry/telemetrySlice';

export type TelemetryStatus = 'UNAVAILABLE' | 'STALE' | 'LIVE';
export function useTruthfulTelemetry() {
  const connectionStatus = useAppSelector(selectConnectionStatus);
  const vehicleState = useAppSelector(selectVehicleStatus);
  const mavlinkState = useAppSelector(selectMavlinkStatus);
  const stale = useAppSelector(selectTelemetryStale);
  
  const connected = connectionStatus === 'CONNECTED'
    && vehicleState === 'AVAILABLE'
    && mavlinkState === 'HEARTBEAT_OK';
  const telemetryStatus: TelemetryStatus = !connected ? 'UNAVAILABLE' : stale ? 'STALE' : 'LIVE';
  
  return { connected, connectionStatus, vehicleState, mavlinkState, telemetryStatus };
}
