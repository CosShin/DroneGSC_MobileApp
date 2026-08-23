export enum FlightMode {
  STABILIZE = 'STABILIZE',
  ALT_HOLD = 'ALT_HOLD',
  LOITER = 'LOITER',
  POSHOLD = 'POSHOLD',
  GUIDED = 'GUIDED',
  AUTO = 'AUTO',
  RTL = 'RTL',
  LAND = 'LAND',
}

export type CommandType = 'ARM' | 'DISARM' | 'TAKEOFF' | 'LAND' | 'RTL' | 'SET_MODE';

export interface ArmCommand {
  type: 'ARM';
}

export interface DisarmCommand {
  type: 'DISARM';
}

export interface TakeoffCommand {
  type: 'TAKEOFF';
  payload: {
    altitude: number;
  };
}

export interface LandCommand {
  type: 'LAND';
}

export interface RtlCommand {
  type: 'RTL';
}

export interface SetModeCommand {
  type: 'SET_MODE';
  payload: {
    mode: FlightMode;
  };
}

export type DroneCommand =
  | ArmCommand
  | DisarmCommand
  | TakeoffCommand
  | LandCommand
  | RtlCommand
  | SetModeCommand;

export interface CommandResult {
  success: boolean;
  command: CommandType;
  timestamp: number;
  error?: string;
}
