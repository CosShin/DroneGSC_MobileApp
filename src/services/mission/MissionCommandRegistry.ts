/**
 * MAVLink Mission Protocol Constants and Command Registry
 * References:
 * - MAVLink Common Message Set (MISSION_ITEM_INT #73, MISSION_REQUEST_INT #51, MISSION_ACK #47)
 * - ArduPilot Copter MAVLink Mission Command Specifications
 */

// MAV_CMD Identification Codes
export const MAV_CMD = {
  NAV_WAYPOINT: 16,
  NAV_LOITER_UNLIM: 17,
  NAV_LOITER_TURNS: 18,
  NAV_LOITER_TIME: 19,
  NAV_RETURN_TO_LAUNCH: 20,
  NAV_LAND: 21,
  NAV_TAKEOFF: 22,
  NAV_SPLINE_WAYPOINT: 82,
  NAV_DELAY: 93,
  CONDITION_DELAY: 112,
  CONDITION_CHANGE_ALT: 113,
  CONDITION_DISTANCE: 114,
  CONDITION_YAW: 115,
  DO_SET_MODE: 176,
  DO_JUMP: 177,
  DO_CHANGE_SPEED: 178,
  DO_SET_HOME: 179,
  DO_SET_RELAY: 181,
  DO_SET_ROI: 201,
  DO_DIGICAM_CONTROL: 203,
  DO_MOUNT_CONTROL: 205,
  DO_WINCH: 42600,
} as const;

// MAV_FRAME Coordinate Frames
export const MAV_FRAME = {
  GLOBAL: 0, // Global coordinate frame, WGS84, MSL altitude
  LOCAL_NED: 1, // Local coordinate frame, Z-up
  MISSION: 2, // Non-coordinate mission command (e.g. DO_CHANGE_SPEED, CONDITION_YAW)
  GLOBAL_RELATIVE_ALT: 3, // Global coordinate frame, WGS84, relative altitude above home (Standard Copter default)
  LOCAL_ENU: 4,
  GLOBAL_INT: 5, // Global int32 (*1e7) coordinate frame, MSL altitude
  GLOBAL_RELATIVE_ALT_INT: 6, // Global int32 (*1e7) coordinate frame, relative altitude
  LOCAL_OFFSET_NED: 7,
  GLOBAL_TERRAIN_ALT: 10, // Global coordinate frame, altitude above terrain
  GLOBAL_TERRAIN_ALT_INT: 11, // Global int32 (*1e7) coordinate frame, altitude above terrain
} as const;

// MAV_MISSION_RESULT (ACK Codes)
export const MAV_MISSION_RESULT = {
  ACCEPTED: 0,
  ERROR: 1,
  UNSUPPORTED_FRAME: 2,
  UNSUPPORTED: 3,
  NO_SPACE: 4,
  INVALID: 5,
  INVALID_PARAM1: 6,
  INVALID_PARAM2: 7,
  INVALID_PARAM3: 8,
  INVALID_PARAM4: 9,
  INVALID_PARAM5_X: 10,
  INVALID_PARAM6_Y: 11,
  INVALID_PARAM7_Z: 12,
  INVALID_SEQUENCE: 13,
  DENIED: 14,
  OPERATION_CANCELLED: 15,
} as const;

export const MISSION_ACK_MESSAGES: Record<number, string> = {
  0: 'Mission accepted by autopilot',
  1: 'Generic mission error',
  2: 'Coordinate frame is unsupported by autopilot',
  3: 'Command is unsupported by autopilot',
  4: 'Autopilot mission storage is full (No space)',
  5: 'One or more mission parameters are invalid',
  6: 'Invalid Param 1',
  7: 'Invalid Param 2',
  8: 'Invalid Param 3',
  9: 'Invalid Param 4',
  10: 'Invalid Latitude (Param 5 / X)',
  11: 'Invalid Longitude (Param 6 / Y)',
  12: 'Invalid Altitude (Param 7 / Z)',
  13: 'Mission sequence mismatch / missing items',
  14: 'Mission transfer denied by autopilot safety check',
  15: 'Mission transaction was cancelled',
};

// Parameter metadata definition
export interface CommandParamDef {
  index: 1 | 2 | 3 | 4;
  label: string;
  unit?: string;
  defaultValue: number;
  description: string;
  min?: number;
  max?: number;
  step?: number;
}

// Complete metadata definition for a MAVLink mission command
export interface CommandDefinition {
  id: number;
  name: string;
  label: string;
  category: 'NAVIGATION' | 'DO' | 'CONDITION' | 'OTHER';
  hasLocation: boolean;
  hasAltitude: boolean;
  defaultFrame: number;
  defaultAltitude?: number;
  params: CommandParamDef[];
  description: string;
}

