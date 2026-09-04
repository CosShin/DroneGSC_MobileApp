import assert from 'node:assert/strict';
import test from 'node:test';
import { FakeTransport } from '../src/services/mavlink/FakeTransport';
import { MavlinkManager } from '../src/services/mavlink/MavlinkManager';
import { encodeMavlinkV2, MavlinkParser } from '../src/services/mavlink/MavlinkProtocol';
import { MavlinkSigningSession } from '../src/services/mavlink/MavlinkSigning';

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

function sysStatus(percentage: number, voltageMv = 12000, sequence = 8) {
  const payload = new Uint8Array(19);
  const view = new DataView(payload.buffer);
  view.setUint16(14, voltageMv, true);
  view.setInt16(16, 250, true);
  view.setInt8(18, percentage);
  return encodeMavlinkV2(1, payload, sequence, 1, 1);
}

function batteryStatus(percentage: number, cellsMv: number[], batteryId = 0, sequence = 9) {
  const payload = new Uint8Array(36);
  const view = new DataView(payload.buffer);
  for (let index = 0; index < 10; index++) view.setUint16(10 + index * 2, 65535, true);
  cellsMv.forEach((value, index) => view.setUint16(10 + index * 2, value, true));
  view.setInt16(30, 300, true);
  payload[32] = batteryId;
  view.setInt8(35, percentage);
  return encodeMavlinkV2(147, payload, sequence, 1, 1);
}

function commandAck(command: number, componentId: number, sequence: number) {
  const payload = new Uint8Array(10);
  const view = new DataView(payload.buffer);
  view.setUint16(0, command, true);
  payload[2] = 0;
  payload[8] = 255;
  payload[9] = 190;
  return encodeMavlinkV2(77, payload, sequence, 1, componentId);
}

function homePosition(
  latitude: number,
  longitude: number,
  altitudeMsl: number,
  componentId = 1,
  sequence = 12,
) {
  const payload = new Uint8Array(52);
  const view = new DataView(payload.buffer);
  view.setInt32(0, Math.round(latitude * 1e7), true);
  view.setInt32(4, Math.round(longitude * 1e7), true);
  view.setInt32(8, Math.round(altitudeMsl * 1000), true);
  return encodeMavlinkV2(242, payload, sequence, 1, componentId);
}

function globalPositionInt(altitudeMsl: number, relativeAltitude: number, sequence = 13) {
  const payload = new Uint8Array(28);
  const view = new DataView(payload.buffer);
  view.setInt32(4, Math.round(10.841883 * 1e7), true);
  view.setInt32(8, Math.round(106.676717 * 1e7), true);
  view.setInt32(12, Math.round(altitudeMsl * 1000), true);
  view.setInt32(16, Math.round(relativeAltitude * 1000), true);
  return encodeMavlinkV2(33, payload, sequence, 1, 1);
}

function signedHeartbeat() {
  const unsigned = heartbeat();
  const signed = new Uint8Array(unsigned.length + 13);
  signed.set(unsigned);
  signed[2] = 1;
  let crc = 0xffff;
  const accumulate = (byte: number) => {
    let value = byte ^ (crc & 0xff);
    value ^= (value << 4) & 0xff;
    crc = ((crc >> 8) ^ (value << 8) ^ (value << 3) ^ (value >> 4)) & 0xffff;
  };
  for (const byte of signed.slice(1, 19)) accumulate(byte);
  accumulate(50);
  signed[19] = crc & 0xff;
  signed[20] = crc >> 8;
  return signed;
}

test('transport diagnostics report real RX/TX counters without exposing MAVLink internals', async () => {
  const transport = new FakeTransport();
  await transport.connect({});
  await transport.send(new Uint8Array([1, 2, 3]));
  transport.inject(new Uint8Array([4, 5]), { address: '10.0.0.2', port: 14550 });

  const diagnostics = transport.getDiagnostics();
  assert.equal(diagnostics.kind, 'FAKE');
  assert.equal(diagnostics.status, 'READY');
  assert.equal(diagnostics.txBytes, 3);
  assert.equal(diagnostics.rxBytes, 2);
  assert.equal(diagnostics.txPackets, 1);
  assert.equal(diagnostics.rxPackets, 1);
  assert.ok(diagnostics.connectedAt);
  assert.ok(diagnostics.lastDataAt);
});

