import test from 'node:test';
import assert from 'node:assert/strict';
import { configureStore } from '@reduxjs/toolkit';
import { aiService } from '../src/services/ai/AiService';
import { aiClient } from '../src/services/ai/AiClient';
import { routeAniIntent } from '../src/services/ai/AniIntentRouter';
import { resolveAniCommand } from '../src/services/ai/AniCommandInterpreter';
import settingsReducer, { updateAiSettings } from '../src/store/settings/settingsSlice';
import telemetryReducer, { updateBattery, updateGps } from '../src/store/telemetry/telemetrySlice';
import droneReducer, { setArmed, setFlightMode } from '../src/store/drone/droneSlice';
import connectionReducer, { setDetectedVehicle, setHeartbeat, setLinkState, setStatus, updateConnectionHealth } from '../src/store/connection/connectionSlice';
import { emptyConnectionHealth } from '../src/services/connection/ConnectionHealth';
import homeReducer from '../src/store/home/homeSlice';
import commandReducer from '../src/store/command/commandSlice';
import videoReducer from '../src/store/videoSlice';

function createTestStore() {
  const s = configureStore({
    reducer: {
      settings: settingsReducer,
      telemetry: telemetryReducer,
      drone: droneReducer,
      connection: connectionReducer,
      home: homeReducer,
      command: commandReducer,
      video: videoReducer,
      mission: () => ({ items: [], selectedItemId: null, syncStatus: 'UNSYNCED', syncProgress: 0, rawWireItems: [], verifyResult: null }),
    },
    middleware: getDefaultMiddleware => getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
    }),
  });
  s.dispatch(updateAiSettings({
    enabled: true,
    model: 'qwen3.5:9b',
    enableFallback: false,
    voiceRepliesEnabled: false,
  }));
  aiService.setStore(s);
  aiService.clearHistory();
  return s;
}

function markVehicleConnected(store: ReturnType<typeof createTestStore>) {
  const now = Date.now();
  store.dispatch(setStatus('CONNECTED'));
  store.dispatch(updateConnectionHealth({
    ...emptyConnectionHealth(),
    networkStatus: 'CONNECTED', mavlinkStatus: 'HEARTBEAT_OK', vehicleStatus: 'AVAILABLE',
    controlStatus: 'READY', controlAvailable: true, linkQuality: 'GOOD', linkQualityScore: 85,
    lastHeartbeatAt: now - 80, heartbeatAgeMs: 80, transport: 'WEBSOCKET', transportStatus: 'READY', updatedAt: now,
  }));
  store.dispatch(setDetectedVehicle({ name: 'ArduCopter SYS1', vehicleType: 'COPTER', autopilot: 'ARDUPILOT' }));
  store.dispatch(setLinkState({
    phase: 'VEHICLE_CONNECTED',
    network: 'BOUND',
    mavlink: 'ACTIVE',
    vehicle: 'CONNECTED',
    error: null,
  }));
  store.dispatch(setHeartbeat(now - 80));
  store.dispatch(setFlightMode('GUIDED'));
  store.dispatch(setArmed(true));
  store.dispatch(updateBattery({ timestamp: now - 100, value: { voltage: 15.8, current: 1.2, percentage: 84 } }));
  store.dispatch(updateGps({
    timestamp: now - 100,
    value: {
      latitude: 10.8231,
      longitude: 106.6297,
      altitude: 0.2,
      satellites: 15,
      hdop: 0.9,
      gpsFix: 3,
    },
  }));
}

test('ANI router separates general chat, weather, realtime web, flight status and actions', () => {
  assert.equal(routeAniIntent('PID là gì?').intent, 'GENERAL_CHAT');
  assert.equal(routeAniIntent('Arm có nghĩa là gì?').intent, 'GENERAL_CHAT');
  assert.equal(routeAniIntent('Hôm nay thời tiết HCM thế nào?').intent, 'WEATHER');
  assert.equal(routeAniIntent('Phiên bản ArduCopter mới nhất là bao nhiêu?').intent, 'WEB_SEARCH');
  assert.equal(routeAniIntent('Drone pin còn nhiêu?').intent, 'FLIGHT_STATUS');
  assert.equal(routeAniIntent('Tôi có nên arm không?').intent, 'FLIGHT_QUESTION');
  assert.equal(routeAniIntent('Arm drone').intent, 'FLIGHT_ACTION');
  assert.equal(routeAniIntent('Bay lên 5m').intent, 'FLIGHT_ACTION');
  assert.equal(routeAniIntent('Qua Loiter').intent, 'FLIGHT_ACTION');
});

test('ANI command interpreter maps natural flight commands into safe structured intents', () => {
  assert.equal(resolveAniCommand('arm drone', null)?.intent?.type, 'ARM');
  assert.equal(resolveAniCommand('cho nó hạ cánh', null)?.intent?.type, 'LAND');
  assert.equal(resolveAniCommand('bay về home', null)?.intent?.type, 'RTL');
  assert.deepEqual(resolveAniCommand('bay lên 5m', null)?.intent, { type: 'TAKEOFF', altitudeMeters: 5 });
  assert.deepEqual(resolveAniCommand('qua Loiter', null)?.intent, { type: 'SET_MODE', mode: 'LOITER' });

  const clarification = resolveAniCommand('bay lên', null);
  assert.equal(clarification?.intent, undefined);
  assert.equal(clarification?.clarification?.type, 'TAKEOFF_ALTITUDE');
  assert.deepEqual(resolveAniCommand('5m', clarification!.clarification!)?.intent, { type: 'TAKEOFF', altitudeMeters: 5 });
});

