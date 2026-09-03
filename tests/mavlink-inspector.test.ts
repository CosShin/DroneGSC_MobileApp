import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeInspectorPacket, getMavlinkMessageName } from '../src/services/mavlink/MavlinkInspectorDecoder';
import { MavlinkParser, encodeMavlinkV2 } from '../src/services/mavlink/MavlinkProtocol';
import type { MavlinkPacketEvent } from '../src/services/mavlink/MavlinkManager';
import { BoundedRingBuffer } from '../src/utils/BoundedRingBuffer';

function event(messageId: number, payload: Uint8Array, direction: 'RX' | 'TX' = 'RX', sys = 1, comp = 1): MavlinkPacketEvent {
  let rawFrame: Uint8Array | undefined;
  try {
    rawFrame = encodeMavlinkV2(messageId, payload, 17, sys, comp);
  } catch {
    rawFrame = new Uint8Array([0xFD, payload.byteLength, 0, 0, 17, sys, comp, messageId & 0xff, (messageId >> 8) & 0xff, (messageId >> 16) & 0xff, ...payload, 0x00, 0x00]);
  }
  return {
    direction,
    timestamp: 1_700_000_000_123,
    sessionId: 4,
    frame: {
      version: 2,
      sequence: 17,
      systemId: sys,
      componentId: comp,
      messageId,
      payload,
      rawFrame,
    },
  };
}

test('inspector decodes COMMAND_LONG without injecting traffic', () => {
  const payload = new Uint8Array(33);
  const view = new DataView(payload.buffer);
  view.setFloat32(0, 1, true);
  view.setUint16(28, 400, true);
  payload[30] = 1;
  payload[31] = 1;
  const packet = decodeInspectorPacket(event(76, payload, 'TX'), 1);
  assert.equal(packet.messageName, 'COMMAND_LONG');
  assert.equal(packet.category, 'COMMAND');
  assert.equal(packet.summary, 'MAV_CMD_COMPONENT_ARM_DISARM');
  assert.equal(packet.fields.find(item => item.label === 'param1')?.value, '1.000');
  assert.ok(packet.rawHex?.startsWith('FD'));
});

test('inspector makes accepted and denied COMMAND_ACK results explicit', () => {
  const payload = new Uint8Array(3);
  const view = new DataView(payload.buffer);
  view.setUint16(0, 400, true);
  payload[2] = 2;
  const packet = decodeInspectorPacket(event(77, payload), 2);
  assert.equal(packet.summary, 'MAV_RESULT_DENIED');
  assert.equal(packet.fields.find(item => item.label === 'command')?.value, 'MAV_CMD_COMPONENT_ARM_DISARM');
});

test('inspector decodes DISTANCE_SENSOR #132 with orientation and distances', () => {
  const payload = new Uint8Array(14);
  const view = new DataView(payload.buffer);
  view.setUint32(0, 5000, true); // time_boot_ms
  view.setUint16(4, 20, true);   // min_distance = 20cm (0.20m)
  view.setUint16(6, 4000, true); // max_distance = 4000cm (40.00m)
  view.setUint16(8, 125, true);  // current_distance = 125cm (1.25m)
  payload[10] = 0; // type = LASER
  payload[11] = 1; // id = 1
  payload[12] = 25; // orientation = ROTATION_PITCH_270 (DOWN)
  payload[13] = 0; // covariance

  const packet = decodeInspectorPacket(event(132, payload, 'RX', 1, 88), 3);
  assert.equal(packet.messageName, 'DISTANCE_SENSOR');
  assert.equal(packet.category, 'SENSOR');
  assert.equal(packet.summary, '1.25 m');
  assert.equal(packet.fields.find(item => item.label === 'current_distance')?.value, '1.25 m');
  assert.equal(packet.fields.find(item => item.label === 'min_distance')?.value, '0.20 m');
  assert.equal(packet.fields.find(item => item.label === 'max_distance')?.value, '40.00 m');
  assert.equal(packet.fields.find(item => item.label === 'orientation')?.value, 'ROTATION_PITCH_270 (DOWN)');
});

