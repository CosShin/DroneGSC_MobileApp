import { isValidCoordinate } from '../../utils/geographic';

export interface SetHomePayload {
  useCurrent: boolean;
  latitude?: number;
  longitude?: number;
  altitude?: number;
}

/** Build MAV_CMD_DO_SET_HOME parameters for COMMAND_LONG. */
export function buildSetHomeCommandParams(payload: SetHomePayload): number[] {
  if (payload.useCurrent) {
    // Param 4 (yaw) is NaN so the autopilot uses its default home heading.
    return [1, 0, 0, Number.NaN, 0, 0, 0];
  }
  if (!isValidCoordinate(payload.latitude, payload.longitude)
    || payload.altitude == null
    || !Number.isFinite(payload.altitude)) {
    throw new Error('INVALID_SET_HOME_LOCATION');
  }
  // COMMAND_LONG location parameters are degrees/degrees/metres MSL.
  return [0, 0, 0, Number.NaN, payload.latitude!, payload.longitude!, payload.altitude];
}

/**
 * Returns an altitude that is known to use the MAVLink MSL datum. Phone GPS
 * altitude is deliberately excluded because Expo reports WGS-84 ellipsoid
 * altitude, not MSL altitude.
 */
export function resolveSetHomeAltitudeMsl(
  confirmedHomeAltitude: number | null | undefined,
  vehicleAltitudeMsl: number | null | undefined,
  vehicleArmed: boolean,
): number | null {
  if (confirmedHomeAltitude != null && Number.isFinite(confirmedHomeAltitude)) {
    return confirmedHomeAltitude;
  }
  if (!vehicleArmed && vehicleAltitudeMsl != null && Number.isFinite(vehicleAltitudeMsl)) {
    return vehicleAltitudeMsl;
  }
  return null;
}
