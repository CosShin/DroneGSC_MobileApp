import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SYSTEM_PROMPT,
  buildUserMessageWithContext,
  buildQuickActionPrompt,
  trimConversationHistory,
} from '../src/services/ai/AiPromptBuilder';
import type { AiChatMessage, FlightContextSnapshot } from '../src/services/ai/AiTypes';

const mockContext: FlightContextSnapshot = {
  timestamp: Date.now(),
  vehicle: {
    connected: true,
    name: 'Hexa-01',
    vehicleType: 'COPTER',
    autopilot: 'ARDUPILOT',
    armed: false,
    mode: 'STABILIZE',
    systemStatus: 'ACTIVE',
    stale: false,
  },
  connection: {
    transport: 'WEBSOCKET',
    portInfo: 'ws://192.168.1.247:8765/mavlink',
    networkState: 'BOUND',
    mavlinkState: 'ACTIVE',
    vehicleState: 'CONNECTED',
    heartbeatAgeMs: 150,
    latencyMs: 12,
    rxPps: 140,
    txPps: 4,
    bytesReceived: 10000,
    bytesSent: 500,
    packetsLost: 0,
    mavlinkVersion: 2,
  },
  battery: {
    voltage: 15.4,
    current: 0.8,
    percentage: 92,
  },
  gps: {
    fixType: 3,
    satellites: 16,
    hdop: 0.8,
    latitude: 10.762622,
    longitude: 106.660172,
    altitude: 12.5,
  },
  flight: {
    altitude: 12.5,
    groundSpeed: 0.0,
    verticalSpeed: 0.0,
    heading: 90,
    roll: 0.0,
    pitch: 0.0,
    yaw: 90.0,
  },
  home: {
    isSet: true,
    latitude: 10.762620,
    longitude: 106.660170,
    altitude: 0.0,
    distanceMeters: 2.1,
    bearingDegrees: 45,
  },
  mavlink: {
    rxPps: 140,
    txPps: 4,
    crcErrors: 0,
    dropped: 0,
    reconnectCount: 0,
    topRates: [
      { name: 'ATTITUDE', rateHz: 20, rxCount: 200, txCount: 0 },
      { name: 'GPS_RAW_INT', rateHz: 5, rxCount: 50, txCount: 0 },
    ],
  },
  sensors: [
    { name: 'Gyroscope', health: 'GOOD' },
    { name: 'Compass', health: 'GOOD' },
  ],
  warnings: [],
  mission: null,
};

test('SYSTEM_PROMPT contains truthful telemetry and safety enforcement rules', () => {
  assert.ok(SYSTEM_PROMPT.includes('TRUTHFUL TELEMETRY'));
  assert.ok(SYSTEM_PROMPT.includes('null'));
  assert.ok(SYSTEM_PROMPT.includes('UNKNOWN'));
  assert.ok(SYSTEM_PROMPT.includes('FLIGHT SAFETY'));
  assert.ok(SYSTEM_PROMPT.includes('CANNOT directly arm'));
});

test('buildUserMessageWithContext embeds truthful FlightContext JSON snapshot', () => {
  const result = buildUserMessageWithContext('Kiểm tra tình trạng pin', mockContext);
  assert.ok(result.includes('CURRENT FLIGHT CONTEXT SNAPSHOT'));
  assert.ok(result.includes('"percentage": 92'));
  assert.ok(result.includes('Kiểm tra tình trạng pin'));
});

test('buildQuickActionPrompt generates specialized instructions for each quick action', () => {
  const preflight = buildQuickActionPrompt('PREFLIGHT', mockContext);
  assert.ok(preflight.includes('PREFLIGHT CHECK'));
  assert.ok(preflight.includes('GO / NO-GO'));

  const whyCantArm = buildQuickActionPrompt('WHY_CANT_ARM', mockContext);
  assert.ok(whyCantArm.includes("WHY CAN'T I ARM?"));
  assert.ok(whyCantArm.includes('PreArm warnings'));

  const mavlink = buildQuickActionPrompt('MAVLINK_CHECK', mockContext);
  assert.ok(mavlink.includes('MAVLINK & TRAFFIC DIAGNOSTICS'));
  assert.ok(mavlink.includes('Packet rate health'));

  const mission = buildQuickActionPrompt('MISSION_REVIEW', mockContext);
  assert.ok(mission.includes('MISSION PLAN REVIEW'));
  assert.ok(mission.includes('Takeoff and Landing / RTL'));
});

test('trimConversationHistory limits conversation length to max turns', () => {
  const messages: AiChatMessage[] = Array.from({ length: 30 }, (_, i) => ({
    id: `msg-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i}`,
    timestamp: Date.now() + i * 1000,
    status: 'success',
  }));

  const trimmed = trimConversationHistory(messages, 15);
  assert.equal(trimmed.length, 15);
  assert.equal(trimmed[0].id, 'msg-15');
  assert.equal(trimmed[14].id, 'msg-29');
});
