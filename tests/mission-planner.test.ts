import assert from 'node:assert/strict';
import test from 'node:test';
import { MAV_CMD, MAV_FRAME, getCommandDefinition } from '../src/services/mission/MissionCommandRegistry';
import { compileMission } from '../src/services/mission/MissionCompiler';
import { decompileMission } from '../src/services/mission/MissionDecompiler';
import { validateMission, verifyRoundTrip } from '../src/services/mission/MissionValidator';
import { MissionEditorItem } from '../src/services/mission/MissionTypes';

test('compiles standard waypoint with coordinate int32 scaling and hold delay', () => {
  const editorItem: MissionEditorItem = {
    id: 'wp-1',
    command: MAV_CMD.NAV_WAYPOINT,
    frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    lat: 10.841883,
    lng: 106.676717,
    alt: 50,
    delay: 5,
    autocontinue: true,
  };

  const wire = compileMission([editorItem]);
  assert.equal(wire.length, 1);
  assert.equal(wire[0].seq, 0);
  assert.equal(wire[0].command, MAV_CMD.NAV_WAYPOINT);
  assert.equal(wire[0].frame, MAV_FRAME.GLOBAL_RELATIVE_ALT);
  assert.equal(wire[0].param1, 5); // Hold time
  assert.equal(wire[0].x, Math.round(10.841883 * 1e7));
  assert.equal(wire[0].y, Math.round(106.676717 * 1e7));
  assert.equal(wire[0].z, 50);
  assert.equal(wire[0].autocontinue, 1);
});

test('compiles takeoff and RTL commands with correct frames and params', () => {
  const takeoffItem: MissionEditorItem = {
    id: 'takeoff-1',
    command: MAV_CMD.NAV_TAKEOFF,
    frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    lat: 10.841883,
    lng: 106.676717,
    alt: 15,
    autocontinue: true,
  };

  const rtlItem: MissionEditorItem = {
    id: 'rtl-1',
    command: MAV_CMD.NAV_RETURN_TO_LAUNCH,
    frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    autocontinue: true,
  };

  const wire = compileMission([takeoffItem, rtlItem]);
  assert.equal(wire.length, 2);
  assert.equal(wire[0].command, MAV_CMD.NAV_TAKEOFF);
  assert.equal(wire[0].z, 15);
  assert.equal(wire[1].command, MAV_CMD.NAV_RETURN_TO_LAUNCH);
  assert.equal(wire[1].frame, MAV_FRAME.MISSION);
});

test('speed semantics: generates real MAV_CMD_DO_CHANGE_SPEED when speed changes', () => {
  const editorItems: MissionEditorItem[] = [
    {
      id: 'wp-1',
      command: MAV_CMD.NAV_WAYPOINT,
      lat: 10.841883,
      lng: 106.676717,
      alt: 15,
      speed: 5,
      autocontinue: true,
    },
    {
      id: 'wp-2',
      command: MAV_CMD.NAV_WAYPOINT,
      lat: 10.842883,
      lng: 106.677717,
      alt: 20,
      speed: 3, // Speed change to 3 m/s
      autocontinue: true,
    },
  ];

  const wire = compileMission(editorItems, { defaultSpeed: 5 });
  
  // Wire must contain 3 items: WP1, DO_CHANGE_SPEED (3m/s), WP2
  assert.equal(wire.length, 3);
  
  // Item 0: WP1
  assert.equal(wire[0].command, MAV_CMD.NAV_WAYPOINT);
  assert.equal(wire[0].seq, 0);

  // Item 1: DO_CHANGE_SPEED
  assert.equal(wire[1].command, MAV_CMD.DO_CHANGE_SPEED);
  assert.equal(wire[1].seq, 1);
  assert.equal(wire[1].frame, MAV_FRAME.MISSION);
  assert.equal(wire[1].param1, 1); // 1 = Groundspeed
  assert.equal(wire[1].param2, 3); // 3 m/s
  assert.equal(wire[1].param3, -1); // Throttle unchanged
  assert.equal(wire[1].param4, 0); // Absolute

  // Item 2: WP2
  assert.equal(wire[2].command, MAV_CMD.NAV_WAYPOINT);
  assert.equal(wire[2].seq, 2);
  assert.equal(wire[2].z, 20);
});

test('decompiles wire items and preserves DO_CHANGE_SPEED speed context', () => {
  const wireItems = [
    {
      seq: 0,
      frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
      command: MAV_CMD.NAV_TAKEOFF,
      current: 1,
      autocontinue: 1,
      param1: 0,
      param2: 0,
      param3: 0,
      param4: 0,
      x: Math.round(10.841883 * 1e7),
      y: Math.round(106.676717 * 1e7),
      z: 10,
      missionType: 0,
    },
    {
      seq: 1,
      frame: MAV_FRAME.MISSION,
      command: MAV_CMD.DO_CHANGE_SPEED,
      current: 0,
      autocontinue: 1,
      param1: 1,
      param2: 3.5,
      param3: -1,
      param4: 0,
      x: 0,
      y: 0,
      z: 0,
      missionType: 0,
    },
    {
      seq: 2,
      frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
      command: MAV_CMD.NAV_WAYPOINT,
      current: 0,
      autocontinue: 1,
      param1: 0,
      param2: 0,
      param3: 0,
      param4: 0,
      x: Math.round(10.842883 * 1e7),
      y: Math.round(106.677717 * 1e7),
      z: 20,
      missionType: 0,
    },
  ];

  const decompiled = decompileMission(wireItems);
  assert.equal(decompiled.length, 3);
  assert.equal(decompiled[0].command, MAV_CMD.NAV_TAKEOFF);
  assert.equal(decompiled[0].alt, 10);
  assert.equal(decompiled[1].command, MAV_CMD.DO_CHANGE_SPEED);
  assert.equal(decompiled[1].speed, 3.5);
  assert.equal(decompiled[2].command, MAV_CMD.NAV_WAYPOINT);
  assert.equal(decompiled[2].speed, 3.5); // Inherited active speed
});

