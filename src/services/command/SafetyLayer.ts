import { DroneCommand, CommandResult } from '../../types/command';
import { commandValidator } from './CommandValidator';
import { mockCommandService } from './MockCommandService';
import { commandLogger } from './CommandLogger';
import { store } from '../../store';
import { setPendingCommand, setCommandResult } from '../../store/command/commandSlice';
import { AppConfig } from '../../config';

class SafetyLayer {
  async executeCommand(command: DroneCommand): Promise<CommandResult> {
    // 1. Dispatch pending state
    store.dispatch(setPendingCommand(command.type));

    // 2. Validate
    const validationError = commandValidator.validate(command, store.getState());
    if (validationError) {
      const result: CommandResult = {
        command: command.type,
        success: false,
        error: validationError,
        timestamp: Date.now(),
      };
      
      commandLogger.log(result);
      store.dispatch(setCommandResult({ status: 'REJECTED', error: validationError }));
      return result;
    }

    // 3. Execute
    try {
      const result = await mockCommandService.sendCommand(command);
      
      // 4. Log and Dispatch result
      commandLogger.log(result);
      if (result.success) {
        store.dispatch(setCommandResult({ status: 'SUCCESS' }));
      } else {
        store.dispatch(setCommandResult({ status: 'FAILED', error: result.error }));
      }
      
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

  executeJoystickCommand(input: import('../../types/joystick').FlightControlInput) {
    const state = store.getState();
    const { connection, drone } = state;

    if (connection.status !== 'CONNECTED') return;

    // Pass stick inputs to mock command service for responsive physics/visualization
    mockCommandService.sendJoystickData(input);
  }
}

export const safetyLayer = new SafetyLayer();