export const COMMAND_REGISTRY: Record<number, CommandDefinition> = {
  [MAV_CMD.NAV_WAYPOINT]: {
    id: MAV_CMD.NAV_WAYPOINT,
    name: 'NAV_WAYPOINT',
    label: 'Waypoint',
    category: 'NAVIGATION',
    hasLocation: true,
    hasAltitude: true,
    defaultFrame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    defaultAltitude: 50,
    description: 'Fly to the specified waypoint coordinates and altitude.',
    params: [
      { index: 1, label: 'Hold Time', unit: 's', defaultValue: 0, min: 0, max: 3600, step: 1, description: 'Time to hold at waypoint before proceeding.' },
      { index: 2, label: 'Accept Radius', unit: 'm', defaultValue: 0, min: 0, max: 100, step: 1, description: 'Acceptance radius (0 = autopilot default).' },
      { index: 3, label: 'Pass Radius', unit: 'm', defaultValue: 0, min: 0, max: 100, step: 1, description: '0 to pass through, >0 for orbit trajectory.' },
      { index: 4, label: 'Yaw Angle', unit: 'deg', defaultValue: 0, min: 0, max: 360, step: 5, description: 'Desired yaw orientation at waypoint (NaN/0 = unchanged).' },
    ],
  },
  [MAV_CMD.NAV_SPLINE_WAYPOINT]: {
    id: MAV_CMD.NAV_SPLINE_WAYPOINT,
    name: 'NAV_SPLINE_WAYPOINT',
    label: 'Spline Waypoint',
    category: 'NAVIGATION',
    hasLocation: true,
    hasAltitude: true,
    defaultFrame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    defaultAltitude: 50,
    description: 'Fly to waypoint with smooth curved spline path interpolation.',
    params: [
      { index: 1, label: 'Hold Time', unit: 's', defaultValue: 0, min: 0, max: 3600, step: 1, description: 'Time to hold at waypoint.' },
      { index: 2, label: 'Empty', unit: '', defaultValue: 0, description: 'Reserved' },
      { index: 3, label: 'Empty', unit: '', defaultValue: 0, description: 'Reserved' },
      { index: 4, label: 'Empty', unit: '', defaultValue: 0, description: 'Reserved' },
    ],
  },
  [MAV_CMD.NAV_TAKEOFF]: {
    id: MAV_CMD.NAV_TAKEOFF,
    name: 'NAV_TAKEOFF',
    label: 'Takeoff',
    category: 'NAVIGATION',
    hasLocation: true,
    hasAltitude: true,
    defaultFrame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    defaultAltitude: 15,
    description: 'Ascend straight up to the target altitude.',
    params: [
      { index: 1, label: 'Min Pitch', unit: 'deg', defaultValue: 0, min: 0, max: 45, step: 1, description: 'Minimum pitch (for fixed-wing, 0 for copter).' },
      { index: 2, label: 'Empty', unit: '', defaultValue: 0, description: 'Reserved' },
      { index: 3, label: 'Empty', unit: '', defaultValue: 0, description: 'Reserved' },
      { index: 4, label: 'Yaw Angle', unit: 'deg', defaultValue: 0, min: 0, max: 360, step: 5, description: 'Desired yaw orientation during ascent.' },
    ],
  },
  [MAV_CMD.NAV_LAND]: {
    id: MAV_CMD.NAV_LAND,
    name: 'NAV_LAND',
    label: 'Land',
    category: 'NAVIGATION',
    hasLocation: true,
    hasAltitude: true,
    defaultFrame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    defaultAltitude: 0,
    description: 'Descend vertically and land at the designated landing coordinates.',
    params: [
      { index: 1, label: 'Abort Alt', unit: 'm', defaultValue: 0, min: 0, max: 100, step: 1, description: 'Minimum altitude to abort landing if needed.' },
      { index: 2, label: 'Precision Mode', unit: '', defaultValue: 0, min: 0, max: 2, step: 1, description: '0=Normal, 1=Opportunistic, 2=Required.' },
      { index: 3, label: 'Empty', unit: '', defaultValue: 0, description: 'Reserved' },
      { index: 4, label: 'Yaw Angle', unit: 'deg', defaultValue: 0, min: 0, max: 360, step: 5, description: 'Desired yaw orientation during descent.' },
    ],
  },
  [MAV_CMD.NAV_RETURN_TO_LAUNCH]: {
    id: MAV_CMD.NAV_RETURN_TO_LAUNCH,
    name: 'NAV_RETURN_TO_LAUNCH',
    label: 'Return to Launch (RTL)',
    category: 'NAVIGATION',
    hasLocation: false,
    hasAltitude: false,
    defaultFrame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    description: 'Return to the home position and land automatically.',
    params: [],
  },
  [MAV_CMD.NAV_LOITER_TIME]: {
    id: MAV_CMD.NAV_LOITER_TIME,
    name: 'NAV_LOITER_TIME',
    label: 'Loiter Time',
    category: 'NAVIGATION',
    hasLocation: true,
    hasAltitude: true,
    defaultFrame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    defaultAltitude: 50,
    description: 'Hold position at waypoint coordinates for the specified duration.',
    params: [
      { index: 1, label: 'Loiter Time', unit: 's', defaultValue: 10, min: 1, max: 3600, step: 1, description: 'Time to loiter in seconds.' },
      { index: 2, label: 'Heading Mode', unit: '', defaultValue: 0, min: 0, max: 1, step: 1, description: '0=Head to next, 1=Face center.' },
      { index: 3, label: 'Radius', unit: 'm', defaultValue: 0, min: -100, max: 100, step: 1, description: 'Loiter radius (m). Negative for CCW.' },
      { index: 4, label: 'Forward/CW', unit: '', defaultValue: 0, min: 0, max: 1, step: 1, description: '0=Exit towards next, 1=CW turn.' },
    ],
  },
  [MAV_CMD.NAV_LOITER_TURNS]: {
    id: MAV_CMD.NAV_LOITER_TURNS,
    name: 'NAV_LOITER_TURNS',
    label: 'Loiter Turns',
    category: 'NAVIGATION',
    hasLocation: true,
    hasAltitude: true,
    defaultFrame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    defaultAltitude: 50,
    description: 'Circle around waypoint for a specified number of turns.',
    params: [
      { index: 1, label: 'Turns', unit: '', defaultValue: 1, min: 1, max: 50, step: 1, description: 'Number of complete circle turns.' },
      { index: 2, label: 'Heading Mode', unit: '', defaultValue: 0, min: 0, max: 1, step: 1, description: '0=Head to next, 1=Face center.' },
      { index: 3, label: 'Radius', unit: 'm', defaultValue: 10, min: -100, max: 100, step: 1, description: 'Circle radius in meters.' },
      { index: 4, label: 'Yaw Exit', unit: 'deg', defaultValue: 0, min: 0, max: 360, step: 5, description: 'Exit yaw angle.' },
    ],
  },
  [MAV_CMD.NAV_LOITER_UNLIM]: {
    id: MAV_CMD.NAV_LOITER_UNLIM,
    name: 'NAV_LOITER_UNLIM',
    label: 'Loiter Unlimited',
    category: 'NAVIGATION',
    hasLocation: true,
    hasAltitude: true,
    defaultFrame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    defaultAltitude: 50,
    description: 'Loiter indefinitely at waypoint until pilot intervention.',
    params: [
      { index: 1, label: 'Empty', unit: '', defaultValue: 0, description: 'Reserved' },
      { index: 2, label: 'Empty', unit: '', defaultValue: 0, description: 'Reserved' },
      { index: 3, label: 'Radius', unit: 'm', defaultValue: 0, min: -100, max: 100, step: 1, description: 'Loiter radius.' },
      { index: 4, label: 'Yaw Angle', unit: 'deg', defaultValue: 0, min: 0, max: 360, step: 5, description: 'Desired yaw angle.' },
    ],
  },
  [MAV_CMD.NAV_DELAY]: {
    id: MAV_CMD.NAV_DELAY,
    name: 'NAV_DELAY',
    label: 'Delay Navigation',
    category: 'NAVIGATION',
    hasLocation: false,
    hasAltitude: false,
    defaultFrame: MAV_FRAME.MISSION,
    description: 'Delay navigation progression for the given seconds or until UTC time.',
    params: [
      { index: 1, label: 'Delay Time', unit: 's', defaultValue: 5, min: 0, max: 3600, step: 1, description: 'Delay in seconds.' },
      { index: 2, label: 'Hour UTC', unit: 'h', defaultValue: -1, min: -1, max: 23, step: 1, description: 'UTC Hour (-1 to ignore).' },
      { index: 3, label: 'Min UTC', unit: 'm', defaultValue: -1, min: -1, max: 59, step: 1, description: 'UTC Minute (-1 to ignore).' },
      { index: 4, label: 'Sec UTC', unit: 's', defaultValue: -1, min: -1, max: 59, step: 1, description: 'UTC Second (-1 to ignore).' },
    ],
  },
  [MAV_CMD.DO_CHANGE_SPEED]: {
    id: MAV_CMD.DO_CHANGE_SPEED,
    name: 'DO_CHANGE_SPEED',
    label: 'Change Speed',
    category: 'DO',
    hasLocation: false,
    hasAltitude: false,
    defaultFrame: MAV_FRAME.MISSION,
    description: 'Set target flight speed for subsequent mission legs.',
    params: [
      { index: 1, label: 'Speed Type', unit: '', defaultValue: 1, min: 0, max: 3, step: 1, description: '0=Airspeed, 1=Groundspeed, 2=Climb, 3=Descent.' },
      { index: 2, label: 'Target Speed', unit: 'm/s', defaultValue: 5, min: 0.5, max: 30, step: 0.5, description: 'Target speed in m/s (-1 = no change).' },
      { index: 3, label: 'Throttle', unit: '%', defaultValue: -1, min: -1, max: 100, step: 1, description: 'Throttle percentage (-1 = no change).' },
      { index: 4, label: 'Relative', unit: '', defaultValue: 0, min: 0, max: 1, step: 1, description: '0=Absolute speed, 1=Relative change.' },
    ],
  },
  [MAV_CMD.CONDITION_YAW]: {
    id: MAV_CMD.CONDITION_YAW,
    name: 'CONDITION_YAW',
    label: 'Condition Yaw',
    category: 'CONDITION',
    hasLocation: false,
    hasAltitude: false,
    defaultFrame: MAV_FRAME.MISSION,
    description: 'Rotate the vehicle to a target heading.',
    params: [
      { index: 1, label: 'Target Angle', unit: 'deg', defaultValue: 0, min: 0, max: 360, step: 5, description: 'Target heading angle (0-360 deg).' },
      { index: 2, label: 'Angular Speed', unit: 'deg/s', defaultValue: 20, min: 1, max: 90, step: 1, description: 'Yaw rate speed in deg/sec.' },
      { index: 3, label: 'Direction', unit: '', defaultValue: 1, min: -1, max: 1, step: 2, description: '-1=CCW, 1=CW.' },
      { index: 4, label: 'Relative', unit: '', defaultValue: 0, min: 0, max: 1, step: 1, description: '0=Absolute heading, 1=Relative to current.' },
    ],
  },
  [MAV_CMD.DO_SET_ROI]: {
    id: MAV_CMD.DO_SET_ROI,
    name: 'DO_SET_ROI',
    label: 'Set Region of Interest (ROI)',
    category: 'DO',
    hasLocation: true,
    hasAltitude: true,
    defaultFrame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    defaultAltitude: 0,
    description: 'Point the camera/vehicle towards a Region of Interest coordinate.',
    params: [
      { index: 1, label: 'ROI Mode', unit: '', defaultValue: 0, min: 0, max: 3, step: 1, description: '0=None, 1=Next WP, 2=Mission Item, 3=Location.' },
      { index: 2, label: 'WP Index', unit: '', defaultValue: 0, min: 0, max: 500, step: 1, description: 'Mission item index (if mode=2).' },
      { index: 3, label: 'ROI ID', unit: '', defaultValue: 0, description: 'ROI ID' },
      { index: 4, label: 'Empty', unit: '', defaultValue: 0, description: 'Reserved' },
    ],
  },
};

