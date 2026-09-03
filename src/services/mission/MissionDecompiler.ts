function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 11);
}
import { MAV_CMD, MAV_FRAME, getCommandDefinition } from './MissionCommandRegistry';
import { MissionEditorItem, MissionItemInt } from './MissionTypes';

/**
 * Decompiles wire-protocol MissionItemInt array downloaded from vehicle into
 * high-level MissionEditorItem array suitable for editing in the GCS UI.
 */
export function decompileMission(rawItems: MissionItemInt[]): MissionEditorItem[] {
  const editorItems: MissionEditorItem[] = [];
  let activeSpeed = 5;

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    const def = getCommandDefinition(raw.command);
    const id = generateId();

    // Track active speed if this item is a DO_CHANGE_SPEED
    if (raw.command === MAV_CMD.DO_CHANGE_SPEED) {
      const speedVal = raw.param2 > 0 ? raw.param2 : activeSpeed;
      activeSpeed = speedVal;

      editorItems.push({
        id,
        command: MAV_CMD.DO_CHANGE_SPEED,
        frame: raw.frame,
        speed: speedVal,
        param1: raw.param1, // Speed Type (0=Airspeed, 1=Groundspeed)
        param2: speedVal,
        param3: raw.param3,
        param4: raw.param4,
        autocontinue: raw.autocontinue === 1,
        isSpeedCommand: true,
        customLabel: `Change Speed (${speedVal} m/s)`,
      });
      continue;
    }

    // Geographic coordinates extraction
    const hasCoords = def.hasLocation && (raw.x !== 0 || raw.y !== 0);
    const lat = hasCoords ? raw.x / 1e7 : undefined;
    const lng = hasCoords ? raw.y / 1e7 : undefined;
    const alt = def.hasAltitude ? raw.z : undefined;

    // High-level delay / hold extraction
    let delay = 0;
    if (raw.command === MAV_CMD.NAV_WAYPOINT || raw.command === MAV_CMD.NAV_SPLINE_WAYPOINT) {
      delay = raw.param1;
    } else if (raw.command === MAV_CMD.NAV_LOITER_TIME) {
      delay = raw.param1;
    }

    editorItems.push({
      id,
      command: raw.command,
      frame: raw.frame,
      lat,
      lng,
      alt,
      speed: activeSpeed,
      delay,
      param1: raw.param1,
      param2: raw.param2,
      param3: raw.param3,
      param4: raw.param4,
      autocontinue: raw.autocontinue === 1,
      customLabel: def.label,
    });
  }

  return editorItems;
}
