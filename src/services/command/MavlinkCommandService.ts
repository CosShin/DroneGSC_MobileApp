import { universalConnectionService } from '../connection/UniversalConnectionService';
import { CommandExecutionStatus, CommandResult, DroneCommand, FlightMode } from '../../types/command';
import { CommandService } from './CommandService';
import { buildSetHomeCommandParams } from '../home/HomeProtocol';
import { getRetryPolicy, isRetryAllowed } from './CommandRetryPolicy';

const COPTER_MODE: Record<FlightMode, number> = {
  STABILIZE: 0, ALT_HOLD: 2, LOITER: 5, POSHOLD: 16,
  GUIDED: 4, AUTO: 3, RTL: 6, LAND: 9,
};

export function getMavCommandId(command: DroneCommand['type']) {
  switch (command) {
    case 'ARM':
    case 'DISARM': return 400;
    case 'TAKEOFF': return 22;
    case 'LAND': return 21;
    case 'RTL': return 20;
    case 'SET_MODE': return 176;
    case 'SET_HOME': return 179;
  }
}

function mavResultStatus(result: number): CommandExecutionStatus {
  if (result === 0 || result === 5) return 'IN_PROGRESS';
  if (result === 1 || result === 2 || result === 10) return 'DENIED';
  if (result === 3 || result === 7 || result === 8 || result === 9) return 'UNSUPPORTED';
  return 'FAILED';
}

export class MavlinkCommandService implements CommandService {
  private result(
    command: DroneCommand['type'],
    status: CommandExecutionStatus,
    details: Partial<CommandResult> = {},
  ): CommandResult {
    return {
      ...details,
      command,
      success: status === 'ACCEPTED',
      status,
      timestamp: Date.now(),
    };
  }

  private async command(command: DroneCommand['type'], mavCommand: number, params: number[] = []) {
    const policy = getRetryPolicy(command);
    const maxAttempts = 1 + (policy.category !== 'NEVER' ? policy.maxRetries : 0);
    let lastResult: CommandResult | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0 && policy.retryDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, policy.retryDelayMs));
      }
      const sentAt = Date.now();
      try {
        const ack = await universalConnectionService.sendMavlinkCommand(mavCommand, params);
        const status = mavResultStatus(ack.result);
        if (ack.result !== 0) {
          return this.result(command, status, {
            mavCommand,
            mavResult: ack.result,
            sentAt,
            ackAt: ack.receivedAt,
            retryCount: attempt,
            error: `MAV_RESULT_${ack.result}`,
          });
        }
        return this.result(command, 'IN_PROGRESS', {
          mavCommand,
          mavResult: ack.result,
          sentAt,
          ackAt: ack.receivedAt,
          retryCount: attempt,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'COMMAND_FAILED';
        lastResult = this.result(command, message === 'COMMAND_TIMEOUT' ? 'TIMEOUT' : 'FAILED', {
          mavCommand,
          sentAt,
          retryCount: attempt,
          error: message,
        });
        if (message !== 'COMMAND_TIMEOUT' || !isRetryAllowed(command)) {
          break;
        }
      }
    }
    return lastResult!;
  }

  async arm() {
    const ack = await this.command('ARM', 400, [1]);
    return ack.status === 'IN_PROGRESS' ? this.waitForState('ARM', value => value.armed, ack) : ack;
  }
  async disarm() {
    const ack = await this.command('DISARM', 400, [0]);
    return ack.status === 'IN_PROGRESS' ? this.waitForState('DISARM', value => !value.armed, ack) : ack;
  }
  async takeoff(altitude: number) {
    const ack = await this.command('TAKEOFF', 22, [0, 0, 0, 0, 0, 0, altitude]);
    return ack.status === 'IN_PROGRESS' ? this.result('TAKEOFF', 'ACCEPTED', ack) : ack;
  }
  async land() {
    const ack = await this.command('LAND', 21);
    return ack.status === 'IN_PROGRESS' ? this.result('LAND', 'ACCEPTED', ack) : ack;
  }
  async rtl() {
    const ack = await this.command('RTL', 20);
    return ack.status === 'IN_PROGRESS' ? this.result('RTL', 'ACCEPTED', ack) : ack;
  }
  async setMode(mode: FlightMode) {
    const ack = await this.command('SET_MODE', 176, [1, COPTER_MODE[mode]]);
    return ack.status === 'IN_PROGRESS' ? this.waitForState('SET_MODE', value => value.mode === mode, ack) : ack;
  }
  async setHome(payload: { useCurrent: boolean; latitude?: number; longitude?: number; altitude?: number }) {
    const params = buildSetHomeCommandParams(payload);
    const ack = await this.command('SET_HOME', 179, params);
    return ack.status === 'IN_PROGRESS' ? this.result('SET_HOME', 'ACCEPTED', ack) : ack;
  }

  async sendCommand(command: DroneCommand): Promise<CommandResult> {
    switch (command.type) {
      case 'ARM': return this.arm();
      case 'DISARM': return this.disarm();
      case 'TAKEOFF': return this.takeoff(command.payload.altitude);
      case 'LAND': return this.land();
      case 'RTL': return this.rtl();
      case 'SET_MODE': return this.setMode(command.payload.mode);
      case 'SET_HOME': return this.setHome(command.payload);
    }
  }

  private waitForState(
    command: DroneCommand['type'],
    matches: (value: ReturnType<typeof universalConnectionService.getState>) => boolean,
    ack: CommandResult,
  ) {
    return new Promise<CommandResult>(resolve => {
      const sessionId = universalConnectionService.getMavlinkSessionId();
      const acceptedAt = ack.ackAt ?? Date.now();
      let settled = false;
      let unsubscribeTelemetry = () => {};
      let unsubscribeStatus = () => {};
      const finish = (result: CommandResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        unsubscribeTelemetry();
        unsubscribeStatus();
        resolve(result);
      };
      const confirm = (value: ReturnType<typeof universalConnectionService.getState>) => {
        if (universalConnectionService.getMavlinkSessionId() !== sessionId) {
          finish(this.result(command, 'FAILED', { ...ack, error: 'VEHICLE_SESSION_CHANGED' }));
          return;
        }
        const confirmedAfterAck = value.lastHeartbeatAt != null && value.lastHeartbeatAt > acceptedAt;
        if (universalConnectionService.isVehicleFresh() && !value.stale && confirmedAfterAck && matches(value)) {
          finish(this.result(command, 'ACCEPTED', ack));
        }
      };
      unsubscribeTelemetry = universalConnectionService.onTelemetry(confirm);
      unsubscribeStatus = universalConnectionService.onStatusChange(status => {
        if (status === 'DISCONNECTED' || status === 'ERROR') {
          finish(this.result(command, 'FAILED', { ...ack, error: 'VEHICLE_CONNECTION_LOST' }));
        }
      });
      const timeout = setTimeout(() => {
        finish(this.result(command, 'TIMEOUT', { ...ack, error: 'VEHICLE_CONFIRMATION_TIMEOUT' }));
      }, 5_000);
      confirm(universalConnectionService.getState());
    });
  }
}

export const mavlinkCommandService = new MavlinkCommandService();
