import { JoystickInput, FlightControlInput } from '../../types/joystick';
import { InputMapper } from './InputMapper';
import { AppConfig } from '../../config';
import { safetyLayer } from '../command/SafetyLayer';

export type FlightControlListener = (input: FlightControlInput) => void;

class JoystickProcessor {
  private leftStick: JoystickInput = { x: 0, y: 0, active: false, timestamp: 0 };
  private rightStick: JoystickInput = { x: 0, y: 0, active: false, timestamp: 0 };
  
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: FlightControlListener[] = [];
  
  // Update inputs directly from UI (High frequency)
  updateLeftStick(x: number, y: number, active: boolean) {
    this.leftStick = { x, y, active, timestamp: Date.now() };
  }
  
  updateRightStick(x: number, y: number, active: boolean) {
    this.rightStick = { x, y, active, timestamp: Date.now() };
  }

  // UI components can subscribe to see processed output (e.g. for display)
  onProcessedInput(listener: FlightControlListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  start() {
    if (this.intervalId) return;
    
    const intervalMs = 1000 / AppConfig.JOYSTICK_UPDATE_RATE_HZ;
    
    this.intervalId = setInterval(() => {
      this.tick();
    }, intervalMs);
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Neutralize on stop
    this.updateLeftStick(0, 0, false);
    this.updateRightStick(0, 0, false);
    this.tick(); 
  }
  
  private tick() {
    const now = Date.now();
    
    // Command Timeout protection
    if (now - this.leftStick.timestamp > AppConfig.JOYSTICK_COMMAND_TIMEOUT_MS) {
      this.leftStick = { x: 0, y: 0, active: false, timestamp: now };
    }
    if (now - this.rightStick.timestamp > AppConfig.JOYSTICK_COMMAND_TIMEOUT_MS) {
      this.rightStick = { x: 0, y: 0, active: false, timestamp: now };
    }
    
    // Map raw inputs to flight control inputs
    const flightInput = InputMapper.mapInputs(this.leftStick, this.rightStick);
    
    // Notify listeners (UI feedback)
    this.listeners.forEach(l => l(flightInput));
    
    // Send to Safety Layer
    // Note: If both sticks are inactive and centered (throttle 0.5), we might not need to send constantly. 
    // But for mock, we will just send it through safety layer.
    safetyLayer.executeJoystickCommand(flightInput);
  }
}

export const joystickProcessor = new JoystickProcessor();
