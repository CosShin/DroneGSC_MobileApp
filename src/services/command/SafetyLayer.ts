import { DroneCommand, CommandResult } from '../../types/command';
import { commandValidator } from './CommandValidator';
import { getMavCommandId, mavlinkCommandService } from './MavlinkCommandService';
import { commandLogger } from './CommandLogger';
import { store } from '../../store';
import { setPendingCommand, setCommandResult } from '../../store/command/commandSlice';
import { universalConnectionService } from '../connection/UniversalConnectionService';

class SafetyLayer {
  private readonly joystickModes = new Set(['STABILIZE', 'ALT_HOLD', 'LOITER', 'POSHOLD', 'GUIDED']);
  async executeCommand(command: DroneCommand): Promise<CommandResult> {
    // Validate against the last confirmed vehicle state before marking the command pending.
    const validationError = commandValidator.validate(command, store.getState());
    if (validationError) {
      console.warn(`[MAVLink] COMMAND BLOCKED type=${command.type} reason=${validationError}`);
      const result: CommandResult = {
        command: command.type,
        success: false,
        error: validationError,
        timestamp: Date.now(),
      };
      
      commandLogger.log(result);
      store.dispatch(setCommandResult({ status: 'DENIED', error: validationError }));
      return result;
    }

    store.dispatch(setPendingCommand({ command: command.type, mavCommand: getMavCommandId(command.type) }));
    console.log(`[MAVLink] COMMAND REQUEST type=${command.type}`);

    // 3. Execute
    try {
      const result = await mavlinkCommandService.sendCommand(command);
      
      // 4. Log and Dispatch result
      commandLogger.log(result);
      store.dispatch(setCommandResult({
        status: result.status ?? (result.success ? 'ACCEPTED' : 'FAILED'),
        error: result.error,
        result: result.mavResult,
        ackAt: result.ackAt,
      }));
      
      return result;
    } catch (e: any) {
      const result: CommandResult = {
        command: command.type,
        success: false,
        error: e.message || 'UNKNOWN_ERROR',
        timestamp: Date.now(),
      };
      commandLogger.log(result);
      store.dispatch(setCommandResult({ status: 'FAILED', error: result.error }));
      return result;
    }
  }

  executeJoystickCommand(
    input: import('../../types/joystick').FlightControlInput,
    intent: { deadmanActive?: boolean; finalNeutral?: boolean } = {},
  ) {
    const state = store.getState();
    const { connection, drone } = state;

    if (!intent.deadmanActive && !intent.finalNeutral) return false;
    if (connection.status !== 'CONNECTED' || connection.vehicleState !== 'CONNECTED') return false;
    if (!drone.armed || drone.stale) return false;
    if (!this.joystickModes.has(drone.flightMode)) return false;
    universalConnectionService.sendPilotControl(input).catch(error => {
      console.warn('[MAVLink] MANUAL_CONTROL send failed', error);
    });
    return true;
  }
}

export const safetyLayer = new SafetyLayer();
