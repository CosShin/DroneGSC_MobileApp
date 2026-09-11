import test from 'node:test';
import assert from 'node:assert/strict';
import { configureStore } from '@reduxjs/toolkit';
import { routeAniIntent } from '../src/services/ai/AniIntentRouter';
import { buildAniToolSnapshot } from '../src/services/ai/AniToolbox';
import {
  buildArmDiagnostics,
  buildConnectionDoctor,
  buildFlightDebrief,
  buildHealthCheck,
  buildMavlinkDoctor,
  buildPreflight,
  buildWhatsHappening,
} from '../src/services/ai/AniDiagnostics';
import { buildParameterAssistantResponse, ParameterCache } from '../src/services/ai/ParameterAssistant';
import { FlightEventRecorder } from '../src/services/ai/FlightEventRecorder';
import settingsReducer, { updateAiSettings } from '../src/store/settings/settingsSlice';
import connectionReducer, {
  setActiveConnectionInfo,
  setDetectedVehicle,
  setHeartbeat,
  setLinkState,
  setStatus,
  updateTrafficStats,
  updateConnectionHealth,
} from '../src/store/connection/connectionSlice';
import { emptyConnectionHealth } from '../src/services/connection/ConnectionHealth';
import droneReducer, { setArmed, setFlightMode, setSystemStatus } from '../src/store/drone/droneSlice';
import telemetryReducer, { updateBattery, updateGps, updateSensors } from '../src/store/telemetry/telemetrySlice';
import homeReducer, { setHomePosition } from '../src/store/home/homeSlice';
import videoReducer, { videoPlaying } from '../src/store/videoSlice';
import commandReducer from '../src/store/command/commandSlice';

function createTestStore() {
  const store = configureStore({
    reducer: {
      settings: settingsReducer,
      connection: connectionReducer,
      drone: droneReducer,
      telemetry: telemetryReducer,
      home: homeReducer,
      mission: () => ({ items: [], selectedItemId: null, syncStatus: 'UNSYNCED', syncProgress: 0, rawWireItems: [], verifyResult: null }),
      video: videoReducer,
      command: commandReducer,
    },
    middleware: getDefaultMiddleware => getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
    }),
  });
  store.dispatch(updateAiSettings({
    enabled: true,
    model: 'qwen3.5:9b',
    enableFallback: false,
    voiceRepliesEnabled: false,
  }));
  return store;
}

function markVehicleConnected(store: ReturnType<typeof createTestStore>) {
  const now = Date.now();
  store.dispatch(setStatus('CONNECTED'));
  store.dispatch(updateConnectionHealth({
    ...emptyConnectionHealth(),
    networkStatus: 'CONNECTED', mavlinkStatus: 'HEARTBEAT_OK', vehicleStatus: 'AVAILABLE',
    controlStatus: 'READY', controlAvailable: true, linkQuality: 'GOOD', linkQualityScore: 85,
    lastHeartbeatAt: now - 140, heartbeatAgeMs: 140, transport: 'WEBSOCKET', transportStatus: 'READY', updatedAt: now,
  }));
  store.dispatch(setActiveConnectionInfo({ type: 'WEBSOCKET', portInfo: 'ws://100.81.87.111:8765/mavlink' }));
  store.dispatch(setDetectedVehicle({ name: 'ArduCopter SYS1', vehicleType: 'COPTER', autopilot: 'ARDUPILOT' }));
  store.dispatch(setLinkState({
    phase: 'VEHICLE_CONNECTED',
    network: 'BOUND',
    mavlink: 'ACTIVE',
    vehicle: 'CONNECTED',
    error: null,
  }));
  store.dispatch(setHeartbeat(now - 140));
  store.dispatch(updateTrafficStats({
    bytesRx: 42_000,
    bytesTx: 1_500,
    pps: 157,
    txPps: 20,
    mavlinkVersion: 2,
  }));
  store.dispatch(setFlightMode('LOITER'));
  store.dispatch(setArmed(false));
  store.dispatch(setSystemStatus('ACTIVE'));
  store.dispatch(updateBattery({ timestamp: now - 1000, value: { voltage: 15.4, current: 2.1, percentage: 82 } }));
  store.dispatch(updateGps({
    timestamp: now - 1000,
    value: {
      latitude: 10.762622,
      longitude: 106.660172,
      altitude: 12.4,
      satellites: 16,
      hdop: 0.8,
      gpsFix: 3,
    },
  }));
  store.dispatch(updateSensors({
    timestamp: now - 1000,
    value: [
      { name: 'EKF', health: 'GOOD', value: 'healthy' },
      { name: 'Compass', health: 'GOOD', value: 'healthy' },
    ],
  }));
  store.dispatch(setHomePosition({
    latitude: 10.76262,
    longitude: 106.66017,
    altitude: 4.2,
    updatedAt: now - 5000,
  }));
  store.dispatch(videoPlaying());
}

