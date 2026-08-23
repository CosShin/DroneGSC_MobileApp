import { CommandResult } from '../../types/command';

class CommandLogger {
  log(result: CommandResult) {
    const time = new Date(result.timestamp).toISOString();
    if (result.success) {
      console.log(`[MOCK COMMAND] [${time}] ${result.command} - SUCCESS`);
    } else {
      console.warn(`[MOCK COMMAND] [${time}] ${result.command} - REJECTED: ${result.error}`);
    }
  }
}

export const commandLogger = new CommandLogger();
