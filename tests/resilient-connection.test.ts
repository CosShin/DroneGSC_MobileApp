import assert from 'node:assert/strict';
import test from 'node:test';
import { HeartbeatMonitor } from '../src/services/connection/HeartbeatMonitor';
import { LinkQualityService } from '../src/services/connection/LinkQualityService';
import { ReconnectPolicy } from '../src/services/connection/ReconnectPolicy';
import { OutboundPriorityQueue } from '../src/services/control/OutboundPriorityQueue';
import { FakeTransport } from '../src/services/mavlink/FakeTransport';
import { MavlinkManager } from '../src/services/mavlink/MavlinkManager';
import { encodeMavlinkV2 } from '../src/services/mavlink/MavlinkProtocol';

function heartbeat(systemId = 1, componentId = 1) {
  const payload = new Uint8Array(9);
  payload[4] = 2;
  payload[5] = 3;
  payload[7] = 4;
  payload[8] = 3;
  return encodeMavlinkV2(0, payload, 1, systemId, componentId);
}

test('heartbeat monitor exposes healthy, degraded, critical and lost thresholds', () => {
  let now = 10_000;
  const monitor = new HeartbeatMonitor(undefined, () => now);
  assert.equal(monitor.getSnapshot().health, 'NO_HEARTBEAT');
  monitor.recordHeartbeat();
  assert.equal(monitor.getSnapshot().health, 'HEALTHY');
  now += 1_600;
  assert.equal(monitor.getSnapshot().health, 'DEGRADED');
  now += 1_500;
  assert.equal(monitor.getSnapshot().health, 'CRITICAL');
  now += 2_000;
  assert.equal(monitor.getSnapshot().health, 'LOST');
});

test('heartbeat monitor derives interval, jitter and missed count from real samples', () => {
  let now = 1_000;
  const monitor = new HeartbeatMonitor(undefined, () => now);
  monitor.recordHeartbeat();
  now += 900;
  monitor.recordHeartbeat();
  now += 1_100;
  monitor.recordHeartbeat();
  const sampled = monitor.getSnapshot();
  assert.equal(sampled.heartbeatIntervalMs, 1_000);
  assert.equal(sampled.jitterMs, 100);
  now += 2_100;
  assert.equal(monitor.getSnapshot().missedHeartbeatCount, 2);
});

test('link quality weights heartbeat, packet loss and ACK latency without inventing RTT', () => {
  const service = new LinkQualityService();
  const healthy = service.calculate({
    transportConnected: true,
    heartbeat: {
      health: 'HEALTHY', lastHeartbeatAt: 1, heartbeatAgeMs: 100,
      heartbeatIntervalMs: 1_000, jitterMs: 10, missedHeartbeatCount: 0,
    },
    packetLossPct: 0.4,
    ackLatencyMs: 70,
    rttMs: null,
  });
  assert.equal(healthy.quality, 'EXCELLENT');
  assert.equal(healthy.videoPolicy, 'NORMAL');

  const poor = service.calculate({
    transportConnected: true,
    heartbeat: {
      health: 'CRITICAL', lastHeartbeatAt: 1, heartbeatAgeMs: 3_500,
      heartbeatIntervalMs: 1_000, jitterMs: 500, missedHeartbeatCount: 3,
    },
    packetLossPct: 18,
    ackLatencyMs: 700,
    rttMs: null,
  });
  assert.ok(poor.score < healthy.score);
  assert.equal(poor.videoPolicy, 'MINIMUM');
});

test('reconnect policy applies bounded exponential backoff with deterministic jitter', () => {
  const policy = new ReconnectPolicy({ baseDelayMs: 500, maxDelayMs: 8_000, jitterRatio: 0.2 }, () => 0.5);
  assert.deepEqual([0, 1, 2, 3, 4, 8].map(attempt => policy.delayForAttempt(attempt)), [500, 1_000, 2_000, 4_000, 8_000, 8_000]);
});

test('outbound queue keeps only the latest pending joystick value', async () => {
  const sent: number[] = [];
  let releaseFirst = () => {};
  const firstBlocked = new Promise<void>(resolve => { releaseFirst = resolve; });
  const queue = new OutboundPriorityQueue<number>(async value => {
    sent.push(value);
    if (value === 0) await firstBlocked;
  });

  const first = queue.enqueue(0, { priority: 1 });
  await Promise.resolve();
  const old = queue.enqueue(1, { priority: 1, replaceKey: 'manual-control' });
  const newer = queue.enqueue(2, { priority: 1, replaceKey: 'manual-control' });
  const latest = queue.enqueue(3, { priority: 1, replaceKey: 'manual-control' });
  releaseFirst();
  await Promise.all([first, old, newer, latest]);
  assert.deepEqual(sent, [0, 3]);
});

test('outbound queue drains emergency before control and low priority traffic', async () => {
  const sent: string[] = [];
  let releaseFirst = () => {};
  const firstBlocked = new Promise<void>(resolve => { releaseFirst = resolve; });
  const queue = new OutboundPriorityQueue<string>(async value => {
    sent.push(value);
    if (value === 'active') await firstBlocked;
  });
  const active = queue.enqueue('active', { priority: 1 });
  await Promise.resolve();
  const low = queue.enqueue('low', { priority: 4 });
  const control = queue.enqueue('control', { priority: 1 });
  const emergency = queue.enqueue('emergency', { priority: 0 });
  releaseFirst();
  await Promise.all([active, low, control, emergency]);
  assert.deepEqual(sent, ['active', 'emergency', 'control', 'low']);
});

