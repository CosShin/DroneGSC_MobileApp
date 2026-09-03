import test from 'node:test';
import assert from 'node:assert/strict';
import { aiActionValidator } from '../src/services/ai/actions/AiActionValidator';
import type { AiActionProposal } from '../src/services/ai/intents/AiIntentTypes';
import type { RootState } from '../src/store';

function buildMockState(overrides: Partial<any> = {}): RootState {
  const base = {
    connection: {
      status: 'CONNECTED',
      vehicleState: 'CONNECTED',
      lastHeartbeat: Date.now(),
      sessionId: 'session-100',
    },
    drone: {
      armed: true,
      flightMode: 'GUIDED',
      stale: false,
    },
    telemetry: {
      stale: false,
      gps: {
        timestamp: Date.now(),
        value: {
          latitude: 10.762622,
          longitude: 106.660172,
          altitude: 0.2,
          gpsFix: 3,
        },
      },
      battery: {
        timestamp: Date.now(),
        value: { percentage: 85, voltage: 15.2 },
      },
    },
    command: {
      pendingCommand: null,
    },
    home: {
      position: { latitude: 10.762622, longitude: 106.660172, altitude: 0 },
    },
  };

  return {
    ...base,
    ...overrides,
    connection: { ...base.connection, ...(overrides.connection || {}) },
    drone: { ...base.drone, ...(overrides.drone || {}) },
    telemetry: { ...base.telemetry, ...(overrides.telemetry || {}) },
    command: { ...base.command, ...(overrides.command || {}) },
  } as any;
}

test('AiActionValidator allows valid TAKEOFF proposal when armed and in GUIDED mode', () => {
  const state = buildMockState({ drone: { armed: true, flightMode: 'GUIDED', stale: false } });
  const proposal: AiActionProposal = {
    id: 'prop-1',
    intent: { type: 'TAKEOFF', altitudeMeters: 15 },
    requiresConfirmation: true,
    title: 'TAKEOFF 15m',
    description: '',
    state: 'WAITING_CONFIRMATION',
    proposedAt: Date.now(),
    vehicleSessionId: 'session-100',
  };

  const err = aiActionValidator.validate(proposal, state, 'session-100');
  assert.equal(err, null);
});

test('AiActionValidator blocks TAKEOFF if drone is disarmed', () => {
  const state = buildMockState({ drone: { armed: false, flightMode: 'GUIDED', stale: false } });
  const proposal: AiActionProposal = {
    id: 'prop-1',
    intent: { type: 'TAKEOFF', altitudeMeters: 15 },
    requiresConfirmation: true,
    title: 'TAKEOFF 15m',
    description: '',
    state: 'WAITING_CONFIRMATION',
    proposedAt: Date.now(),
  };

  const err = aiActionValidator.validate(proposal, state);
  assert.equal(err, 'DRONE_MUST_BE_ARMED_BEFORE_TAKEOFF');
});

test('AiActionValidator blocks TAKEOFF if flight mode is not GUIDED', () => {
  const state = buildMockState({ drone: { armed: true, flightMode: 'STABILIZE', stale: false } });
  const proposal: AiActionProposal = {
    id: 'prop-1',
    intent: { type: 'TAKEOFF', altitudeMeters: 15 },
    requiresConfirmation: true,
    title: 'TAKEOFF 15m',
    description: '',
    state: 'WAITING_CONFIRMATION',
    proposedAt: Date.now(),
  };

  const err = aiActionValidator.validate(proposal, state);
  assert.equal(err, 'TAKEOFF_REQUIRES_GUIDED_MODE');
});

test('AiActionValidator blocks DISARM while vehicle is airborne (altitude > 1.0m)', () => {
  const state = buildMockState({
    drone: { armed: true, flightMode: 'LOITER', stale: false },
    telemetry: {
      stale: false,
      gps: {
        timestamp: Date.now(),
        value: { latitude: 10.76, longitude: 106.66, altitude: 12.5, gpsFix: 3 },
      },
    },
  });

  const proposal: AiActionProposal = {
    id: 'prop-disarm',
    intent: { type: 'DISARM' },
    requiresConfirmation: true,
    title: 'DISARM',
    description: '',
    state: 'WAITING_CONFIRMATION',
    proposedAt: Date.now(),
  };

  const err = aiActionValidator.validate(proposal, state);
  assert.equal(err, 'DISARM_BLOCKED_VEHICLE_AIRBORNE');
});

test('AiActionValidator allows DISARM when vehicle is landed on the ground (altitude <= 1.0m)', () => {
  const state = buildMockState({
    drone: { armed: true, flightMode: 'LOITER', stale: false },
    telemetry: {
      stale: false,
      gps: {
        timestamp: Date.now(),
        value: { latitude: 10.76, longitude: 106.66, altitude: 0.1, gpsFix: 3 },
      },
    },
  });

  const proposal: AiActionProposal = {
    id: 'prop-disarm',
    intent: { type: 'DISARM' },
    requiresConfirmation: true,
    title: 'DISARM',
    description: '',
    state: 'WAITING_CONFIRMATION',
    proposedAt: Date.now(),
  };

  const err = aiActionValidator.validate(proposal, state);
  assert.equal(err, null);
});

test('AiActionValidator blocks actions when vehicle is disconnected or session has expired', () => {
  // 1. Disconnected
  const disconnectedState = buildMockState({ connection: { status: 'DISCONNECTED', vehicleState: 'NO_VEHICLE' } });
  const proposal: AiActionProposal = {
    id: 'prop-arm',
    intent: { type: 'ARM' },
    requiresConfirmation: true,
    title: 'ARM',
    description: '',
    state: 'WAITING_CONFIRMATION',
    proposedAt: Date.now(),
    vehicleSessionId: 'session-old',
  };

  assert.equal(aiActionValidator.validate(proposal, disconnectedState), 'NO_FRESH_VEHICLE_CONNECTED');

  // 2. Session changed
  const reconnectedState = buildMockState({ connection: { status: 'CONNECTED', vehicleState: 'CONNECTED', sessionId: 'session-new' } });
  assert.equal(
    aiActionValidator.validate(proposal, reconnectedState, 'session-new'),
    'PROPOSAL_SESSION_EXPIRED'
  );
});

test('AiActionValidator blocks RTL when GPS fix is insufficient (< 3D fix)', () => {
  const noFixState = buildMockState({
    telemetry: {
      stale: false,
      gps: {
        timestamp: Date.now(),
        value: { latitude: 10.76, longitude: 106.66, altitude: 10, gpsFix: 1 }, // No 3D fix
      },
    },
  });

  const proposal: AiActionProposal = {
    id: 'prop-rtl',
    intent: { type: 'RTL' },
    requiresConfirmation: true,
    title: 'RTL',
    description: '',
    state: 'WAITING_CONFIRMATION',
    proposedAt: Date.now(),
  };

  assert.equal(aiActionValidator.validate(proposal, noFixState), 'GPS_NO_3D_FIX_FOR_RTL');
});
