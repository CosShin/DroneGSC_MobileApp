import type { FlightControlInput } from '../../types/joystick';

export type JoystickSide = 'LEFT' | 'RIGHT';

export function buildReleasedStickNeutralFrame(
  previous: FlightControlInput,
  side: JoystickSide,
  timestamp = Date.now(),
): FlightControlInput {
  return {
    roll: 0,
    pitch: 0,
    yaw: 0,
    throttle: 0.5,
    validAxes: {
      roll: side === 'RIGHT' && previous.validAxes.roll,
      pitch: side === 'RIGHT' && previous.validAxes.pitch,
      yaw: side === 'LEFT' && previous.validAxes.yaw,
      throttle: side === 'LEFT' && previous.validAxes.throttle,
    },
    timestamp,
  };
}
