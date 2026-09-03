import { MAV_CMD, MAV_FRAME, getCommandDefinition } from './MissionCommandRegistry';
import { MissionEditorItem, MissionItemInt } from './MissionTypes';

export interface CompileOptions {
  autoEmitSpeedChanges?: boolean;
  defaultSpeed?: number;
}

/**
 * Compiles high-level MissionEditorItem array into wire-protocol MissionItemInt array
 * according to ArduPilot Copter MAVLink mission specifications.
 */
export function compileMission(
  editorItems: MissionEditorItem[],
  options: CompileOptions = {}
): MissionItemInt[] {
  const { autoEmitSpeedChanges = true, defaultSpeed = 5 } = options;
  const compiled: MissionItemInt[] = [];
  let currentSpeed = defaultSpeed;

  for (let i = 0; i < editorItems.length; i++) {
    const item = editorItems[i];
    const def = getCommandDefinition(item.command);

    // 1. If item specifies a new leg speed (different from current tracking speed)
    // and is not already a standalone DO_CHANGE_SPEED command, emit a DO_CHANGE_SPEED command first.
    if (
      autoEmitSpeedChanges &&
      item.speed !== undefined &&
      Number.isFinite(item.speed) &&
      item.speed > 0 &&
      Math.abs(item.speed - currentSpeed) > 0.01 &&
      item.command !== MAV_CMD.DO_CHANGE_SPEED
    ) {
      compiled.push({
        seq: compiled.length,
        frame: MAV_FRAME.MISSION,
        command: MAV_CMD.DO_CHANGE_SPEED,
        current: compiled.length === 0 ? 1 : 0,
        autocontinue: 1,
        param1: 1, // 1 = Groundspeed
        param2: item.speed, // Speed in m/s
        param3: -1, // -1 = Throttle unchanged
        param4: 0, // 0 = Absolute speed
        x: 0,
        y: 0,
        z: 0,
        missionType: 0,
      });
      currentSpeed = item.speed;
    }

    // 2. Encode the primary mission item
    let param1 = item.param1 ?? 0;
    let param2 = item.param2 ?? 0;
    let param3 = item.param3 ?? 0;
    let param4 = item.param4 ?? 0;

    // Handle high-level aliases
    if (item.command === MAV_CMD.NAV_WAYPOINT || item.command === MAV_CMD.NAV_SPLINE_WAYPOINT) {
      if (item.delay !== undefined && Number.isFinite(item.delay)) {
        param1 = item.delay;
      }
    } else if (item.command === MAV_CMD.NAV_LOITER_TIME) {
      if (item.delay !== undefined && Number.isFinite(item.delay)) {
        param1 = item.delay;
      }
    } else if (item.command === MAV_CMD.DO_CHANGE_SPEED) {
      param1 = item.param1 ?? 1; // Groundspeed
      param2 = item.speed ?? item.param2 ?? 5; // Speed in m/s
      param3 = item.param3 ?? -1;
      param4 = item.param4 ?? 0;
      currentSpeed = param2;
    }

    // Coordinate conversions
    const x = def.hasLocation && item.lat !== undefined && Number.isFinite(item.lat)
      ? Math.round(item.lat * 1e7)
      : 0;

    const y = def.hasLocation && item.lng !== undefined && Number.isFinite(item.lng)
      ? Math.round(item.lng * 1e7)
      : 0;

    const z = def.hasAltitude && item.alt !== undefined && Number.isFinite(item.alt)
      ? item.alt
      : 0;

    // Frame selection
    let frame = item.frame ?? def.defaultFrame;
    if (!def.hasLocation && !def.hasAltitude) {
      frame = MAV_FRAME.MISSION;
    }

    compiled.push({
      seq: compiled.length,
      frame,
      command: item.command,
      current: compiled.length === 0 ? 1 : 0,
      autocontinue: item.autocontinue ? 1 : 0,
      param1,
      param2,
      param3,
      param4,
      x,
      y,
      z,
      missionType: 0,
    });
  }

  return compiled;
}