test('inspector decodes OPTICAL_FLOW #100 with ground distance and quality', () => {
  const payload = new Uint8Array(26);
  const view = new DataView(payload.buffer);
  view.setFloat32(8, 0.15, true);  // flow_comp_m_x
  view.setFloat32(12, -0.05, true); // flow_comp_m_y
  view.setFloat32(16, 1.82, true);  // ground_distance
  view.setInt16(20, 12, true);      // flow_x
  view.setInt16(22, -8, true);      // flow_y
  payload[24] = 1;                  // sensor_id
  payload[25] = 180;                // quality

  const packet = decodeInspectorPacket(event(100, payload, 'RX', 1, 88), 4);
  assert.equal(packet.messageName, 'OPTICAL_FLOW');
  assert.equal(packet.category, 'SENSOR');
  assert.equal(packet.summary, 'Qual: 180');
  assert.equal(packet.fields.find(item => item.label === 'quality')?.value, '180');
  assert.equal(packet.fields.find(item => item.label === 'ground_distance')?.value, '1.82 m');
  assert.equal(packet.fields.find(item => item.label === 'flow_comp_m_x')?.value, '0.150 m/s');
});

test('inspector decodes STATUSTEXT #253 severity and text', () => {
  const payload = new Uint8Array(51);
  payload[0] = 4; // WARNING
  const text = 'PreArm: Compass not calibrated';
  for (let i = 0; i < text.length; i++) payload[1 + i] = text.charCodeAt(i);

  const packet = decodeInspectorPacket(event(253, payload), 5);
  assert.equal(packet.messageName, 'STATUSTEXT');
  assert.equal(packet.category, 'ERROR');
  assert.equal(packet.summary, text);
  assert.equal(packet.fields.find(item => item.label === 'severity')?.value, 'WARNING');
  assert.equal(packet.fields.find(item => item.label === 'text')?.value, text);
});

test('inspector decodes PARAM_VALUE #22 string name and numeric value', () => {
  const payload = new Uint8Array(25);
  const view = new DataView(payload.buffer);
  view.setFloat32(0, 12.5, true);
  view.setUint16(4, 350, true);
  view.setUint16(6, 42, true);
  const name = 'WP_NAV_SPEED';
  for (let i = 0; i < name.length; i++) payload[8 + i] = name.charCodeAt(i);
  payload[24] = 9; // REAL32

  const packet = decodeInspectorPacket(event(22, payload), 6);
  assert.equal(packet.messageName, 'PARAM_VALUE');
  assert.equal(packet.category, 'PARAM');
  assert.equal(packet.summary, 'WP_NAV_SPEED = 12.5000');
  assert.equal(packet.fields.find(item => item.label === 'param_id')?.value, 'WP_NAV_SPEED');
  assert.equal(packet.fields.find(item => item.label === 'param_value')?.value, '12.5000');
});

test('inspector falls back to byte/hex representation for unknown message IDs', () => {
  const payload = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD]);
  const packet = decodeInspectorPacket(event(999, payload), 7);
  assert.equal(packet.messageName, 'MSG_999');
  assert.equal(packet.fields.find(item => item.label === 'payload_len')?.value, '4 B');
  assert.equal(packet.fields.find(item => item.label === 'payload_hex')?.value, 'AA BB CC DD');
});

test('ArduPilotMega dialect messages have official names and valid CRC extras', () => {
  assert.equal(getMavlinkMessageName(152), 'MEMINFO');
  assert.equal(getMavlinkMessageName(163), 'AHRS');
  assert.equal(getMavlinkMessageName(178), 'AHRS2');
  assert.equal(getMavlinkMessageName(193), 'EKF_STATUS_REPORT');

  const wire = encodeMavlinkV2(152, new Uint8Array(8), 21, 1, 1);
  const parser = new MavlinkParser();
  const frames = parser.push(wire);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].messageId, 152);
  assert.equal(parser.getDiagnostics().unsupportedFrames, 0);
});

test('MAVLink 2 trailing-zero truncation still decodes extension and zero tail fields', () => {
  const payload = new Uint8Array(13);
  const view = new DataView(payload.buffer);
  view.setUint32(0, 5000, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 4000, true);
  view.setUint16(8, 125, true);
  payload[10] = 0;
  payload[11] = 1;
  payload[12] = 25;

  const packet = decodeInspectorPacket(event(132, payload), 8);
  assert.equal(packet.summary, '1.25 m');
  assert.equal(packet.fields.find(item => item.label === 'covariance')?.value, '0');
  assert.equal(packet.payloadSize, 13);
});

