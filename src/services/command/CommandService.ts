import { CommandResult, DroneCommand, FlightMode } from '../../types/command';

export interface CommandService {
  arm(): Promise<CommandResult>;
  disarm(): Promise<CommandResult>;
  takeoff(altitude: number): Promise<CommandResult>;
  land(): Promise<CommandResult>;
  rtl(): Promise<CommandResult>;
  setMode(mode: FlightMode): Promise<CommandResult>;
  sendCommand(command: DroneCommand): Promise<CommandResult>;
}
