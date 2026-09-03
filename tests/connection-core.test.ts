import assert from 'node:assert/strict';
import test from 'node:test';
import { ConnectionLogger } from '../src/services/connection/ConnectionLogger';
import { ConnectionStateMachine } from '../src/services/connection/ConnectionStateMachine';
import { FakeTransport } from '../src/services/mavlink/FakeTransport';
import { MavlinkManager } from '../src/services/mavlink/MavlinkManager';
import { encodeMavlinkV2 } from '../src/services/mavlink/MavlinkProtocol';

function heartbeat(systemId = 1, componentId = 1, customMode = 5) {
  const payload = new Uint8Array(9);
  new DataView(payload.buffer).setUint32(0, customMode, true);
  payload[4] = 2; // MAV_TYPE_QUADROTOR
  payload[5] = 3; // MAV_AUTOPILOT_ARDUPILOTMEGA
  payload[6] = 0x80;
  payload[7] = 4;
  payload[8] = 3;
  return encodeMavlinkV2(0, payload, 7, systemId, componentId);
}

test('connection state machine follows the production happy path', () => {
  const machine = new ConnectionStateMachine();
  machine.transition('OPENING_TRANSPORT');
  machine.transition('TRANSPORT_READY');
  machine.transition('WAITING_HEARTBEAT');
  machine.transition('VEHICLE_DETECTED');
  machine.transition('LINK_ACTIVE');
  machine.transition('DEGRADED', 'heartbeat timeout');
  machine.transition('LINK_ACTIVE', 'heartbeat recovered');
  assert.equal(machine.getSnapshot().phase, 'LINK_ACTIVE');
  machine.close();
  assert.equal(machine.getSnapshot().phase, 'IDLE');
});

test('connection state machine rejects impossible transitions', () => {
  const machine = new ConnectionStateMachine();
  assert.throws(
    () => machine.transition('LINK_ACTIVE'),
    /INVALID_CONNECTION_TRANSITION_IDLE_TO_LINK_ACTIVE/,
  );
});

test('connection state machine can recover before a scheduled reconnect runs', () => {
  const machine = new ConnectionStateMachine();
  machine.transition('OPENING_TRANSPORT');
  machine.transition('TRANSPORT_READY');
  machine.transition('WAITING_HEARTBEAT');
  machine.transition('VEHICLE_DETECTED');
  machine.transition('LINK_ACTIVE');
  machine.transition('DEGRADED');
  machine.transition('RECONNECTING');
  machine.transition('LINK_ACTIVE');
  assert.equal(machine.getSnapshot().phase, 'LINK_ACTIVE');
});

test('connection logger remains bounded and does not expose mutable storage', () => {
  const logger = new ConnectionLogger(2);
  for (let index = 0; index < 3; index++) {
    logger.write({
      level: 'INFO',
      category: 'STATE',
      code: `EVENT_${index}`,
      message: `event ${index}`,
    });
  }
  const entries = logger.list();
  assert.deepEqual(entries.map(entry => entry.code), ['EVENT_1', 'EVENT_2']);
  entries[0].message = 'mutated';
  assert.equal(logger.list()[0].message, 'event 1');
});

test('layered connection state: MavlinkManager transitions transport -> vehicle heartbeat', async () => {
  const fakeTransport = new FakeTransport();
  const manager = new MavlinkManager();

  await manager.connect(fakeTransport, {});
  assert.equal(fakeTransport.getStatus(), 'READY');
  assert.equal(manager.getState().lastHeartbeatAt, null);
  assert.equal(manager.getState().systemId, null);

  // Inject heartbeat to activate vehicle
  fakeTransport.inject(heartbeat(1, 1), { address: '127.0.0.1', port: 14550 });
  assert.ok(manager.getState().lastHeartbeatAt !== null);
  assert.equal(manager.getState().systemId, 1);
  assert.equal(manager.getState().componentId, 1);

  manager.disconnect();
  assert.equal(fakeTransport.getStatus(), 'IDLE');
  assert.equal(manager.getState().lastHeartbeatAt, null);
});

test('MavlinkManager handles switching transports cleanly without leaking listeners', async () => {
  const manager = new MavlinkManager();
  const transportA = new FakeTransport();
  const transportB = new FakeTransport();

  await manager.connect(transportA, {});
  assert.equal(transportA.getStatus(), 'READY');
  transportA.inject(heartbeat(1, 1), { address: '127.0.0.1', port: 14550 });
  assert.equal(manager.getState().systemId, 1);

  // Switch to Transport B
  await manager.connect(transportB, {});
  assert.equal(transportA.getStatus(), 'IDLE');
  assert.equal(transportB.getStatus(), 'READY');

  // Old transport data should not affect manager
  transportA.inject(heartbeat(2, 1), { address: '127.0.0.1', port: 14550 });
  assert.notEqual(manager.getState().systemId, 2);

  // New transport receives heartbeat
  transportB.inject(heartbeat(2, 1), { address: '127.0.0.1', port: 14550 });
  assert.equal(manager.getState().systemId, 2);

  manager.disconnect();
  assert.equal(transportB.getStatus(), 'IDLE');
});