test('ESTIMATOR_STATUS uses the MAVLink wire offsets for timestamp, ratios, and flags', () => {
  const payload = new Uint8Array(42);
  const view = new DataView(payload.buffer);
  view.setUint32(0, 0x89ABCDEF, true);
  view.setUint32(4, 0x00000123, true);
  view.setFloat32(8, 1.25, true);
  view.setFloat32(12, 2.5, true);
  view.setFloat32(36, 7.75, true);
  view.setUint16(40, 0x1234, true);

  const packet = decodeInspectorPacket(event(230, payload), 9);
  assert.equal(packet.fields.find(item => item.label === 'time_usec')?.value, '1252145221103 us');
  assert.equal(packet.fields.find(item => item.label === 'vel_ratio')?.value, '1.25');
  assert.equal(packet.fields.find(item => item.label === 'pos_horiz_ratio')?.value, '2.50');
  assert.equal(packet.fields.find(item => item.label === 'pos_vert_accuracy')?.value, '7.75 m');
  assert.equal(packet.fields.find(item => item.label === 'flags')?.value, '0x1234');
});

test('TIMESYNC retains full signed 64-bit values instead of truncating to 32 bits', () => {
  const payload = new Uint8Array(16);
  const view = new DataView(payload.buffer);
  view.setUint32(0, 0x89ABCDEF, true);
  view.setInt32(4, 0x00000123, true);
  view.setUint32(8, 0x76543210, true);
  view.setInt32(12, -2, true);

  const packet = decodeInspectorPacket(event(111, payload), 10);
  assert.equal(packet.fields.find(item => item.label === 'tc1')?.value, '1252145221103 ns');
  assert.equal(packet.fields.find(item => item.label === 'ts1')?.value, '-6604705264 ns');
});

test('BATTERY_STATUS reports pack voltage and preserves unknown sentinels', () => {
  const payload = new Uint8Array(36);
  const view = new DataView(payload.buffer);
  view.setInt32(0, -1, true);
  view.setInt32(4, -1, true);
  view.setInt16(8, 32767, true);
  view.setUint16(10, 4000, true);
  view.setUint16(12, 4000, true);
  view.setUint16(14, 4000, true);
  for (let index = 3; index < 10; index++) view.setUint16(10 + index * 2, 65535, true);
  view.setInt16(30, -1, true);
  payload[32] = 0;
  view.setInt8(35, 94);

  const packet = decodeInspectorPacket(event(147, payload), 11);
  assert.equal(packet.fields.find(item => item.label === 'pack_voltage')?.value, '12.000 V');
  assert.equal(packet.fields.find(item => item.label === 'remaining')?.value, '94%');
  assert.equal(packet.fields.find(item => item.label === 'current')?.value, '--');
  assert.equal(packet.fields.find(item => item.label === 'temperature')?.value, '--');
});

test('raw frame copying is enabled only for active parser diagnostics', () => {
  const wire = encodeMavlinkV2(0, new Uint8Array(9), 9, 1, 1);
  const parser = new MavlinkParser();
  assert.equal(parser.push(wire)[0].rawFrame, undefined);

  parser.setRawCaptureEnabled(true);
  const captured = parser.push(wire)[0];
  assert.deepEqual(captured.rawFrame, wire);
});

test('diagnostics ring buffer remains bounded across the 0-300 pps test matrix', () => {
  for (const packetsPerSecond of [0, 1, 50, 150, 300]) {
    const buffer = new BoundedRingBuffer<number>(1000);
    const simulatedPackets = packetsPerSecond * 60;
    for (let index = 0; index < simulatedPackets; index++) buffer.push(index);
    const snapshot = buffer.toArray();
    const expectedSize = Math.min(1000, simulatedPackets);
    assert.equal(buffer.size, expectedSize, `${packetsPerSecond} pps size`);
    if (simulatedPackets > 0) {
      assert.equal(snapshot[0], Math.max(0, simulatedPackets - 1000), `${packetsPerSecond} pps oldest`);
      assert.equal(snapshot.at(-1), simulatedPackets - 1, `${packetsPerSecond} pps newest`);
    }
  }
});