/**
 * Returns command definition from registry or generates a fallback for unknown MAV_CMD
 */
export function getCommandDefinition(commandId: number): CommandDefinition {
  if (COMMAND_REGISTRY[commandId]) {
    return COMMAND_REGISTRY[commandId];
  }
  return {
    id: commandId,
    name: `MAV_CMD_${commandId}`,
    label: `Custom Command (${commandId})`,
    category: 'OTHER',
    hasLocation: true,
    hasAltitude: true,
    defaultFrame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    description: `Raw MAVLink command ID ${commandId}`,
    params: [
      { index: 1, label: 'Param 1', defaultValue: 0, description: 'Raw Parameter 1' },
      { index: 2, label: 'Param 2', defaultValue: 0, description: 'Raw Parameter 2' },
      { index: 3, label: 'Param 3', defaultValue: 0, description: 'Raw Parameter 3' },
      { index: 4, label: 'Param 4', defaultValue: 0, description: 'Raw Parameter 4' },
    ],
  };
}

export function getFrameLabel(frameId: number): string {
  switch (frameId) {
    case MAV_FRAME.GLOBAL:
      return 'Global (MSL)';
    case MAV_FRAME.GLOBAL_RELATIVE_ALT:
    case MAV_FRAME.GLOBAL_RELATIVE_ALT_INT:
      return 'Rel to Home';
    case MAV_FRAME.GLOBAL_TERRAIN_ALT:
    case MAV_FRAME.GLOBAL_TERRAIN_ALT_INT:
      return 'Above Terrain';
    case MAV_FRAME.MISSION:
      return 'Mission Action';
    default:
      return `Frame ${frameId}`;
  }
}