test('disconnect invalidates an old-session COMMAND_ACK waiter immediately', async () => {
  const transport = new FakeTransport();
  const manager = new MavlinkManager();
  await manager.connect(transport, {});
  transport.inject(heartbeat());
  const pending = manager.sendCommandLongAwaitAck(400, [1], 10_000);
  manager.disconnect();
  await assert.rejects(pending, /MAVLINK_SESSION_CLOSED/);
});

test('command retry policy enforces safety classification', () => {
  const { getRetryPolicy, isRetryAllowed, READ_REQUEST_POLICY } = require('../src/services/command/CommandRetryPolicy');

  // Flight-critical commands must NEVER be auto-retried
  assert.equal(isRetryAllowed('ARM'), false);
  assert.equal(isRetryAllowed('DISARM'), false);
  assert.equal(isRetryAllowed('TAKEOFF'), false);
  assert.equal(isRetryAllowed('LAND'), false);
  assert.equal(isRetryAllowed('RTL'), false);
  assert.equal(getRetryPolicy('ARM').maxRetries, 0);
  assert.equal(getRetryPolicy('TAKEOFF').maxRetries, 0);

  // Cautious commands allow 1 retry
  assert.equal(isRetryAllowed('SET_MODE'), true);
  assert.equal(getRetryPolicy('SET_MODE').maxRetries, 1);
  assert.equal(getRetryPolicy('SET_MODE').category, 'CAUTIOUS');
  assert.equal(isRetryAllowed('SET_HOME'), true);
  assert.equal(getRetryPolicy('SET_HOME').maxRetries, 1);

  // Read requests allow safe retry
  assert.equal(READ_REQUEST_POLICY.category, 'SAFE');
  assert.equal(READ_REQUEST_POLICY.maxRetries, 3);
});

test('telemetry freshness enforces per-category message timeouts', () => {
  const { isFresh, telemetryAge, FRESHNESS_THRESHOLDS } = require('../src/config/TelemetryFreshness');

  const now = 100_000;
  // ATTITUDE (2s threshold)
  assert.equal(isFresh(now - 1_500, 'ATTITUDE_MS', now), true);
  assert.equal(isFresh(now - 2_500, 'ATTITUDE_MS', now), false);

  // VELOCITY (3s threshold)
  assert.equal(isFresh(now - 2_500, 'VELOCITY_MS', now), true);
  assert.equal(isFresh(now - 3_500, 'VELOCITY_MS', now), false);

  // GPS (5s threshold)
  assert.equal(isFresh(now - 4_000, 'GPS_MS', now), true);
  assert.equal(isFresh(now - 6_000, 'GPS_MS', now), false);

  // BATTERY (30s threshold)
  assert.equal(isFresh(now - 25_000, 'BATTERY_MS', now), true);
  assert.equal(isFresh(now - 35_000, 'BATTERY_MS', now), false);

  // Age calculation and null safety
  assert.equal(telemetryAge(null, now), null);
  assert.equal(telemetryAge(undefined, now), null);
  assert.equal(telemetryAge(0, now), null);
  assert.equal(telemetryAge(now - 1_234, now), 1_234);
});

test('link quality maps properly to VideoQualityPolicy tiers', () => {
  const service = new LinkQualityService();

  // Disconnected transport -> OFF
  const disconnected = service.calculate({
    transportConnected: false,
    heartbeat: { health: 'HEALTHY', lastHeartbeatAt: 1, heartbeatAgeMs: 100, heartbeatIntervalMs: 1000, jitterMs: 0, missedHeartbeatCount: 0 },
    packetLossPct: 0,
    ackLatencyMs: 50,
    rttMs: null,
  });
  assert.equal(disconnected.videoPolicy, 'OFF');
  assert.equal(disconnected.quality, 'CRITICAL');

  // Lost heartbeat -> OFF
  const lostHeartbeat = service.calculate({
    transportConnected: true,
    heartbeat: { health: 'LOST', lastHeartbeatAt: 1, heartbeatAgeMs: 6000, heartbeatIntervalMs: 1000, jitterMs: 0, missedHeartbeatCount: 6 },
    packetLossPct: 0,
    ackLatencyMs: 50,
    rttMs: null,
  });
  assert.equal(lostHeartbeat.videoPolicy, 'OFF');

  // Degraded link -> REDUCED
  const degraded = service.calculate({
    transportConnected: true,
    heartbeat: { health: 'DEGRADED', lastHeartbeatAt: 1, heartbeatAgeMs: 2000, heartbeatIntervalMs: 1000, jitterMs: 200, missedHeartbeatCount: 2 },
    packetLossPct: 4,
    ackLatencyMs: 250,
    rttMs: null,
  });
  assert.equal(degraded.quality, 'DEGRADED');
  assert.equal(degraded.videoPolicy, 'REDUCED');
});

