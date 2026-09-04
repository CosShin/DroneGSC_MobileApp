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
  validAxes: {
    roll: boolean;
    pitch: boolean;
    yaw: boolean;
    throttle: boolean;
  };
  timestamp: number;
}
