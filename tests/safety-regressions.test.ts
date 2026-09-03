import assert from 'node:assert/strict';
import test from 'node:test';
import { CommandValidator } from '../src/services/command/CommandValidator';
import telemetryReducer, { updateTelemetrySnapshot } from '../src/store/telemetry/telemetrySlice';

test('DISARM is blocked when altitude is unavailable', () => {
  const state = {
    connection: { status: 'CONNECTED', vehicleState: 'CONNECTED', lastHeartbeat: Date.now() },
    drone: { armed: true, stale: false, flightMode: 'STABILIZE' },
    telemetry: { stale: false, gps: null },
    command: { pendingCommand: null },
  };
  assert.equal(new CommandValidator().validate({ type: 'DISARM' }, state as never), 'DISARM_REQUIRES_VALID_ALTITUDE');
});

test('stationary GPS refreshes its source timestamp without changing coordinates', () => {
  const gps = { latitude: 10.8, longitude: 106.6, altitude: 0.2, satellites: 12, hdop: 0.8, gpsFix: 3 };
  let state = telemetryReducer(undefined, updateTelemetrySnapshot({
    timestamp: 100,
    gpsTimestamp: 90,
    stale: false,
    gps,
    attitude: null,
    velocity: null,
  }));
  state = telemetryReducer(state, updateTelemetrySnapshot({
    timestamp: 200,
    gpsTimestamp: 190,
    stale: false,
    gps,
    attitude: null,
    velocity: null,
  }));
  assert.equal(state.gps?.timestamp, 190);
});
