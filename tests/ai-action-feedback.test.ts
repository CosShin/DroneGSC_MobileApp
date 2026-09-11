import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAiActionFailure, buildAiActionNaturalStatus } from '../src/services/ai/actions/AiActionFeedback';
import type { AiActionProposal } from '../src/services/ai/intents/AiIntentTypes';

function proposal(overrides: Partial<AiActionProposal> = {}): AiActionProposal {
  return {
    id: 'prop-arm',
    intent: { type: 'ARM' },
    requiresConfirmation: true,
    requiresHoldConfirmation: true,
    title: 'ARM AIRCRAFT',
    description: 'Kích hoạt động cơ máy bay.',
    state: 'WAITING_CONFIRMATION',
    proposedAt: Date.now(),
    ...overrides,
  };
}

test('AiActionFeedback classifies ArduPilot PreArm RC not found as PREARM_FAILED', () => {
  const p = proposal({ error: 'MAV_RESULT_2', state: 'COMMAND_DENIED' });
  const result = classifyAiActionFailure(p, ['PreArm: RC not found']);

  assert.equal(result?.state, 'PREARM_FAILED');
  assert.equal(result?.title, 'Không thể ARM');
  assert.equal(result?.reason, 'RC chưa được phát hiện.');
  assert.equal(result?.technical, 'PreArm: RC not found');
});

test('AiActionFeedback produces natural timeout and denied messages without raw-first UI text', () => {
  const timeout = proposal({ intent: { type: 'SET_MODE', mode: 'LOITER' } as any, error: 'VEHICLE_CONFIRMATION_TIMEOUT', state: 'TIMEOUT' });
  const timeoutPresentation = classifyAiActionFailure(timeout, []);
  assert.equal(timeoutPresentation?.state, 'TIMEOUT');
  assert.ok(timeoutPresentation?.reason.includes('chưa nhận được xác nhận'));

  const denied = proposal({ error: 'MAV_RESULT_2', state: 'COMMAND_DENIED' });
  const deniedPresentation = classifyAiActionFailure(denied, []);
  assert.equal(deniedPresentation?.state, 'COMMAND_DENIED');
  assert.equal(buildAiActionNaturalStatus(denied, deniedPresentation), 'ARM chưa thành công: Autopilot từ chối lệnh.');
});
