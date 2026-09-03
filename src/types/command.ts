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

export type CommandType = 'ARM' | 'DISARM' | 'TAKEOFF' | 'LAND' | 'RTL' | 'SET_MODE' | 'SET_HOME';
export type CommandExecutionStatus =
  | 'IDLE'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'ACCEPTED'
  | 'DENIED'
  | 'FAILED'
  | 'UNSUPPORTED'
  | 'TIMEOUT';

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

export interface SetHomeCommand {
  type: 'SET_HOME';
  payload: {
    useCurrent: boolean;
    latitude?: number;
    longitude?: number;
    altitude?: number;
  };
}

export type DroneCommand =
  | ArmCommand
  | DisarmCommand
  | TakeoffCommand
  | LandCommand
  | RtlCommand
  | SetModeCommand
  | SetHomeCommand;

export interface CommandResult {
  success: boolean;
  command: CommandType;
  timestamp: number;
  status?: CommandExecutionStatus;
  mavCommand?: number;
  mavResult?: number;
  sentAt?: number;
  ackAt?: number;
  error?: string;
}
