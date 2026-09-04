import assert from 'node:assert/strict';
import test from 'node:test';
import telemetryReducer, {
  selectPitch,
  selectRoll,
  selectYaw,
  updateAttitude,
} from '../src/store/telemetry/telemetrySlice';

function rootWithTelemetry(telemetry: ReturnType<typeof telemetryReducer>) {
  return { telemetry } as never;
}

test('attitude selectors preserve unknown as null instead of inventing level flight', () => {
  const empty = telemetryReducer(undefined, { type: '@@init' });
  const root = rootWithTelemetry(empty);

  assert.equal(selectRoll(root), null);
  assert.equal(selectPitch(root), null);
  assert.equal(selectYaw(root), null);
});

test('attitude selectors expose the last real decoded values', () => {
  const telemetry = telemetryReducer(undefined, updateAttitude({
    value: { roll: 4, pitch: -2, yaw: 271 },
    timestamp: 123,
  }));
  const root = rootWithTelemetry(telemetry);

  assert.equal(selectRoll(root), 4);
  assert.equal(selectPitch(root), -2);
  assert.equal(selectYaw(root), 271);
});
