import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlightContext } from '../src/services/ai/FlightContextBuilder';
import type { RootState } from '../src/store';
import { DEFAULT_CONNECTION_CONFIG } from '../src/settings/defaults/connection';
import { DEFAULT_MAVLINK_CONFIG } from '../src/settings/defaults/mavlink';
import { DEFAULT_PI_CONFIG } from '../src/settings/defaults/pi';
import { DEFAULT_VIDEO_CONFIG } from '../src/settings/defaults/video';
import { DEFAULT_CAMERA_CONFIG } from '../src/settings/defaults/camera';
import { DEFAULT_TELEMETRY_CONFIG } from '../src/settings/defaults/telemetry';
import { DEFAULT_JOYSTICK_CONFIG } from '../src/settings/defaults/joystick';
import { DEFAULT_AI_CONFIG } from '../src/settings/defaults/ai';
import { MAV_CMD, MAV_FRAME } from '../src/services/mission/MissionCommandRegistry';
import { emptyConnectionHealth } from '../src/services/connection/ConnectionHealth';

function createMockRootState(overrides: Partial<RootState> = {}): RootState {
  return {
    connection: {
      ...emptyConnectionHealth(),
      status: 'DISCONNECTED',
      activeType: 'WEBSOCKET',
      activePortInfo: 'ws://192.168.1.247:8765/mavlink',
      vehicleName: 'NO VEHICLE',
      vehicleType: 'COPTER',
      autopilot: 'ARDUPILOT',
      latencyMs: null,
      lastHeartbeat: null,
      lastPacket: null,
      bytesReceived: 0,
      bytesSent: 0,
      packetsPerSec: 0,
      txPacketsPerSec: 0,
      rxBytesPerSec: 0,
      txBytesPerSec: 0,
      mavlinkVersion: null,
      error: null,
      phase: 'IDLE',
      networkState: 'DISCONNECTED',
      mavlinkState: 'IDLE',
      vehicleState: 'NO_VEHICLE',
      packetsLost: 0,
      sessionId: null,
    },
    drone: {
      armed: false,
      flightMode: 'UNKNOWN',
      systemStatus: 'UNINIT',
      stale: false,
    },
    telemetry: {
      gps: null,
      attitude: null,
      velocity: null,
      battery: null,
      sensors: null,
      stale: false,
      statusTexts: [],
    },
    home: {
      status: 'UNKNOWN',
      position: null,
      selectingOnMap: false,
      previewPosition: null,
      transaction: {
        status: 'IDLE',
        error: null,
        targetLocation: null,
        updatedAt: 0,
      },
    },
    mission: {
      items: [],
      selectedItemId: null,
      syncStatus: 'UNSYNCED',
      syncProgress: 0,
      rawWireItems: [],
      verifyResult: null,
    },
    command: {
      pending: null,
      history: [],
    },
    video: {
      status: 'OFFLINE',
      activeStreamUrl: null,
      latency: null,
      jitter: null,
      qualityScore: null,
      error: null,
      mediaMtxConnected: false,
      webrtcConnected: false,
      fps: null,
      bitrateKbps: null,
      lastHeartbeat: null,
      reconnectAttempts: 0,
    },
    settings: {
      showJoysticks: true,
      showTelemetry: true,
      mainViewMode: 'HUD',
      flightDisplayMode: 'HUD',
      flightDisplayManual: false,
      connection: DEFAULT_CONNECTION_CONFIG,
      connectionProfiles: [],
      mavlink: DEFAULT_MAVLINK_CONFIG,
      piGateway: DEFAULT_PI_CONFIG,
      video: DEFAULT_VIDEO_CONFIG,
      camera: DEFAULT_CAMERA_CONFIG,
      telemetry: DEFAULT_TELEMETRY_CONFIG,
      joystick: DEFAULT_JOYSTICK_CONFIG,
      ai: DEFAULT_AI_CONFIG,
    },
    ...overrides,
  };
}

test('FlightContextBuilder produces truthful nulls when vehicle is disconnected', () => {
  const state = createMockRootState();
  const context = buildFlightContext(state);

  assert.equal(context.vehicle.connected, false);
  assert.equal(context.vehicle.mode, 'UNKNOWN');
  assert.equal(context.vehicle.armed, false);
  assert.equal(context.battery, null);
  assert.equal(context.gps, null);
  assert.equal(context.flight.altitude, null);
  assert.equal(context.flight.heading, null);
  assert.equal(context.flight.groundSpeed, null);
  assert.equal(context.home.isSet, false);
  assert.equal(context.mission, null);
});

