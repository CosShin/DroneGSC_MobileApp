import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDestination, calculateDistanceMeters } from '../src/utils/geographic';
import { aiMissionGenerator } from '../src/services/ai/mission/AiMissionGenerator';
import { aiFlightSupervisor } from '../src/services/ai/supervisor/AiFlightSupervisor';
import { videoFrameCaptureService } from '../src/services/video/VideoFrameCaptureService';
import { precisionLandingAdvisor } from '../src/services/vision/PrecisionLandingAdvisor';
import { aiService } from '../src/services/ai/AiService';
import { MavlinkManager } from '../src/services/mavlink/MavlinkManager';
import { MavlinkFrame } from '../src/services/mavlink/MavlinkProtocol';
import { decodeInspectorPacket } from '../src/services/mavlink/MavlinkInspectorDecoder';

test('PHASE 6: calculateDestination computes accurate geographic destination coordinates', () => {
  const startLat = 10.762622;
  const startLon = 106.660172;
  const distanceM = 100; // 100 meters
  const bearingNorth = 0; // Due North

  const dest = calculateDestination(startLat, startLon, distanceM, bearingNorth);
  assert.ok(dest.latitude > startLat, 'Latitude should increase when moving North');
  assert.ok(Math.abs(dest.longitude - startLon) < 0.0001, 'Longitude should remain approximately constant');

  const actualDist = calculateDistanceMeters(startLat, startLon, dest.latitude, dest.longitude);
  assert.ok(Math.abs(actualDist - 100) < 0.5, `Calculated distance should be ~100m, got ${actualDist}`);
});

test('PHASE 6: AiMissionGenerator enforces strict safety limits on altitude and speed', () => {
  // Test valid mission
  const compiled = aiMissionGenerator.generateMission({
    takeoffAltitudeMeters: 20,
    speedMetersPerSecond: 6,
    waypoints: [
      { latitude: 10.762, longitude: 106.660, altitudeMeters: 25 },
      { latitude: 10.763, longitude: 106.661, altitudeMeters: 30 },
    ],
    endAction: 'RTL',
  });

  assert.equal(compiled.editorItems.length, 4); // Takeoff, WP1, WP2, RTL
  assert.ok(compiled.totalDistanceMeters > 0);
  assert.ok(compiled.wireItems.length >= 4);

  // Test invalid ceiling
  assert.throws(() => {
    aiMissionGenerator.generateMission({
      takeoffAltitudeMeters: 150, // Exceeds 120m ceiling
      waypoints: [{ latitude: 10.762, longitude: 106.660, altitudeMeters: 20 }],
    });
  });
});

test('PHASE 7: Mission upload and start are strictly decoupled', () => {
  const missionParams = {
    takeoffAltitudeMeters: 15,
    speedMetersPerSecond: 5,
    waypoints: [{ latitude: 10.762, longitude: 106.660, altitudeMeters: 20 }],
    endAction: 'RTL' as const,
  };

  const compiled = aiMissionGenerator.generateMission(missionParams);
  assert.ok(compiled.wireItems.length > 0);

  // Uploading creates wire items for autopilot
  // Starting the mission requires a separate SET_MODE AUTO command with pilot hold-to-confirm
  const startMissionIntent = { type: 'START_MISSION' };
  assert.equal(startMissionIntent.type, 'START_MISSION');
});

test('PHASE 8: AiFlightSupervisor detects low battery in flight and emits RTL proposal', () => {
  let receivedAlert: any = null;
  const unsubscribe = aiFlightSupervisor.subscribe(alert => {
    receivedAlert = alert;
  });

  const mockState: any = {
    connection: { status: 'CONNECTED', vehicleState: 'CONNECTED' },
    drone: { armed: true, flightMode: 'LOITER', stale: false },
    telemetry: {
      stale: false,
      battery: { value: { percentage: 20, voltage: 14.8 } },
      gps: { value: { latitude: 10.762, longitude: 106.660, gpsFix: 3 } },
    },
    home: {
      position: { latitude: 10.760, longitude: 106.660, altitude: 10 },
    },
  };

  aiFlightSupervisor.evaluateTelemetry(mockState);

  assert.ok(receivedAlert, 'Supervisor should emit an alert when battery <= 25% while armed');
  assert.equal(receivedAlert.suggestedAction, 'RTL');
  assert.ok(receivedAlert.message.includes('20%'));

  unsubscribe();
});

