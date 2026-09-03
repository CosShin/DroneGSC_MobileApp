import { CommandResult } from '../../types/command';

class CommandLogger {
  log(result: CommandResult) {
    const time = new Date(result.timestamp).toISOString();
    if (result.success) {
      console.log(`[MAVLink COMMAND] [${time}] ${result.command} - ACCEPTED`);
    } else {
      console.warn(`[MAVLink COMMAND] [${time}] ${result.command} - ${result.status ?? 'FAILED'}: ${result.error}`);
    }
  }
}

export const commandLogger = new CommandLogger();
