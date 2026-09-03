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

function createMockRootState(overrides: Partial<RootState> = {}): RootState {
  return {
    connection: {
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