test('FlightContextBuilder extracts real telemetry when vehicle is connected and armed', () => {
  const now = Date.now();
  const state = createMockRootState({
    connection: {
      ...emptyConnectionHealth(),
      status: 'CONNECTED',
      activeType: 'WEBSOCKET',
      activePortInfo: 'ws://192.168.1.247:8765/mavlink',
      vehicleName: 'Hexa-01',
      vehicleType: 'COPTER',
      autopilot: 'ARDUPILOT',
      latencyMs: 14,
      lastHeartbeat: now - 150,
      lastPacket: now - 20,
      bytesReceived: 51200,
      bytesSent: 1200,
      packetsPerSec: 145,
      txPacketsPerSec: 5,
      rxBytesPerSec: 12000,
      txBytesPerSec: 350,
      mavlinkVersion: 2,
      error: null,
      phase: 'CONNECTED',
      networkState: 'BOUND',
      mavlinkState: 'ACTIVE',
      vehicleState: 'CONNECTED',
      packetsLost: 2,
      sessionId: 'session-1',
      networkStatus: 'CONNECTED',
      mavlinkStatus: 'HEARTBEAT_OK',
      vehicleStatus: 'AVAILABLE',
      controlStatus: 'READY',
      controlAvailable: true,
      linkQuality: 'GOOD',
      linkQualityScore: 85,
      lastHeartbeatAt: now - 150,
      heartbeatAgeMs: 150,
      transport: 'WEBSOCKET',
      transportStatus: 'READY',
    },
    drone: {
      armed: true,
      flightMode: 'LOITER',
      systemStatus: 'ACTIVE',
      stale: false,
    },
    telemetry: {
      gps: {
        value: {
          latitude: 10.762622,
          longitude: 106.660172,
          altitude: 25.4,
          satellites: 14,
          hdop: 0.9,
          gpsFix: 3,
        },
        timestamp: now,
      },
      attitude: {
        value: {
          roll: 1.2,
          pitch: -0.5,
          yaw: 184.6,
        },
        timestamp: now,
      },
      velocity: {
        value: {
          groundSpeed: 3.8,
          verticalSpeed: 0.1,
          velocityX: 3.5,
          velocityY: 1.2,
          velocityZ: -0.1,
        },
        timestamp: now,
      },
      battery: {
        value: {
          voltage: 15.6,
          current: 12.4,
          percentage: 88,
        },
        timestamp: now,
      },
      sensors: {
        value: [
          { name: 'Compass', health: 'GOOD' },
          { name: 'Gyroscope', health: 'GOOD' },
        ],
        timestamp: now,
      },
      stale: false,
      statusTexts: [],
    },
    home: {
      status: 'SET',
      position: {
        latitude: 10.762500,
        longitude: 106.660100,
        altitude: 0.0,
        updatedAt: now,
      },
      selectingOnMap: false,
      previewPosition: null,
      transaction: {
        status: 'IDLE',
        error: null,
        targetLocation: null,
        updatedAt: 0,
      },
    },
  });

  const context = buildFlightContext(state);

  assert.equal(context.vehicle.connected, true);
  assert.equal(context.vehicle.mode, 'LOITER');
  assert.equal(context.vehicle.armed, true);
  assert.equal(context.battery?.voltage, 15.6);
  assert.equal(context.battery?.percentage, 88);
  assert.equal(context.gps?.satellites, 14);
  assert.equal(context.gps?.fixType, 3);
  assert.equal(context.flight.altitude, 25.4);
  assert.equal(context.flight.groundSpeed, 3.8);
  assert.equal(context.flight.heading, 185);
  assert.equal(context.home.isSet, true);
  assert.ok(context.home.distanceMeters! > 0);
  assert.equal(context.warnings.length, 0);
});

test('FlightContextBuilder includes active PreArm warnings and STATUSTEXT autopilot errors', () => {
  const now = Date.now();
  const state = createMockRootState({
    connection: {
      ...emptyConnectionHealth(),
      status: 'CONNECTED',
      activeType: 'UDP',
      activePortInfo: 'UDP 0.0.0.0:14550',
      vehicleName: 'Quadcopter',
      vehicleType: 'COPTER',
      autopilot: 'ARDUPILOT',
      latencyMs: null,
      lastHeartbeat: now - 200,
      lastPacket: now - 50,
      bytesReceived: 1000,
      bytesSent: 100,
      packetsPerSec: 20,
      txPacketsPerSec: 1,
      rxBytesPerSec: 200,
      txBytesPerSec: 10,
      mavlinkVersion: 2,
      error: null,
      phase: 'CONNECTED',
      networkState: 'BOUND',
      mavlinkState: 'ACTIVE',
      vehicleState: 'CONNECTED',
      packetsLost: 0,
      sessionId: 'session-2',
      networkStatus: 'CONNECTED',
      mavlinkStatus: 'HEARTBEAT_OK',
      vehicleStatus: 'AVAILABLE',
      controlStatus: 'READY',
      controlAvailable: true,
      linkQuality: 'GOOD',
      linkQualityScore: 85,
      lastHeartbeatAt: now - 200,
      heartbeatAgeMs: 200,
      transport: 'UDP',
      transportStatus: 'READY',
    },
    telemetry: {
      gps: null, // No GPS fix
      attitude: null,
      velocity: null,
      battery: {
        value: {
          voltage: 13.8,
          current: 0.5,
          percentage: 15, // Below threshold
        },
        timestamp: now,
      },
      sensors: null,
      stale: false,
      statusTexts: [
        { severity: 3, text: 'PreArm: Compass not calibrated', timestamp: now - 2000 },
        { severity: 4, text: 'PreArm: RC not calibrated', timestamp: now - 3000 },
      ],
    },
  });

  const context = buildFlightContext(state);

  assert.ok(context.warnings.some(w => w.includes('Need 3D GPS Fix')));
  assert.ok(context.warnings.some(w => w.includes('Battery 1 low')));
  assert.ok(context.warnings.includes('PreArm: Compass not calibrated'));
  assert.ok(context.warnings.includes('PreArm: RC not calibrated'));
});

