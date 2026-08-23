import { JoystickSettings } from '../types/joystick';

export const DEFAULT_JOYSTICK_CONFIG: JoystickSettings = {
  deadzone: 0.1, // 10% deadzone
  expo: 0.4, // Moderate exponential curve
  sensitivity: 1.0, // Default multiplier
  maxOutput: 1.0, // 100% throw
  updateRateHz: 20, // 20Hz sending rate
};
