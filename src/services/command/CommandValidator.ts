import { DroneCommand } from '../../types/command';
import { RootState } from '../../store';
import { AppConfig } from '../../config';
import { isValidCoordinate } from '../../utils/geographic';

export class CommandValidator {
  validate(command: DroneCommand, state: RootState): string | null {
    const { connection, drone, telemetry, command: commandState } = state;

    if (connection.status !== 'CONNECTED' || connection.vehicleState !== 'CONNECTED') return 'NO_FRESH_VEHICLE';
    if (telemetry.stale || drone.stale) return 'TELEMETRY_STALE';

    // 2. Heartbeat check (timeout handled by heartbeat service, which sets status to ERROR/DISCONNECTED, 
    // but we can double check if it's stale just in case)
    const now = Date.now();
    if (!connection.lastHeartbeat) return 'WAITING_HEARTBEAT';
    if (now - connection.lastHeartbeat > AppConfig.CONNECTION_TIMEOUT) return 'HEARTBEAT_TIMEOUT';
    if (commandState.pendingCommand) return 'COMMAND_ALREADY_PENDING';

    // 3. Command rules
    switch (command.type) {
      case 'ARM':
        if (drone.armed) return 'ALREADY_ARMED';
        break;

      case 'DISARM':
        if (!drone.armed) return 'ALREADY_DISARMED';
        if (!telemetry.gps || !Number.isFinite(telemetry.gps.value.altitude)) {
          return 'DISARM_REQUIRES_VALID_ALTITUDE';
        }
        if (now - telemetry.gps.timestamp > AppConfig.TELEMETRY_TIMEOUT) return 'ALTITUDE_STALE';
        if (telemetry.gps.value.altitude > 1) return 'DISARM_BLOCKED_VEHICLE_AIRBORNE';
        break;

      case 'TAKEOFF':
        if (!drone.armed) return 'DRONE_NOT_ARMED';
        if (drone.flightMode !== 'GUIDED') return 'TAKEOFF_REQUIRES_GUIDED_MODE';
        if (command.payload.altitude <= 0 || isNaN(command.payload.altitude) || !isFinite(command.payload.altitude)) {
          return 'INVALID_ALTITUDE';
        }
        break;

      case 'LAND':
        if (!drone.armed) return 'DRONE_NOT_ARMED'; // Or maybe it's fine if already landed, but standard is reject.
        break;

      case 'RTL':
        if (!telemetry.gps || now - telemetry.gps.timestamp > AppConfig.TELEMETRY_TIMEOUT) return 'GPS_STALE';
        if (telemetry.gps.value.gpsFix === null || telemetry.gps.value.gpsFix < 3) return 'GPS_NO_3D_FIX';
        break;

      case 'SET_MODE':
        // All modes valid in enum.
        break;

      case 'SET_HOME':
        if (command.payload.useCurrent) {
          if (!telemetry.gps
            || !isValidCoordinate(telemetry.gps.value.latitude, telemetry.gps.value.longitude)) {
            return 'SET_HOME_REQUIRES_VALID_VEHICLE_POSITION';
          }
          if (now - telemetry.gps.timestamp > AppConfig.TELEMETRY_TIMEOUT) return 'GPS_STALE';
          if ((telemetry.gps.value.gpsFix ?? 0) < 3) return 'GPS_NO_3D_FIX';
        } else if (!isValidCoordinate(command.payload.latitude, command.payload.longitude)
          || command.payload.altitude == null
          || !Number.isFinite(command.payload.altitude)) {
          return 'SET_HOME_REQUIRES_VALID_MSL_LOCATION';
        }
        break;
    }

    return null; // Passes validation
  }
}

export const commandValidator = new CommandValidator();