test('ANI general chat prompt does not inject FlightContext telemetry', async () => {
  const store = createTestStore();
  markVehicleConnected(store);
  const originalChat = aiClient.chat.bind(aiClient);
  let requestMessages: any[] = [];

  (aiClient as any).chat = async (messages: any[]) => {
    requestMessages = messages;
    return { content: 'PID là bộ điều khiển tỉ lệ, tích phân và vi phân.', latencyMs: 20 };
  };

  try {
    await aiService.sendUserMessage('PID là gì?');
    const joined = requestMessages.map(m => m.content).join('\n');
    assert.ok(joined.includes('PID là gì?'));
    assert.ok(!joined.includes('CURRENT FLIGHT CONTEXT SNAPSHOT'));
    assert.ok(!joined.includes('"percentage": 84'));
  } finally {
    (aiClient as any).chat = originalChat;
  }
});

test('ANI creates action cards for direct voice/text commands without executing MAVLink', async () => {
  const store = createTestStore();
  markVehicleConnected(store);

  await aiService.sendUserMessage('bay lên 5m');
  const takeoff = aiService.getState().messages.at(-1);
  assert.equal(takeoff?.proposal?.intent.type, 'TAKEOFF');
  assert.equal((takeoff?.proposal?.intent as any).altitudeMeters, 5);
  assert.equal(takeoff?.proposal?.state, 'WAITING_CONFIRMATION');
});

test('ANI handles two-turn takeoff altitude clarification', async () => {
  const store = createTestStore();
  markVehicleConnected(store);

  await aiService.sendUserMessage('bay lên');
  assert.ok(aiService.getState().messages.at(-1)?.content.includes('bao nhiêu mét'));

  await aiService.sendUserMessage('5m');
  const proposal = aiService.getState().messages.at(-1)?.proposal;
  assert.equal(proposal?.intent.type, 'TAKEOFF');
  assert.equal((proposal?.intent as any).altitudeMeters, 5);
});

test('ANI weather tool uses realtime tool result and does not call the LLM', async () => {
  createTestStore();
  const originalFetch = globalThis.fetch;
  const originalChat = aiClient.chat.bind(aiClient);
  let chatCalled = false;

  (globalThis as any).fetch = async () => ({
    ok: true,
    json: async () => ({
      current: { temperature_2m: 31.2, precipitation: 0, wind_speed_10m: 9.7 },
      daily: { precipitation_probability_max: [45] },
    }),
  });
  (aiClient as any).chat = async () => {
    chatCalled = true;
    return { content: 'should not be used', latencyMs: 1 };
  };

  try {
    await aiService.sendUserMessage('Hôm nay thời tiết HCM thế nào?');
    const last = aiService.getState().messages.at(-1);
    assert.equal(chatCalled, false);
    assert.ok(last?.content.includes('Ho Chi Minh City'));
    assert.ok(last?.content.includes('31°C'));
    assert.ok(last?.content.includes('45%'));
  } finally {
    globalThis.fetch = originalFetch;
    (aiClient as any).chat = originalChat;
  }
});

test('ANI routes natural telemetry and sensor queries with requiresFlightContext: true', () => {
  const q1 = routeAniIntent('Kiểm tra drone');
  assert.equal(q1.requiresFlightContext, true);
  assert.equal(q1.intent, 'FLIGHT_STATUS');

  const q2 = routeAniIntent('Kiểm tra cảm biến');
  assert.equal(q2.requiresFlightContext, true);
  assert.equal(q2.intent, 'SYSTEM_HEALTH');

  const q3 = routeAniIntent('GPS ổn không?');
  assert.equal(q3.requiresFlightContext, true);

  const q4 = routeAniIntent('Pin bao nhiêu?');
  assert.equal(q4.requiresFlightContext, true);

  const q5 = routeAniIntent('Drone hiện tại sao?');
  assert.equal(q5.requiresFlightContext, true);
});

test('TEST 5: Voice input and text input produce identical FlightContext snapshots', async () => {
  const store = createTestStore();
  markVehicleConnected(store);
  aiService.setStore(store as any);
  aiService.clearChat();

  const originalChat = aiClient.chat.bind(aiClient);
  let capturedPrompts: string[] = [];

  (aiClient as any).chat = async (messages: any[]) => {
    const userMsgs = messages.filter((m: any) => m.role === 'user');
    const userMsg = userMsgs[userMsgs.length - 1];
    if (userMsg) capturedPrompts.push(userMsg.content);
    return { content: 'Phân tích ổn định.', latencyMs: 15 };
  };

  try {
    // 1. Send via text
    await aiService.sendUserMessage('GPS ổn không?', { source: 'text' });
    // 2. Send via voice
    await aiService.sendUserMessage('GPS ổn không?', { source: 'voice' });

    assert.equal(capturedPrompts.length, 2);
    // Both prompts must contain the exact same FlightContext snapshot (excluding dynamic timestamp)
    assert.ok(capturedPrompts[0].includes('CURRENT FLIGHT CONTEXT SNAPSHOT'));
    assert.ok(capturedPrompts[1].includes('CURRENT FLIGHT CONTEXT SNAPSHOT'));
    const normalizePrompt = (p: string) => p.replace(/"timestamp":\s*\d+/g, '"timestamp": 0');
    assert.equal(normalizePrompt(capturedPrompts[0]), normalizePrompt(capturedPrompts[1]));
  } finally {
    (aiClient as any).chat = originalChat;
    aiService.setStore(null);
  }
});