test('FlightContextBuilder summarizes mission waypoints and safety commands', () => {
  const state = createMockRootState({
    mission: {
      items: [
        {
          id: 'item-1',
          command: MAV_CMD.NAV_TAKEOFF,
          frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
          lat: 10.7626,
          lng: 106.6601,
          alt: 15,
          autocontinue: true,
        },
        {
          id: 'item-2',
          command: MAV_CMD.NAV_WAYPOINT,
          frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
          lat: 10.7630,
          lng: 106.6605,
          alt: 25,
          speed: 6,
          autocontinue: true,
        },
        {
          id: 'item-3',
          command: MAV_CMD.NAV_RETURN_TO_LAUNCH,
          frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
          autocontinue: true,
        },
      ],
      selectedItemId: null,
      syncStatus: 'SYNCED',
      syncProgress: 1,
      rawWireItems: [],
      verifyResult: null,
    },
  });

  const context = buildFlightContext(state);

  assert.ok(context.mission);
  assert.equal(context.mission.count, 3);
  assert.equal(context.mission.hasTakeoff, true);
  assert.equal(context.mission.hasRtl, true);
  assert.equal(context.mission.maxAltitudeMeters, 25);
  assert.ok(context.mission.totalDistanceMeters > 0);
  assert.equal(context.mission.speedChanges.length, 1);
});

test('TEST 1: GPS 0 SAT / NO FIX is not treated as missing data', () => {
  const now = Date.now();
  const state = createMockRootState({
    connection: {
      ...emptyConnectionHealth(),
      status: 'CONNECTED',
      networkStatus: 'CONNECTED',
      mavlinkStatus: 'HEARTBEAT_OK',
      vehicleStatus: 'AVAILABLE',
      heartbeatAgeMs: 120,
    },
    drone: {
      armed: false,
      flightMode: 'LAND',
      systemStatus: 'STANDBY',
      stale: false,
    },
    telemetry: {
      gps: {
        timestamp: now - 50,
        value: {
          latitude: 0,
          longitude: 0,
          altitude: 0,
          satellites: 0,
          hdop: 99.9,
          gpsFix: 0,
        },
      },
      attitude: null,
      velocity: null,
      battery: {
        timestamp: now - 50,
        value: { voltage: 16.2, current: 0.8, percentage: 93 },
      },
      sensors: null,
      stale: false,
      statusTexts: [],
    },
  });

  const context = buildFlightContext(state);
  assert.equal(context.vehicle.connected, true);
  assert.equal(context.battery?.percentage, 93);
  assert.equal(context.gps?.available, true);
  assert.equal(context.gps?.fix, false);
  assert.equal(context.gps?.satellites, 0);
  assert.equal(context.gps?.fixDescription, 'NO FIX');

  const { buildWhatsHappening } = require('../src/services/ai/AniDiagnostics');
  const { buildAniToolSnapshot } = require('../src/services/ai/AniToolbox');
  const response = buildWhatsHappening(buildAniToolSnapshot(state));
  assert.ok(response.content.includes('Pin 93%'));
  assert.ok(response.content.includes('GPS chưa fix (0 vệ tinh)'));
  assert.ok(!response.content.includes('chưa có heartbeat vehicle tươi'));
});

test('TEST 2: Network connected without heartbeat informs user network is ok but drone heartbeat is missing', () => {
  const state = createMockRootState({
    connection: {
      ...emptyConnectionHealth(),
      status: 'CONNECTED',
      networkStatus: 'CONNECTED',
      mavlinkStatus: 'WAITING',
      vehicleStatus: 'NO_VEHICLE',
      heartbeatAgeMs: null,
    },
  });

  const { buildWhatsHappening } = require('../src/services/ai/AniDiagnostics');
  const { buildAniToolSnapshot } = require('../src/services/ai/AniToolbox');
  const response = buildWhatsHappening(buildAniToolSnapshot(state));
  assert.ok(response.content.includes('App đang có kết nối mạng nhưng chưa nhận được MAVLink heartbeat từ drone.'));
});

