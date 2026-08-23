export interface JoystickInput {
  x: number;
  y: number;
  active: boolean;
  timestamp: number;
}

export interface FlightControlInput {
  roll: number;
  pitch: number;
  yaw: number;
  throttle: number;
  timestamp: number;
}