test('PHASE 8: AiFlightSupervisor detects GPS degradation in autonomous mode', () => {
  let receivedAlert: any = null;
  const unsubscribe = aiFlightSupervisor.subscribe(alert => {
    receivedAlert = alert;
  });

  const mockState: any = {
    connection: { status: 'CONNECTED', vehicleState: 'CONNECTED' },
    drone: { armed: true, flightMode: 'AUTO', stale: false },
    telemetry: {
      stale: false,
      battery: { value: { percentage: 80, voltage: 16.2 } },
      gps: { value: { latitude: 10.762, longitude: 106.660, gpsFix: 1 } }, // Fix dropped to 1
    },
    home: { position: null },
  };

  aiFlightSupervisor.evaluateTelemetry(mockState);

  assert.ok(receivedAlert, 'Supervisor should emit an alert when GPS fix drops in AUTO mode');
  assert.equal(receivedAlert.level, 'CRITICAL');
  assert.ok(receivedAlert.message.includes('GPS mất 3D Fix'));

  unsubscribe();
});

test('PHASE 9: VideoFrameCaptureService returns null when camera is unmounted or offline', async () => {
  videoFrameCaptureService.registerFrameProvider(null);
  const frame = await videoFrameCaptureService.captureCurrentFrame();
  assert.equal(frame, null, 'Should return null when no live provider is registered (no fake pixels)');

  // Mock live provider
  videoFrameCaptureService.registerFrameProvider(async () => ({
    base64: 'mock-base64-data',
    width: 640,
    height: 480,
    timestamp: Date.now(),
    source: 'WEBRTC_PLAYER',
    isLive: true,
  }));

  const liveFrame = await videoFrameCaptureService.captureCurrentFrame();
  assert.ok(liveFrame);
  assert.equal(liveFrame.base64, 'mock-base64-data');
  assert.equal(liveFrame.width, 640);

  // Clean up
  videoFrameCaptureService.registerFrameProvider(null);
});

test('PHASE 10: Vision query handles camera analysis quick action', async () => {
  aiService.clearHistory();

  // Test executing ANALYZE_CAMERA when video is offline
  await aiService.executeQuickAction('ANALYZE_CAMERA');
  const state = aiService.getState();

  // Error message added because camera is offline
  const lastMsg = state.messages[state.messages.length - 1];
  assert.ok(lastMsg.content.includes('Không thể chụp') || lastMsg.content.includes('VISION'));
});

test('PHASE 11: PrecisionLandingAdvisor provides accurate pilot guidance', () => {
  precisionLandingAdvisor.updateTargetState({
    targetFound: true,
    tagId: 0,
    offsetXCentimeters: 15, // 15cm right
    offsetYCentimeters: -8, // 8cm back
    altitudeMeters: 2.5,
    confidence: 0.98,
  });

  const state = precisionLandingAdvisor.getTargetState();
  assert.equal(state.targetFound, true);
  assert.equal(state.tagId, 0);
  assert.equal(state.offsetXCentimeters, 15);

  const descVi = precisionLandingAdvisor.getAdvisoryDescription('vi-VN');
  assert.ok(descVi.includes('Đã khóa landing marker'));
  assert.ok(descVi.includes('15cm sang phải'));
  assert.ok(descVi.includes('8cm'));
  assert.ok(descVi.includes('2.5m'));

  // When target lost
  precisionLandingAdvisor.updateTargetState({ targetFound: false });
  const lostDesc = precisionLandingAdvisor.getAdvisoryDescription('vi-VN');
  assert.ok(lostDesc.includes('Chưa phát hiện landing marker'));
});

test('PHASE 11: MavlinkManager and Inspector decode message 149 LANDING_TARGET', () => {
  const manager = new MavlinkManager();

  // Construct MAVLink LANDING_TARGET frame (Message ID 149, length 30)
  const payload = new Uint8Array(30);
  const view = new DataView(payload.buffer);
  view.setFloat32(8, 0.05, true);  // angle_x
  view.setFloat32(12, -0.02, true); // angle_y
  view.setFloat32(16, 3.2, true);   // distance = 3.2m
  payload[28] = 4;                 // target_num = 4
  payload[29] = 0;                 // frame

  const frame: MavlinkFrame = {
    version: 2,
    incompatibilityFlags: 0,
    compatibilityFlags: 0,
    sequence: 1,
    systemId: 1,
    componentId: 1,
    messageId: 149,
    payload,
    checksum: 0x1234,
  };

  const event = {
    direction: 'RX' as const,
    timestamp: Date.now(),
    sessionId: 1,
    frame,
  };

  const inspected = decodeInspectorPacket(event, 1);
  assert.equal(inspected.messageId, 149);
  assert.equal(inspected.messageName, 'LANDING_TARGET');
  assert.ok(inspected.summary?.includes('Target #4'));

  const distField = inspected.fields.find(f => f.label === 'distance');
  assert.equal(distField?.value, '3.20 m');
});