test('TEST 3: Vehicle connected with battery missing reports only battery unavailable without dropping context', () => {
  const now = Date.now();
  const state = createMockRootState({
    connection: {
      ...emptyConnectionHealth(),
      status: 'CONNECTED',
      networkStatus: 'CONNECTED',
      mavlinkStatus: 'HEARTBEAT_OK',
      vehicleStatus: 'AVAILABLE',
      heartbeatAgeMs: 90,
    },
    drone: {
      armed: false,
      flightMode: 'LOITER',
      systemStatus: 'STANDBY',
      stale: false,
    },
    telemetry: {
      gps: null,
      attitude: null,
      velocity: null,
      battery: null,
      sensors: null,
      stale: false,
      statusTexts: [],
    },
  });

  const context = buildFlightContext(state);
  assert.equal(context.vehicle.connected, true);
  assert.equal(context.battery, null);

  const { buildWhatsHappening } = require('../src/services/ai/AniDiagnostics');
  const { buildAniToolSnapshot } = require('../src/services/ai/AniToolbox');
  const response = buildWhatsHappening(buildAniToolSnapshot(state));
  assert.ok(response.content.includes('Chưa nhận được dữ liệu battery.'));
  assert.ok(response.content.includes('Drone đang ở LOITER'));
});

test('TEST 4: GPS 12 satellites and 3D fix reports healthy', () => {
  const now = Date.now();
  const state = createMockRootState({
    connection: {
      ...emptyConnectionHealth(),
      status: 'CONNECTED',
      networkStatus: 'CONNECTED',
      mavlinkStatus: 'HEARTBEAT_OK',
      vehicleStatus: 'AVAILABLE',
      heartbeatAgeMs: 80,
    },
    drone: {
      armed: false,
      flightMode: 'LOITER',
      systemStatus: 'ACTIVE',
      stale: false,
    },
    telemetry: {
      gps: {
        timestamp: now - 50,
        value: {
          latitude: 10.8231,
          longitude: 106.6297,
          altitude: 12.5,
          satellites: 12,
          hdop: 0.8,
          gpsFix: 3,
        },
      },
      attitude: null,
      velocity: null,
      battery: {
        timestamp: now - 50,
        value: { voltage: 16.5, current: 1.2, percentage: 88 },
      },
      sensors: null,
      stale: false,
      statusTexts: [],
    },
  });

  const context = buildFlightContext(state);
  assert.equal(context.gps?.available, true);
  assert.equal(context.gps?.fix, true);
  assert.equal(context.gps?.satellites, 12);
  assert.equal(context.gps?.fixDescription, '3D FIX');

  const { buildWhatsHappening } = require('../src/services/ai/AniDiagnostics');
  const { buildAniToolSnapshot } = require('../src/services/ai/AniToolbox');
  const response = buildWhatsHappening(buildAniToolSnapshot(state));
  assert.ok(response.content.includes('GPS đã fix 3D (12 vệ tinh)'));
});

test('TEST 5: getFlightContextTool returns sanitized live telemetry from Redux state', () => {
  const now = Date.now();
  const state = createMockRootState({
    connection: {
      ...emptyConnectionHealth(),
      status: 'CONNECTED',
      networkStatus: 'CONNECTED',
      mavlinkStatus: 'HEARTBEAT_OK',
      vehicleStatus: 'AVAILABLE',
      heartbeatAgeMs: 150,
    },
    drone: {
      armed: false,
      flightMode: 'LAND',
      systemStatus: 'ACTIVE',
      stale: false,
    },
    telemetry: {
      gps: {
        timestamp: now,
        value: {
          latitude: 0,
          longitude: 0,
          altitude: 0,
          satellites: 0,
          hdop: null,
          gpsFix: 0,
        },
      },
      attitude: null,
      velocity: null,
      battery: {
        timestamp: now,
        value: { voltage: 15.9, current: 0.5, percentage: 93 },
      },
      sensors: null,
      stale: false,
      statusTexts: [],
    },
  });

  const { getFlightContextTool } = require('../src/services/ai/AniRealtimeTools');
  const result = getFlightContextTool(state);
  assert.equal(result.ok, true);
  assert.equal(result.context.battery?.percentage, 93);
  assert.equal(result.context.gps?.available, true);
  assert.equal(result.context.gps?.fix, false);
  assert.equal(result.context.gps?.satellites, 0);
  assert.equal(result.context.gps?.fixDescription, 'NO FIX');
});
