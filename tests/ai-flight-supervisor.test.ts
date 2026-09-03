import test from 'node:test';
import assert from 'node:assert/strict';
import { AiFlightSupervisor, SupervisorAlert } from '../src/services/ai/supervisor/AiFlightSupervisor';
import type { RootState } from '../src/store';

function buildSupervisorState(overrides: Partial<any> = {}): RootState {
  const base = {
    connection: {
      status: 'CONNECTED',
      vehicleState: 'CONNECTED',
      lastHeartbeat: Date.now(),
    },
    drone: {
      armed: true,
      flightMode: 'AUTO',
      stale: false,
    },
    telemetry: {
      stale: false,
      gps: {
        timestamp: Date.now(),
        value: {
          latitude: 10.762622,
          longitude: 106.660172,
          altitude: 20,
          gpsFix: 3,
        },
      },
      battery: {
        timestamp: Date.now(),
        value: { percentage: 22, voltage: 14.6 }, // Low battery (< 25%)
      },
    },
    home: {
      position: { latitude: 10.760000, longitude: 106.660000, altitude: 0 },
    },
  };

  return {
    ...base,
    ...overrides,
    connection: { ...base.connection, ...(overrides.connection || {}) },
    drone: { ...base.drone, ...(overrides.drone || {}) },
    telemetry: { ...base.telemetry, ...(overrides.telemetry || {}) },
  } as any;
}

test('AiFlightSupervisor detects low battery in flight and emits advisory alert', () => {
  const supervisor = new AiFlightSupervisor();
  const alerts: SupervisorAlert[] = [];
  supervisor.subscribe(a => alerts.push(a));

  const lowBatState = buildSupervisorState();
  supervisor.evaluateTelemetry(lowBatState);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].level, 'WARNING');
  assert.ok(alerts[0].message.includes('22%'));
  assert.equal(alerts[0].suggestedAction, 'RTL');
});

test('AiFlightSupervisor detects GPS loss during autonomous mission and emits CRITICAL alert', () => {
  const supervisor = new AiFlightSupervisor();
  const alerts: SupervisorAlert[] = [];
  supervisor.subscribe(a => alerts.push(a));

  const gpsLossState = buildSupervisorState({
    telemetry: {
      stale: false,
      battery: { timestamp: Date.now(), value: { percentage: 80 } },
      gps: {
        timestamp: Date.now(),
        value: { latitude: 10.76, longitude: 106.66, altitude: 20, gpsFix: 1 }, // Degraded fix
      },
    },
    drone: { armed: true, flightMode: 'AUTO', stale: false },
  });

  supervisor.evaluateTelemetry(gpsLossState);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].level, 'CRITICAL');
  assert.ok(alerts[0].message.includes('GPS mất 3D Fix'));
});

test('AiFlightSupervisor does not emit alert when vehicle is healthy', () => {
  const supervisor = new AiFlightSupervisor();
  const alerts: SupervisorAlert[] = [];
  supervisor.subscribe(a => alerts.push(a));

  const healthyState = buildSupervisorState({
    telemetry: {
      stale: false,
      battery: { timestamp: Date.now(), value: { percentage: 90 } },
      gps: { timestamp: Date.now(), value: { latitude: 10.76, longitude: 106.66, altitude: 20, gpsFix: 3 } },
    },
  });

  supervisor.evaluateTelemetry(healthyState);
  assert.equal(alerts.length, 0);
});
