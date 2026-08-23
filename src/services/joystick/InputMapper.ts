import { JoystickInput, FlightControlInput } from '../../types/joystick';
import { processAxis, mapThrottle } from '../../utils/joystickMath';
import { AppConfig } from '../../config';

export class InputMapper {
  static mapInputs(
    leftStick: JoystickInput,
    rightStick: JoystickInput
  ): FlightControlInput {
    
    // Left stick: X = Yaw, Y = Throttle
    const yawRaw = leftStick.x;
    const throttleRaw = leftStick.y;
    
    // Right stick: X = Roll, Y = Pitch
    const rollRaw = rightStick.x;
    const pitchRaw = rightStick.y;
    
    const {
      JOYSTICK_DEADZONE,
      JOYSTICK_EXPO,
      JOYSTICK_SENSITIVITY,
    } = AppConfig;
    
    // Process Roll, Pitch, Yaw
    const roll = processAxis(rollRaw, JOYSTICK_DEADZONE, JOYSTICK_EXPO, JOYSTICK_SENSITIVITY);
    const pitch = processAxis(pitchRaw, JOYSTICK_DEADZONE, JOYSTICK_EXPO, JOYSTICK_SENSITIVITY);
    const yaw = processAxis(yawRaw, JOYSTICK_DEADZONE, JOYSTICK_EXPO, JOYSTICK_SENSITIVITY);
    
    // Throttle is slightly different: we process it, but usually throttle doesn't use the same
    // auto-centering expo. However, for a mock drone with standard RC, we can still process the raw
    // signal to give it deadzone, then map to 0-1.
    const throttleProcessed = processAxis(throttleRaw, JOYSTICK_DEADZONE, JOYSTICK_EXPO, JOYSTICK_SENSITIVITY);
    const throttle = mapThrottle(throttleProcessed);
    
    return {
      roll,
      pitch,
      yaw,
      throttle,
      timestamp: Date.now(),
    };
  }
}