test('ANI V2 router keeps general chat independent from vehicle telemetry', () => {
  const general = routeAniIntent('PID là gì và tuning thế nào?');
  assert.equal(general.intent, 'GENERAL_CHAT');
  assert.equal(general.requiresFlightContext, false);

  const status = routeAniIntent('ANI, chuyện gì đang xảy ra?');
  assert.equal(status.intent, 'FLIGHT_STATUS');
  assert.equal(status.requiresFlightContext, true);
  assert.equal(status.deterministic, true);

  const param = routeAniIntent('MOT_THST_HOVER hiện tại bao nhiêu?');
  assert.equal(param.intent, 'PARAMETER_QUERY');
  assert.equal(param.requiresFlightContext, true);
  assert.equal(param.deterministic, true);
});

test("ANI What's Happening deterministic response does not invent disconnected telemetry", () => {
  const store = createTestStore();
  const response = buildWhatsHappening(buildAniToolSnapshot(store.getState() as any));
  assert.equal(response.structuredCard.type, 'FLIGHT_STATUS');
  assert.ok(response.content.includes('chưa có heartbeat'));
  assert.ok(!response.content.includes('LOITER'));
});

test('ANI diagnostics cards are built from read-only app snapshots', () => {
  const store = createTestStore();
  markVehicleConnected(store);
  const snapshot = buildAniToolSnapshot(store.getState() as any);

  const happening = buildWhatsHappening(snapshot);
  assert.equal(happening.structuredCard.type, 'FLIGHT_STATUS');
  assert.ok(happening.content.includes('LOITER'));
  assert.ok(happening.content.includes('82%'));

  const health = buildHealthCheck(snapshot);
  assert.equal(health.structuredCard.type, 'SYSTEM_HEALTH');
  assert.equal(health.tone, 'POSITIVE');

  const preflight = buildPreflight(snapshot);
  assert.equal(preflight.structuredCard.type, 'PREFLIGHT_CHECK');
  assert.ok(preflight.content.includes('READY'));

  const arm = buildArmDiagnostics(snapshot);
  assert.equal(arm.structuredCard.type, 'ARM_DIAG');
  assert.ok(!arm.content.includes('ARM BLOCKED'));

  const connection = buildConnectionDoctor(snapshot);
  assert.equal(connection.structuredCard.type, 'CONNECTION_DIAG');
  assert.ok(connection.content.includes('iPhone') || connection.content.includes('Connection Doctor'));

  const mavlink = buildMavlinkDoctor(snapshot);
  assert.equal(mavlink.structuredCard.type, 'MAVLINK_DIAG');
  assert.ok(mavlink.content.includes('157 pps'));
});

test('ANI Parameter Assistant never invents unavailable values or raw writes', () => {
  const store = createTestStore();
  markVehicleConnected(store);
  const snapshot = buildAniToolSnapshot(store.getState() as any);
  const cache = new ParameterCache();

  const unavailable = buildParameterAssistantResponse('MOT_THST_HOVER hiện tại bao nhiêu?', snapshot, cache);
  assert.equal(unavailable.structuredCard.type, 'PARAMETER_CHANGE');
  assert.ok(unavailable.content.includes('chưa có trong parameter cache'));
  assert.ok(!unavailable.content.includes('PARAM_SET'));

  cache.record({
    name: 'LOIT_SPEED',
    value: 1000,
    type: 'REAL32',
    unit: 'cm/s',
    updatedAt: Date.now(),
  });
  const proposal = buildParameterAssistantResponse('Giảm tốc Loiter xuống một chút.', snapshot, cache);
  assert.ok(proposal.content.includes('current 1000 cm/s'));
  assert.ok(proposal.content.includes('proposed 700 cm/s'));
  assert.ok(proposal.content.includes('không ghi parameter trực tiếp'));
  assert.ok(proposal.structuredCard.metrics?.some(m => m.label === 'Apply' && m.value.includes('BLOCKED')));
});

test('Flight Debrief uses bounded real event recorder state', () => {
  const store = createTestStore();
  const recorder = new FlightEventRecorder(40);
  const base = Date.now();

  markVehicleConnected(store);
  let snapshot = buildAniToolSnapshot(store.getState() as any);
  recorder.recordSnapshot({ ...snapshot, capturedAt: base });

  store.dispatch(setArmed(true));
  store.dispatch(updateBattery({ timestamp: base + 100, value: { voltage: 14.7, current: 3.2, percentage: 24 } }));
  store.dispatch(updateGps({
    timestamp: base + 100,
    value: {
      latitude: 10.762622,
      longitude: 106.660172,
      altitude: 3.4,
      satellites: 5,
      hdop: 1.8,
      gpsFix: 2,
    },
  }));
  snapshot = buildAniToolSnapshot(store.getState() as any);
  recorder.recordSnapshot({ ...snapshot, capturedAt: base + 1000 });

  store.dispatch(setFlightMode('GUIDED'));
  snapshot = buildAniToolSnapshot(store.getState() as any);
  const debrief = buildFlightDebrief({ ...snapshot, capturedAt: base + 2000 }, recorder);

  assert.equal(debrief.structuredCard.type, 'FLIGHT_DEBRIEF');
  assert.ok(debrief.structuredCard.metrics?.some(m => m.label === 'Flight time' && !m.value.includes('--')));
  assert.ok(debrief.structuredCard.metrics?.some(m => m.label === 'Lowest battery' && m.value.includes('24%')));
  assert.ok(debrief.structuredCard.metrics?.some(m => m.label === 'Mode changes' && m.value.includes('1')));
  assert.ok(debrief.content.includes('sự kiện đã ghi'));
});