test('streaming parser preserves a fragmented MAVLink 2 frame', () => {
  const parser = new MavlinkParser();
  const frame = heartbeat();
  assert.equal(parser.push(frame.slice(0, 5)).length, 0);
  assert.equal(parser.getDiagnostics().bufferedBytes, 5);
  const decoded = parser.push(frame.slice(5));
  assert.equal(decoded.length, 1);
  assert.equal(decoded[0].messageId, 0);
  assert.equal(decoded[0].systemId, 1);
  assert.equal(parser.getDiagnostics().framesAccepted, 1);
});

test('streaming parser handles multiple frames and reports bad CRC without emitting it', () => {
  const parser = new MavlinkParser();
  const first = heartbeat(1, 1);
  const corrupted = heartbeat(2, 1).slice();
  corrupted[10] ^= 0xff;
  const third = heartbeat(3, 1);
  const input = new Uint8Array(2 + first.length + corrupted.length + third.length);
  input.set([0x01, 0x02]);
  input.set(first, 2);
  input.set(corrupted, 2 + first.length);
  input.set(third, 2 + first.length + corrupted.length);

  const decoded = parser.push(input);
  assert.deepEqual(decoded.map(frame => frame.systemId), [1, 3]);
  assert.equal(parser.getDiagnostics().crcErrors, 1);
  assert.equal(parser.getDiagnostics().discardedBytes, 2);
});

test('GLOBAL_POSITION_INT keeps MSL and Home-relative altitude as separate semantics', async () => {
  const transport = new FakeTransport();
  const manager = new MavlinkManager();
  await manager.connect(transport, {});
  try {
    transport.inject(heartbeat());
    transport.inject(globalPositionInt(123.456, 8.75));
    const state = manager.getState();
    assert.equal(state.altitudeMsl, 123.456);
    assert.equal(state.relativeAltitude, 8.75);
    assert.equal(state.altitude, 8.75, 'flight altitude remains relative to Home');
  } finally {
    manager.disconnect();
  }
});

test('MANUAL_CONTROL marks inactive joystick axes unavailable on the MAVLink wire', async () => {
  const transport = new FakeTransport();
  const manager = new MavlinkManager();
  await manager.connect(transport, {});
  try {
    transport.inject(heartbeat());
    transport.sent.length = 0;
    await manager.sendManualControl({
      roll: 0.4,
      pitch: -0.2,
      yaw: 0,
      throttle: 0.5,
      validAxes: { roll: true, pitch: true, yaw: false, throttle: false },
      timestamp: Date.now(),
    });
    const parser = new MavlinkParser();
    const frame = parser.push(transport.sent[0])[0];
    assert.equal(frame.messageId, 69);
    const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);
    assert.equal(view.getInt16(0, true), -200);
    assert.equal(view.getInt16(2, true), 400);
    assert.equal(view.getInt16(4, true), 32767);
    assert.equal(view.getInt16(6, true), 32767);
  } finally {
    manager.disconnect();
  }
});

test('MAVLink manager discovers multiple vehicles and keeps one explicit selection', async () => {
  const transport = new FakeTransport();
  const manager = new MavlinkManager();
  await manager.connect(transport, {});
  try {
    transport.inject(heartbeat(1, 1), { address: '10.0.0.10', port: 14550 });
    transport.inject(heartbeat(2, 1), { address: '10.0.0.11', port: 14551 });
    assert.equal(manager.getVehicles().length, 2);
    assert.equal(manager.getState().systemId, 1);
    manager.selectVehicle(2, 1);
    assert.equal(manager.getState().systemId, 2);
    assert.equal(manager.getVehicles().find(vehicle => vehicle.systemId === 2)?.selected, true);
    assert.ok(transport.sent.length >= 1, 'GCS heartbeat should be sent after transport opens');
  } finally {
    manager.disconnect();
  }
});

test('packet diagnostics subscription does not multiply across ten reconnects', async () => {
  const manager = new MavlinkManager();
  const transports: FakeTransport[] = [];
  const receivedSessions: number[] = [];
  const remove = manager.onPacket(event => {
    if (event.direction === 'RX') receivedSessions.push(event.sessionId);
  });
  const attitude = encodeMavlinkV2(30, new Uint8Array(28), 11, 1, 1);

  try {
    for (let index = 0; index < 10; index++) {
      const transport = new FakeTransport();
      transports.push(transport);
      await manager.connect(transport, {});
      transport.inject(attitude);
      assert.equal(receivedSessions.length, index + 1);
      if (index > 0) {
        transports[index - 1].inject(attitude);
        assert.equal(receivedSessions.length, index + 1, 'disconnected transport still had a listener');
      }
    }
    assert.equal(new Set(receivedSessions).size, 10);
  } finally {
    remove();
    manager.disconnect();
  }
});

