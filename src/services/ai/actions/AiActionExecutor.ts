import { safetyLayer } from '../../command/SafetyLayer';
import { mavlinkCommandService } from '../../command/MavlinkCommandService';
import type { DroneCommand } from '../../../types/command';
import type { RootState } from '../../../store';
import { aiActionValidator } from './AiActionValidator';
import { aiActionAuditLog } from './AiActionAuditLog';
import { aiSpeechService } from '../../voice/AiSpeechService';
import type { AiActionProposal } from '../intents/AiIntentTypes';

let lazyStore: { getState: () => RootState } | null = null;
function getStoreState(): RootState | null {
  if (!lazyStore) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      lazyStore = require('../../../store').store;
    } catch {
      lazyStore = null;
    }
  }
  return lazyStore ? lazyStore.getState() : null;
}

export class AiActionExecutor {
  /**
   * Executes an AI action proposal AFTER pilot confirmation.
   * Deterministically re-validates fresh vehicle state immediately before sending.
   */
  async executeConfirmed(
    proposal: AiActionProposal,
    currentSessionId?: string | null,
    onStateChange?: (p: AiActionProposal) => void,
  ): Promise<{ success: boolean; error?: string }> {
    const state = getStoreState();
    if (!state) {
      proposal.state = 'FAILED';
      proposal.error = 'STORE_UNAVAILABLE';
      onStateChange?.(proposal);
      return { success: false, error: 'STORE_UNAVAILABLE' };
    }

    // 1. Deterministic fresh-state revalidation
    proposal.state = 'VALIDATING';
    onStateChange?.(proposal);

    const validationError = aiActionValidator.validate(proposal, state, currentSessionId);
    if (validationError) {
      proposal.state = 'FAILED';
      proposal.error = validationError;
      onStateChange?.(proposal);

      aiActionAuditLog.log({
        intentType: proposal.intent.type,
        source: 'VOICE',
        summary: `Blocked by safety validator: ${validationError}`,
        pilotAction: 'REJECTED_VALIDATION',
      });

      return { success: false, error: validationError };
    }

    // 2. Map intent to existing DroneCommand
    const droneCommand = this.mapIntentToDroneCommand(proposal);
    if (!droneCommand) {
      proposal.state = 'FAILED';
      proposal.error = 'UNSUPPORTED_DIRECT_COMMAND';
      onStateChange?.(proposal);
      return { success: false, error: 'UNSUPPORTED_DIRECT_COMMAND' };
    }

    // 3. Dispatch through existing SafetyLayer
    proposal.state = 'SENDING';
    onStateChange?.(proposal);

    aiActionAuditLog.log({
      intentType: proposal.intent.type,
      source: 'VOICE',
      summary: `Sending ${droneCommand.type} command to autopilot`,
      pilotAction: 'CONFIRMED',
      mavCommandId: droneCommand.type === 'ARM' || droneCommand.type === 'DISARM' ? 400 : undefined,
    });

    try {
      proposal.state = 'WAITING_ACK';
      onStateChange?.(proposal);

      const result = await safetyLayer.executeCommand(droneCommand);

      if (result.success) {
        proposal.state = 'SUCCESS';
        proposal.ackResult = result.mavResult ?? 0;
        onStateChange?.(proposal);

        aiActionAuditLog.log({
          intentType: proposal.intent.type,
          source: 'VOICE',
          summary: `${droneCommand.type} accepted and confirmed by vehicle`,
          pilotAction: 'CONFIRMED',
          ackResult: result.mavResult ?? 0,
          stateConfirmed: true,
        });

        // Spoken confirmation to pilot
        const spokenConfirmation = this.getSpokenSuccessPhrase(proposal);
        if (spokenConfirmation) {
          void aiSpeechService.speak(spokenConfirmation, { language: 'vi-VN' });
        }

        return { success: true };
      } else {
        proposal.state = 'FAILED';
        proposal.error = result.error || 'COMMAND_FAILED';
        onStateChange?.(proposal);

        aiActionAuditLog.log({
          intentType: proposal.intent.type,
          source: 'VOICE',
          summary: `${droneCommand.type} rejected or timed out: ${result.error}`,
          pilotAction: 'CONFIRMED',
          ackResult: result.mavResult,
          stateConfirmed: false,
        });

        return { success: false, error: result.error };
      }
    } catch (err: any) {
      proposal.state = 'FAILED';
      proposal.error = err?.message || 'EXECUTION_ERROR';
      onStateChange?.(proposal);
      return { success: false, error: proposal.error || 'EXECUTION_ERROR' };
    }
  }

  /**
   * Pilot explicitly cancels the proposal.
   * Guarantees ZERO commands sent to vehicle.
   */
  cancelProposal(proposal: AiActionProposal, onStateChange?: (p: AiActionProposal) => void) {
    proposal.state = 'CANCELLED';
    onStateChange?.(proposal);

    aiActionAuditLog.log({
      intentType: proposal.intent.type,
      source: 'VOICE',
      summary: `Pilot cancelled proposal: ${proposal.title}`,
      pilotAction: 'CANCELLED',
    });
  }

  private mapIntentToDroneCommand(proposal: AiActionProposal): DroneCommand | null {
    const intent = proposal.intent;
    switch (intent.type) {
      case 'ARM':
        return { type: 'ARM' };
      case 'DISARM':
        return { type: 'DISARM' };
      case 'TAKEOFF':
        return { type: 'TAKEOFF', payload: { altitude: intent.altitudeMeters } };
      case 'LAND':
        return { type: 'LAND' };
      case 'RTL':
        return { type: 'RTL' };
      case 'SET_MODE':
        return { type: 'SET_MODE', payload: { mode: intent.mode } };
      case 'SET_HOME':
        return {
          type: 'SET_HOME',
          payload: {
            useCurrent: intent.useCurrent,
            latitude: intent.latitude,
            longitude: intent.longitude,
            altitude: intent.altitude,
          },
        };
      default:
        return null;
    }
  }

  private getSpokenSuccessPhrase(proposal: AiActionProposal): string | null {
    switch (proposal.intent.type) {
      case 'ARM': return 'Drone đã ARM thành công.';
      case 'DISARM': return 'Drone đã DISARM thành công.';
      case 'TAKEOFF': return `Drone đang cất cánh lên ${proposal.intent.altitudeMeters} mét.`;
      case 'LAND': return 'Drone đang thực hiện hạ cánh.';
      case 'RTL': return 'Drone đang quay về điểm Home.';
      case 'SET_MODE': return `Drone đã chuyển sang chế độ ${proposal.intent.mode}.`;
      default: return null;
    }
  }
}

export const aiActionExecutor = new AiActionExecutor();
