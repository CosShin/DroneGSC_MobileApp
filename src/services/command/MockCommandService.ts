import { CommandResult, DroneCommand, FlightMode } from '../../types/command';
import { CommandService } from './CommandService';
import { universalConnectionService } from '../connection/UniversalConnectionService';
import { commandLogger } from './CommandLogger';

export class MockCommandService implements CommandService {
  private createResult(command: DroneCommand['type'], success: boolean, error?: string): CommandResult {
    return {
      command,
      success,
      timestamp: Date.now(),
      error,
    };
  }

  async arm(): Promise<CommandResult> {
    const success = universalConnectionService.sendCommand('ARM');
    if (!success) {
      return this.createResult('ARM', false, 'COMMAND_SEND_FAILED');
    }
    
    universalConnectionService.updateMockState({ armed: true });
    return this.createResult('ARM', true);
  }

  async disarm(): Promise<CommandResult> {
    const success = universalConnectionService.sendCommand('DISARM');
    if (!success) return this.createResult('DISARM', false, 'COMMAND_SEND_FAILED');
    
    universalConnectionService.updateMockState({ armed: false });
    return this.createResult('DISARM', true);
  }

  async takeoff(altitude: number): Promise<CommandResult> {
    const success = universalConnectionService.sendCommand('TAKEOFF', { altitude });
    if (!success) return this.createResult('TAKEOFF', false, 'COMMAND_SEND_FAILED');
    
    universalConnectionService.updateMockState({ mode: 'TAKEOFF' });
    let currentAlt = 0;
    const interval = setInterval(() => {
      currentAlt += 0.5;
      if (currentAlt >= altitude) {
        currentAlt = altitude;
        clearInterval(interval);
        universalConnectionService.updateMockState({ mode: 'LOITER' });
      }
      universalConnectionService.updateMockState({ altitude: currentAlt, speed: 2.0 });
    }, 400);

    return this.createResult('TAKEOFF', true);
  }

  async land(): Promise<CommandResult> {
    const success = universalConnectionService.sendCommand('LAND');
    if (!success) return this.createResult('LAND', false, 'COMMAND_SEND_FAILED');
    
    universalConnectionService.updateMockState({ mode: 'LAND' });

    let currentAlt = universalConnectionService.getState().altitude || 2.0;
    const interval = setInterval(() => {
      currentAlt -= 0.5;
      if (currentAlt <= 0) {
        currentAlt = 0;
        clearInterval(interval);
        universalConnectionService.updateMockState({ altitude: 0, speed: 0, armed: false, mode: 'LOITER' });
      } else {
        universalConnectionService.updateMockState({ altitude: currentAlt, speed: 1.0 });
      }
    }, 400);

    return this.createResult('LAND', true);
  }

  async rtl(): Promise<CommandResult> {
    const success = universalConnectionService.sendCommand('RTL');
    if (!success) return this.createResult('RTL', false, 'COMMAND_SEND_FAILED');
    
    universalConnectionService.updateMockState({ mode: 'RTL', speed: 8.5 });
    return this.createResult('RTL', true);
  }

  async setMode(mode: FlightMode): Promise<CommandResult> {
    const success = universalConnectionService.sendCommand('SET_MODE', { mode });
    if (!success) return this.createResult('SET_MODE', false, 'COMMAND_SEND_FAILED');
    
    universalConnectionService.updateMockState({ mode });
    return this.createResult('SET_MODE', true);
  }

  async sendCommand(command: DroneCommand): Promise<CommandResult> {
    switch (command.type) {
      case 'ARM': return this.arm();
      case 'DISARM': return this.disarm();
      case 'TAKEOFF': return this.takeoff(command.payload.altitude);
      case 'LAND': return this.land();
      case 'RTL': return this.rtl();
      case 'SET_MODE': return this.setMode(command.payload.mode);
      default:
        return this.createResult('ARM', false, 'UNKNOWN_COMMAND');
    }
  }

  sendJoystickData(input: import('../../types/joystick').FlightControlInput) {
    if (universalConnectionService.getStatus() !== 'CONNECTED') return;
    
    const currentState = universalConnectionService.getState();
    let currentAlt = currentState.altitude;
    
    // Altitude throttle control
    if (input.throttle > 0.55) {
      currentAlt = Math.max(0, currentAlt + (input.throttle - 0.5) * 0.6);
    } else if (input.throttle < 0.45) {
      currentAlt = Math.max(0, currentAlt - (0.5 - input.throttle) * 0.6);
    }

    // Continuous Yaw Heading Integration
    let currentYaw = (currentState.yaw || 0) + (input.yaw * 3.5);
    currentYaw = ((currentYaw % 360) + 360) % 360;

    // Pitch and Roll attitude deflection
    const rollDeg = input.roll * 35;
    const pitchDeg = input.pitch * 35;

    // Calculated ground speed from stick tilt
    const stickTilt = Math.sqrt(input.pitch * input.pitch + input.roll * input.roll);
    const speed = Math.max(0.5, stickTilt * 12.0);

    universalConnectionService.sendCommand('JOYSTICK', { input });

    universalConnectionService.updateMockState({ 
      altitude: parseFloat(currentAlt.toFixed(1)),
      roll: parseFloat(rollDeg.toFixed(1)),
      pitch: parseFloat(pitchDeg.toFixed(1)),
      yaw: parseFloat(currentYaw.toFixed(1)),
      speed: parseFloat(speed.toFixed(1)),
    });
  }
}

export const mockCommandService = new MockCommandService();