test('parser accepts the generated common dialect and rejects unverified signed frames', () => {
  const parser = new MavlinkParser();
  const systemTime = encodeMavlinkV2(2, new Uint8Array(12), 1, 1, 1);
  assert.equal(parser.push(systemTime).length, 1);
  assert.equal(parser.push(signedHeartbeat()).length, 0);
  assert.equal(parser.getDiagnostics().signedFramesRejected, 1);
});

test('MAVLink 2 signing validates a correct frame and rejects replay', () => {
  const key = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const outgoing = new MavlinkSigningSession('SIGN_OUTGOING', key, 7);
  const incoming = new MavlinkSigningSession('REQUIRE_VALID', key, 7);
  const parser = new MavlinkParser();
  parser.setSigning(incoming);
  const wire = encodeMavlinkV2(0, new Uint8Array(9), 9, 1, 1, outgoing);

  assert.equal(parser.push(wire).length, 1);
  assert.equal(parser.getDiagnostics().signaturesValid, 1);
  assert.equal(parser.push(wire).length, 0);
  assert.equal(parser.getDiagnostics().signatureReplaysRejected, 1);
});

test('strict MAVLink 2 signing rejects unsigned and incorrectly signed frames', () => {
  const correctKey = new Uint8Array(32).fill(0x11);
  const wrongKey = new Uint8Array(32).fill(0x22);
  const strict = new MavlinkSigningSession('REQUIRE_VALID', correctKey, 1);
  const parser = new MavlinkParser();
  parser.setSigning(strict);

  assert.equal(parser.push(heartbeat()).length, 0);
  assert.equal(parser.getDiagnostics().unsignedFramesRejected, 1);

  const incorrectlySigned = encodeMavlinkV2(0, new Uint8Array(9), 10, 1, 1, new MavlinkSigningSession('SIGN_OUTGOING', wrongKey, 1));
  assert.equal(parser.push(incorrectlySigned).length, 0);
  assert.equal(parser.getDiagnostics().signaturesInvalid, 1);
});

test('primary autopilot component cannot be overwritten by another heartbeat on the same system', async () => {
  const transport = new FakeTransport();
  const manager = new MavlinkManager();
  await manager.connect(transport, {});
  try {
    transport.inject(heartbeat(1, 42, 3));
    transport.inject(heartbeat(1, 1, 5));
    transport.inject(heartbeat(1, 42, 9));
    assert.equal(manager.getState().componentId, 1);
    assert.equal(manager.getState().mode, 'LOITER');
  } finally {
    manager.disconnect();
  }
});

test('fresh positive battery percentage wins over a conflicting zero and cell voltages are summed', async () => {
  const transport = new FakeTransport();
  const manager = new MavlinkManager();
  await manager.connect(transport, {});
  try {
    transport.inject(heartbeat());
    transport.inject(sysStatus(97));
    transport.inject(batteryStatus(0, [4000, 4000, 4000]));
    assert.equal(manager.getState().battery, 97);
    assert.equal(manager.getState().voltage, 12);

    // Reproduce the real device case: SYS_STATUS stays at 0% even though the
    // per-battery message contains the usable reading.
    transport.inject(sysStatus(0, 11000, 10));
    transport.inject(batteryStatus(96, [4050, 4050, 4050], 0, 11));
    assert.equal(manager.getState().battery, 96);
    assert.ok(Math.abs((manager.getState().voltage ?? 0) - 12.15) < 1e-9);
  } finally {
    manager.disconnect();
  }

  const fallbackTransport = new FakeTransport();
  const fallbackManager = new MavlinkManager();
  await fallbackManager.connect(fallbackTransport, {});
  try {
    fallbackTransport.inject(heartbeat());
    fallbackTransport.inject(batteryStatus(88, [4100, 4100, 4100]));
    assert.equal(fallbackManager.getState().battery, 88);
    assert.ok(Math.abs((fallbackManager.getState().voltage ?? 0) - 12.3) < 1e-9);
  } finally {
    fallbackManager.disconnect();
  }
});

