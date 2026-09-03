import test from 'node:test';
import assert from 'node:assert/strict';
import { aiMissionGenerator } from '../src/services/ai/mission/AiMissionGenerator';
import { MAV_CMD } from '../src/services/mission/MissionCommandRegistry';
import type { MissionProposalParams } from '../src/services/ai/intents/AiIntentTypes';

test('AiMissionGenerator compiles takeoff, waypoints, speed change, and RTL into wire items', () => {
  const proposal: MissionProposalParams = {
    takeoffAltitudeMeters: 20,
    speedMetersPerSecond: 7,
    waypoints: [
      { latitude: 10.762622, longitude: 106.660172, altitudeMeters: 25 },
      { latitude: 10.763622, longitude: 106.661172, altitudeMeters: 30 },
      { latitude: 10.764622, longitude: 106.662172, altitudeMeters: 25 },
    ],
    endAction: 'RTL',
  };

  const result = aiMissionGenerator.generateMission(proposal);

  // 1. Verify editor items structure
  assert.ok(result.editorItems.length >= 5);
  assert.equal(result.editorItems[0].command, MAV_CMD.NAV_TAKEOFF);
  assert.equal(result.editorItems[0].alt, 20);

  const finalItem = result.editorItems[result.editorItems.length - 1];
  assert.equal(finalItem.command, MAV_CMD.NAV_RETURN_TO_LAUNCH);

  // 2. Verify wire protocol items (compiled via compileMission)
  assert.ok(result.wireItems.length >= 5);
  // Must include DO_CHANGE_SPEED command because speed was set to 7 m/s (different from default 5)
  const hasSpeedCmd = result.wireItems.some(item => item.command === MAV_CMD.DO_CHANGE_SPEED);
  assert.equal(hasSpeedCmd, true, 'Compiler must emit real MAV_CMD_DO_CHANGE_SPEED');

  // 3. Verify metrics
  assert.ok(result.totalDistanceMeters > 0, 'Distance must be positive');
  assert.ok(result.estimatedDurationSeconds > 0, 'Duration must be positive');
  assert.equal(result.maxAltitudeMeters, 30, 'Max altitude must match highest waypoint');
});

test('AiMissionGenerator compiles LAND endAction correctly', () => {
  const proposal: MissionProposalParams = {
    takeoffAltitudeMeters: 15,
    speedMetersPerSecond: 5,
    waypoints: [
      { latitude: 10.762622, longitude: 106.660172, altitudeMeters: 15 },
    ],
    endAction: 'LAND',
  };

  const result = aiMissionGenerator.generateMission(proposal);
  const lastItem = result.editorItems[result.editorItems.length - 1];
  assert.equal(lastItem.command, MAV_CMD.NAV_LAND);
});