test('mission validation blocks invalid coordinates and NaN values', () => {
  const invalidItems: MissionEditorItem[] = [
    {
      id: 'inv-1',
      command: MAV_CMD.NAV_WAYPOINT,
      lat: 120, // Invalid latitude > 90
      lng: 106.676717,
      alt: 50,
      autocontinue: true,
    },
  ];

  const val = validateMission(invalidItems);
  assert.equal(val.valid, false);
  assert.equal(val.errors.length, 1);
  assert.match(val.errors[0].message, /invalid latitude/i);
});

test('round-trip verification detects mismatches accurately', () => {
  const uploaded = compileMission([
    {
      id: 'wp-1',
      command: MAV_CMD.NAV_WAYPOINT,
      lat: 10.841883,
      lng: 106.676717,
      alt: 50,
      autocontinue: true,
    },
  ]);

  const downloadedMatch = [...uploaded];
  const verifiedSuccess = verifyRoundTrip(uploaded, downloadedMatch);
  assert.equal(verifiedSuccess.match, true);
  assert.equal(verifiedSuccess.diffs.length, 0);

  const downloadedMismatch = [
    {
      ...uploaded[0],
      z: 30, // Altitude mismatch (50 vs 30)
    },
  ];

  const verifiedFail = verifyRoundTrip(uploaded, downloadedMismatch);
  assert.equal(verifiedFail.match, false);
  assert.equal(verifiedFail.diffs.length, 1);
  assert.equal(verifiedFail.diffs[0].field, 'z (alt)');
});

test('full ArduCopter test mission: TAKEOFF 10m -> WP A 15m (hold 5s) -> CHANGE SPEED 3m/s -> WP B 20m -> RTL', () => {
  const missionSpec: MissionEditorItem[] = [
    {
      id: '1',
      command: MAV_CMD.NAV_TAKEOFF,
      lat: 10.841883,
      lng: 106.676717,
      alt: 10,
      autocontinue: true,
    },
    {
      id: '2',
      command: MAV_CMD.NAV_WAYPOINT,
      lat: 10.842500,
      lng: 106.677500,
      alt: 15,
      delay: 5,
      autocontinue: true,
    },
    {
      id: '3',
      command: MAV_CMD.DO_CHANGE_SPEED,
      speed: 3,
      autocontinue: true,
    },
    {
      id: '4',
      command: MAV_CMD.NAV_WAYPOINT,
      lat: 10.843500,
      lng: 106.678500,
      alt: 20,
      autocontinue: true,
    },
    {
      id: '5',
      command: MAV_CMD.NAV_RETURN_TO_LAUNCH,
      autocontinue: true,
    },
  ];

  // 1. Validation check
  const val = validateMission(missionSpec);
  assert.equal(val.valid, true);

  // 2. Compile to wire items
  const compiled = compileMission(missionSpec);
  assert.equal(compiled.length, 5);

  // Sequence check
  assert.deepEqual(compiled.map(c => c.seq), [0, 1, 2, 3, 4]);

  // Item 0: TAKEOFF 10m
  assert.equal(compiled[0].command, MAV_CMD.NAV_TAKEOFF);
  assert.equal(compiled[0].z, 10);
  assert.equal(compiled[0].x, Math.round(10.841883 * 1e7));

  // Item 1: WP A 15m, hold 5s
  assert.equal(compiled[1].command, MAV_CMD.NAV_WAYPOINT);
  assert.equal(compiled[1].z, 15);
  assert.equal(compiled[1].param1, 5);

  // Item 2: DO_CHANGE_SPEED 3m/s
  assert.equal(compiled[2].command, MAV_CMD.DO_CHANGE_SPEED);
  assert.equal(compiled[2].param1, 1); // Groundspeed
  assert.equal(compiled[2].param2, 3); // 3 m/s

  // Item 3: WP B 20m
  assert.equal(compiled[3].command, MAV_CMD.NAV_WAYPOINT);
  assert.equal(compiled[3].z, 20);

  // Item 4: RTL
  assert.equal(compiled[4].command, MAV_CMD.NAV_RETURN_TO_LAUNCH);

  // 3. Decompile back and verify round-trip
  const decompiled = decompileMission(compiled);
  const recompiled = compileMission(decompiled);
  const verification = verifyRoundTrip(compiled, recompiled);
  assert.equal(verification.match, true);
});
