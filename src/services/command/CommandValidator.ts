import { DroneCommand, CommandResult } from '../../types/command';
import { RootState } from '../../store';
import { AppConfig } from '../../config';

export class CommandValidator {
  validate(command: DroneCommand, state: RootState): string | null {
    const { connection, drone, telemetry, command: commandState } = state;

    // 1. Connection check
    if (connection.status !== 'CONNECTED') {
      return 'CONNECTION_LOST';
    }

    // 2. Heartbeat check (timeout handled by heartbeat service, which sets status to ERROR/DISCONNECTED, 
    // but we can double check if it's stale just in case)
    const now = Date.now();
    if (connection.lastHeartbeat && (now - connection.lastHeartbeat > AppConfig.CONNECTION_TIMEOUT)) {
      return 'HEARTBEAT_TIMEOUT';
    }

    // 3. Command rules
    switch (command.type) {
      case 'ARM':
        break;

      case 'DISARM':
        break;

      case 'TAKEOFF':
        if (!drone.armed) return 'DRONE_NOT_ARMED';
        if (command.payload.altitude <= 0 || isNaN(command.payload.altitude) || !isFinite(command.payload.altitude)) {
          return 'INVALID_ALTITUDE';
        }
        break;

      case 'LAND':
        if (!drone.armed) return 'DRONE_NOT_ARMED'; // Or maybe it's fine if already landed, but standard is reject.
        break;

      case 'RTL':
        // RTL requires GPS, let's assume we have it if it's not stale
        if (!telemetry.gps || now - telemetry.gps.timestamp > AppConfig.TELEMETRY_TIMEOUT) {
          // In real life, maybe Pixhawk still accepts RTL and fails later, but we can do a pre-check.
          // return 'GPS_STALE'; 
        }
        break;

      case 'SET_MODE':
        // All modes valid in enum.
        break;
    }

    return null; // Passes validation
  }
}

export const commandValidator = new CommandValidator();
