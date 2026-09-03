import type { RootState } from '../../../store';
import { AppConfig } from '../../../config';
import { isValidCoordinate } from '../../../utils/geographic';
import type { AiActionProposal } from '../intents/AiIntentTypes';

export class AiActionValidator {
  /**
   * Deterministically validates an AI action proposal against current real vehicle telemetry.
   * Runs:
   * 1. When proposal is first generated.
   * 2. Immediately before executing confirmed action (to avoid stale context execution).
   * 
   * Returns null if valid, or a descriptive error code/reason if blocked.
   */
  validate(proposal: AiActionProposal, state: RootState, currentSessionId?: string | null): string | null {
    const { connection, drone, telemetry, command: commandState } = state;

    // 1. Connection check
    if (connection.status !== 'CONNECTED' || connection.vehicleState !== 'CONNECTED') {
      return 'NO_FRESH_VEHICLE_CONNECTED';
    }

    // 2. Session isolation: ensure proposal was created during the same vehicle connection session
    if (proposal.vehicleSessionId && currentSessionId && proposal.vehicleSessionId !== currentSessionId) {
      return 'PROPOSAL_SESSION_EXPIRED';
    }

    // 3. Telemetry freshness check
    const now = Date.now();
    if (!connection.lastHeartbeat || now - connection.lastHeartbeat > AppConfig.CONNECTION_TIMEOUT) {
      return 'HEARTBEAT_STALE_OR_TIMEOUT';
    }
    if (telemetry.stale || drone.stale) {
      return 'TELEMETRY_STALE';
    }

    // 4. Command concurrency check
    if (commandState.pendingCommand) {
      return 'ANOTHER_COMMAND_ALREADY_PENDING';
    }

    // 5. Specific Intent Safety Rules
    const intent = proposal.intent;
    switch (intent.type) {
      case 'ARM': {
        if (drone.armed) return 'ALREADY_ARMED';
        // Block ARM if active blocking PreArm error exists
        break;
      }

      case 'DISARM': {
        if (!drone.armed) return 'ALREADY_DISARMED';
        // Safety critical: NEVER allow AI to disarm while airborne!
        if (!telemetry.gps || !Number.isFinite(telemetry.gps.value.altitude)) {
          return 'DISARM_REQUIRES_VALID_ALTITUDE';
        }
        if (now - telemetry.gps.timestamp > AppConfig.TELEMETRY_TIMEOUT) {
          return 'ALTITUDE_TELEMETRY_STALE';
        }
        if (telemetry.gps.value.altitude > 1.0) {
          return 'DISARM_BLOCKED_VEHICLE_AIRBORNE';
        }
        break;
      }

      case 'TAKEOFF': {
        if (!drone.armed) {
          return 'DRONE_MUST_BE_ARMED_BEFORE_TAKEOFF';
        }
        if (drone.flightMode !== 'GUIDED') {
          return 'TAKEOFF_REQUIRES_GUIDED_MODE';
        }
        if (!Number.isFinite(intent.altitudeMeters) || intent.altitudeMeters < 1 || intent.altitudeMeters > 120) {
          return 'INVALID_TAKEOFF_ALTITUDE';
        }
        break;
      }

      case 'LAND': {
        if (!drone.armed) {
          return 'DRONE_ALREADY_DISARMED';
        }
        break;
      }

      case 'RTL': {
        if (!telemetry.gps || now - telemetry.gps.timestamp > AppConfig.TELEMETRY_TIMEOUT) {
          return 'GPS_TELEMETRY_STALE';
        }
        if (telemetry.gps.value.gpsFix === null || telemetry.gps.value.gpsFix < 3) {
          return 'GPS_NO_3D_FIX_FOR_RTL';
        }
        break;
      }

      case 'SET_MODE': {
        if (drone.flightMode === intent.mode) {
          return 'ALREADY_IN_REQUESTED_MODE';
        }
        break;
      }

      case 'SET_HOME': {
        if (intent.useCurrent) {
          if (!telemetry.gps || !isValidCoordinate(telemetry.gps.value.latitude, telemetry.gps.value.longitude)) {
            return 'SET_HOME_REQUIRES_VALID_GPS';
          }
        } else if (!isValidCoordinate(intent.latitude, intent.longitude)) {
          return 'INVALID_HOME_COORDINATES';
        }
        break;
      }

      case 'GOTO': {
        if (!drone.armed) {
          return 'DRONE_MUST_BE_ARMED_FOR_GOTO';
        }
        if (drone.flightMode !== 'GUIDED') {
          return 'GOTO_REQUIRES_GUIDED_MODE';
        }
        if (!isValidCoordinate(intent.latitude, intent.longitude)) {
          return 'INVALID_GOTO_COORDINATES';
        }
        break;
      }

      case 'CREATE_MISSION': {
        const p = intent.proposal;
        if (!p || !p.waypoints || p.waypoints.length === 0) {
          return 'MISSION_EMPTY';
        }
        for (const wp of p.waypoints) {
          if (!isValidCoordinate(wp.latitude, wp.longitude)) {
            return 'MISSION_CONTAINS_INVALID_COORDINATES';
          }
        }
        break;
      }

      case 'START_MISSION': {
        if (!drone.armed) {
          return 'DRONE_MUST_BE_ARMED_TO_START_MISSION';
        }
        break;
      }

      default:
        break;
    }

    return null; // All deterministic safety checks passed
  }
}

export const aiActionValidator = new AiActionValidator();