test('invalid SYS_STATUS zero falls back to a valid BATTERY_STATUS percentage', async () => {
  const transport = new FakeTransport();
  const manager = new MavlinkManager();
  await manager.connect(transport, {});
  try {
    transport.inject(heartbeat());
    transport.inject(sysStatus(0, 0));
    transport.inject(batteryStatus(96, [4050, 4050, 4050]));
    assert.equal(manager.getState().battery, 96);
    assert.ok(Math.abs((manager.getState().voltage ?? 0) - 12.15) < 1e-9);
  } finally {
    manager.disconnect();
  }
});

test('COMMAND_ACK must match session and selected source component', async () => {
  const transport = new FakeTransport();
  const manager = new MavlinkManager();
  await manager.connect(transport, {});
  try {
    transport.inject(heartbeat());
    const pending = manager.sendCommandLongAwaitAck(400, [1], 100);
    const sentParser = new MavlinkParser();
    const sentCommand = transport.sent
      .flatMap(bytes => sentParser.push(bytes))
      .find(frame => frame.messageId === 76 && new DataView(
        frame.payload.buffer,
        frame.payload.byteOffset,
        frame.payload.byteLength,
      ).getUint16(28, true) === 400);
    assert.ok(sentCommand, 'COMMAND_LONG should be emitted');
    assert.equal(sentCommand.payload[30], 1, 'command target system must be selected SYSID');
    assert.equal(sentCommand.payload[31], 1, 'command target component must be selected COMPID');
    await assert.rejects(manager.sendCommandLongAwaitAck(400, [1], 100), /COMMAND_ALREADY_PENDING/);
    transport.inject(commandAck(400, 42, 10));
    let settled = false;
    pending.then(() => { settled = true; });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(settled, false);
    transport.inject(commandAck(400, 1, 11));
    const ack = await pending;
    assert.equal(ack.sourceComponentId, 1);
    assert.equal(ack.targetSystemId, 255);
  } finally {
    manager.disconnect();
  }
});

test('HOME_POSITION decodes degE7/mm only from the selected autopilot and resets by session', async () => {
  const transport = new FakeTransport();
  const manager = new MavlinkManager();
  await manager.connect(transport, {});
  try {
    transport.inject(heartbeat());
    transport.inject(homePosition(10.7000001, 106.8000002, 25.375, 42, 12));
    assert.equal(manager.getState().homeLatitude, null, 'non-selected component must not define Home');

    transport.inject(homePosition(10.7000001, 106.8000002, 25.375, 1, 13));
    const confirmed = manager.getState();
    assert.equal(confirmed.homeLatitude, 10.7000001);
    assert.equal(confirmed.homeLongitude, 106.8000002);
    assert.equal(confirmed.homeAltitude, 25.375);
    assert.ok(confirmed.homeUpdatedAt);

    const confirmedAt = confirmed.homeUpdatedAt;
    transport.inject(homePosition(0, 0, 0, 1, 14));
    assert.equal(manager.getState().homeLatitude, 10.7000001, '0,0 must not replace confirmed Home');
    assert.equal(manager.getState().homeUpdatedAt, confirmedAt, 'invalid Home must not look freshly confirmed');

    const nextTransport = new FakeTransport();
    await manager.connect(nextTransport, {});
    assert.equal(manager.getState().homeLatitude, null);
    assert.equal(manager.getState().homeLongitude, null);
    assert.equal(manager.getState().homeAltitude, null);
    assert.equal(manager.getState().homeUpdatedAt, null);
  } finally {
    manager.disconnect();
  }
});

test('HOME_POSITION is requested once per session instead of streamed redundantly', async () => {
  const transport = new FakeTransport();
  const manager = new MavlinkManager();
  await manager.connect(transport, {});
  try {
    transport.inject(heartbeat());
    const parser = new MavlinkParser();
    const commands = transport.sent
      .flatMap(bytes => parser.push(bytes))
      .filter(frame => frame.messageId === 76)
      .map(frame => {
        const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);
        return { command: view.getUint16(28, true), param1: view.getFloat32(0, true) };
      });

    assert.equal(
      commands.filter(item => item.command === 512 && item.param1 === 242).length,
      1,
      'session should issue one MAV_CMD_REQUEST_MESSAGE for Home',
    );
    assert.equal(
      commands.filter(item => item.command === 511 && item.param1 === 242).length,
      0,
      'Home must not be configured as continuous SET_MESSAGE_INTERVAL traffic',
    );
  } finally {
    manager.disconnect();
  }
});
