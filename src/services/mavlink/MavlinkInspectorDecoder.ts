import type { MavlinkPacketEvent } from './MavlinkManager';
import { getArduCopterModeName } from './ArduPilotModes';
import { MAVLINK_MESSAGE_NAMES } from './MavlinkMessageNames';

export type MavlinkPacketCategory = 'HEARTBEAT' | 'TELEMETRY' | 'COMMAND' | 'MISSION' | 'PARAM' | 'SENSOR' | 'ERROR';

export interface InspectorField {
  label: string;
  value: string;
}

export interface InspectorPacket {
  id: string;
  direction: 'RX' | 'TX';
  timestamp: number;
  sessionId: number;
  version: 1 | 2;
  sequence: number;
  systemId: number;
  componentId: number;
  messageId: number;
  messageName: string;
  category: MavlinkPacketCategory;
  payloadSize: number;
  summary: string | null;
  fields: InspectorField[];
  rawHex: string | null;
  crc: 'VALID';
}

const MESSAGE_NAMES: Record<number, string> = {
  0: 'HEARTBEAT',
  1: 'SYS_STATUS',
  2: 'SYSTEM_TIME',
  4: 'PING',
  11: 'SET_MODE',
  20: 'PARAM_REQUEST_READ',
  21: 'PARAM_REQUEST_LIST',
  22: 'PARAM_VALUE',
  23: 'PARAM_SET',
  24: 'GPS_RAW_INT',
  25: 'GPS_STATUS',
  26: 'SCALED_IMU',
  27: 'RAW_IMU',
  28: 'RAW_PRESSURE',
  29: 'SCALED_PRESSURE',
  30: 'ATTITUDE',
  31: 'ATTITUDE_QUATERNION',
  32: 'LOCAL_POSITION_NED',
  33: 'GLOBAL_POSITION_INT',
  34: 'RC_CHANNELS_SCALED',
  35: 'RC_CHANNELS_RAW',
  36: 'SERVO_OUTPUT_RAW',
  39: 'MISSION_ITEM',
  40: 'MISSION_REQUEST',
  42: 'MISSION_CURRENT',
  43: 'MISSION_REQUEST_LIST',
  44: 'MISSION_COUNT',
  45: 'MISSION_CLEAR_ALL',
  46: 'MISSION_ITEM_REACHED',
  47: 'MISSION_ACK',
  51: 'MISSION_REQUEST_INT',
  62: 'NAV_CONTROLLER_OUTPUT',
  65: 'RC_CHANNELS',
  66: 'REQUEST_DATA_STREAM',
  69: 'MANUAL_CONTROL',
  70: 'RC_CHANNELS_OVERRIDE',
  73: 'MISSION_ITEM_INT',
  74: 'VFR_HUD',
  75: 'COMMAND_INT',
  76: 'COMMAND_LONG',
  77: 'COMMAND_ACK',
  83: 'ATTITUDE_TARGET',
  84: 'POSITION_TARGET_LOCAL_NED',
  87: 'POSITION_TARGET_GLOBAL_INT',
  100: 'OPTICAL_FLOW',
  105: 'HIGHRES_IMU',
  108: 'SIM_STATE',
  111: 'TIMESYNC',
  116: 'SCALED_IMU2',
  125: 'POWER_STATUS',
  129: 'SCALED_IMU3',
  132: 'DISTANCE_SENSOR',
  133: 'TERRAIN_REQUEST',
  134: 'TERRAIN_DATA',
  135: 'TERRAIN_CHECK',
  136: 'TERRAIN_REPORT',
  141: 'ALTITUDE',
  147: 'BATTERY_STATUS',
  148: 'AUTOPILOT_VERSION',
  149: 'LANDING_TARGET',
  162: 'FENCE_STATUS',
  168: 'WIND_COV',
  230: 'ESTIMATOR_STATUS',
  231: 'WIND_COV',
  241: 'VIBRATION',
  242: 'HOME_POSITION',
  245: 'EXTENDED_SYS_STATE',
  253: 'STATUSTEXT',
  300: 'PROTOCOL_VERSION',
};

const COMMAND_NAMES: Record<number, string> = {
  20: 'MAV_CMD_NAV_RETURN_TO_LAUNCH',
  21: 'MAV_CMD_NAV_LAND',
  22: 'MAV_CMD_NAV_TAKEOFF',
  176: 'MAV_CMD_DO_SET_MODE',
  178: 'MAV_CMD_DO_CHANGE_SPEED',
  400: 'MAV_CMD_COMPONENT_ARM_DISARM',
  511: 'MAV_CMD_SET_MESSAGE_INTERVAL',
};

const RESULT_NAMES: Record<number, string> = {
  0: 'MAV_RESULT_ACCEPTED',
  1: 'MAV_RESULT_TEMPORARILY_REJECTED',
  2: 'MAV_RESULT_DENIED',
  3: 'MAV_RESULT_UNSUPPORTED',
  4: 'MAV_RESULT_FAILED',
  5: 'MAV_RESULT_IN_PROGRESS',
  6: 'MAV_RESULT_CANCELLED',
  7: 'MAV_RESULT_COMMAND_LONG_ONLY',
  8: 'MAV_RESULT_COMMAND_INT_ONLY',
  9: 'MAV_RESULT_COMMAND_UNSUPPORTED_MAV_FRAME',
  10: 'MAV_RESULT_NOT_IN_CONTROL',
};

const SEVERITY_NAMES: Record<number, string> = {
  0: 'EMERGENCY',
  1: 'ALERT',
  2: 'CRITICAL',
  3: 'ERROR',
  4: 'WARNING',
  5: 'NOTICE',
  6: 'INFO',
  7: 'DEBUG',
};

const SENSOR_ORIENTATION_NAMES: Record<number, string> = {
  0: 'ROTATION_NONE (FORWARD)',
  1: 'ROTATION_YAW_45',
  2: 'ROTATION_YAW_90',
  3: 'ROTATION_YAW_135',
  4: 'ROTATION_YAW_180 (BACK)',
  5: 'ROTATION_YAW_225',
  6: 'ROTATION_YAW_270',
  7: 'ROTATION_YAW_315',
  24: 'ROTATION_PITCH_90 (UP)',
  25: 'ROTATION_PITCH_270 (DOWN)',
};

const SENSOR_TYPE_NAMES: Record<number, string> = {
  0: 'LASER',
  1: 'ULTRASOUND',
  2: 'INFRARED',
  3: 'RADAR',
  4: 'UNKNOWN',
};

const LANDED_STATE_NAMES: Record<number, string> = {
  0: 'UNDEFINED',
  1: 'ON_GROUND',
  2: 'IN_AIR',
  3: 'TAKEOFF',
  4: 'LANDING',
};

export function getMavlinkMessageName(messageId: number) {
  return MAVLINK_MESSAGE_NAMES[messageId] ?? MESSAGE_NAMES[messageId] ?? `MSG_${messageId}`;
}

export function getMavlinkPacketCategory(messageId: number): MavlinkPacketCategory {
  if (messageId === 0) return 'HEARTBEAT';
  if ([11, 69, 70, 75, 76, 77, 83, 84, 87].includes(messageId)) return 'COMMAND';
  if ([39, 40, 42, 43, 44, 45, 46, 47, 51, 73].includes(messageId)) return 'MISSION';
  if ([20, 21, 22, 23].includes(messageId)) return 'PARAM';
  if (messageId === 253) return 'ERROR';
  if ([1, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 62, 65, 74, 100, 105, 111, 116, 125, 129, 132, 136, 141, 147, 230, 241, 242, 245].includes(messageId)) return 'SENSOR';
  return 'TELEMETRY';
}

export function decodeInspectorPacket(event: MavlinkPacketEvent, ordinal: number): InspectorPacket {
  const { frame } = event;
  const messageName = getMavlinkMessageName(frame.messageId);
  const fields = decodeFields(frame.messageId, frame.payload, frame.systemId, frame.componentId, frame.version);
  return {
    id: `${event.sessionId}-${event.timestamp}-${event.direction}-${frame.sequence}-${ordinal}`,
    direction: event.direction,
    timestamp: event.timestamp,
    sessionId: event.sessionId,
    version: frame.version,
    sequence: frame.sequence,
    systemId: frame.systemId,
    componentId: frame.componentId,
    messageId: frame.messageId,
    messageName,
    category: getMavlinkPacketCategory(frame.messageId),
    payloadSize: frame.payload.byteLength,
    summary: summarize(frame.messageId, fields),
    fields,
    rawHex: frame.rawFrame ? Array.from(frame.rawFrame, byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ') : null,
    crc: 'VALID',
  };
}

function field(label: string, value: unknown, unit = ''): InspectorField {
  return { label, value: value === null || value === undefined ? '--' : `${value}${unit}` };
}

function decodeString(payload: Uint8Array, offset: number, maxLength: number): string {
  let end = offset;
  const limit = Math.min(payload.byteLength, offset + maxLength);
  while (end < limit && payload[end] !== 0) {
    end++;
  }
  const slice = payload.subarray(offset, end);
  return String.fromCharCode(...slice).trim();
}

function decodeFields(
  messageId: number,
  payload: Uint8Array,
  systemId: number,
  componentId: number,
  version: 1 | 2,
): InspectorField[] {
  const wirePayload = payload;
  const wireLength = payload.byteLength;
  // MAVLink 2 removes zero-filled bytes from the end of a payload. Generated
  // dialect decoders restore those bytes before reading fields; mirror that
  // behavior here so a valid, truncated frame is still inspectable.
  if (version === 2 && wireLength > 0 && wireLength < 255) {
    const padded = new Uint8Array(255);
    padded.set(payload);
    payload = padded;
  }
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const fields: InspectorField[] = [field('SYSID', systemId), field('COMPID', componentId)];
  const has = (length: number) => wireLength >= length || (version === 2 && wireLength > 0);
  const fixed = (value: number, digits = 3) => Number.isFinite(value) ? value.toFixed(digits) : '--';
  const radToDeg = (rad: number) => Number.isFinite(rad) ? (rad * (180 / Math.PI)).toFixed(1) : '--';
  const uint64 = (offset: number) => {
    const low = BigInt(view.getUint32(offset, true));
    const high = BigInt(view.getUint32(offset + 4, true));
    return ((high << 32n) | low).toString();
  };
  const int64 = (offset: number) => {
    const low = BigInt(view.getUint32(offset, true));
    const high = BigInt(view.getInt32(offset + 4, true));
    return ((high << 32n) | low).toString();
  };

  try {
    if (messageId === 0 && has(9)) {
      // HEARTBEAT
      const customMode = view.getUint32(0, true);
      fields.push(
        field('custom_mode', customMode),
        field('flight_mode', getArduCopterModeName(customMode)),
        field('type', payload[4]),
        field('autopilot', payload[5]),
        field('base_mode', payload[6]),
        field('system_status', payload[7]),
        field('mavlink_version', payload[8]),
      );
    } else if (messageId === 1 && has(19)) {
      // SYS_STATUS
      const voltage = view.getUint16(14, true);
      const current = view.getInt16(16, true);
      const remaining = view.getInt8(18);
      fields.push(
        field('sensors_present', `0x${view.getUint32(0, true).toString(16).toUpperCase()}`),
        field('sensors_enabled', `0x${view.getUint32(4, true).toString(16).toUpperCase()}`),
        field('sensors_health', `0x${view.getUint32(8, true).toString(16).toUpperCase()}`),
        field('load', fixed(view.getUint16(12, true) / 10, 1), '%'),
        field('voltage_battery', voltage === 0 || voltage === 65535 ? null : fixed(voltage / 1000, 2), ' V'),
        field('current_battery', current === -1 ? null : fixed(current / 100, 2), ' A'),
        field('battery_remaining', remaining < 0 ? null : remaining, '%'),
      );
      if (has(23)) {
        fields.push(
          field('drop_rate_comm', fixed(view.getUint16(19, true) / 100, 2), '%'),
          field('errors_comm', view.getUint16(21, true)),
        );
      }
    } else if (messageId === 2 && has(12)) {
      // SYSTEM_TIME
      fields.push(
        field('time_unix_usec', uint64(0), ' us'),
        field('time_boot_ms', view.getUint32(8, true), ' ms'),
      );
    } else if (messageId === 20 && has(4)) {
      // PARAM_REQUEST_READ
      fields.push(
        field('param_index', view.getInt16(0, true)),
        field('target_system', payload[2]),
        field('target_component', payload[3]),
      );
      if (has(20)) {
        fields.push(field('param_id', decodeString(payload, 4, 16)));
      }
    } else if (messageId === 22 && has(25)) {
      // PARAM_VALUE
      fields.push(
        field('param_id', decodeString(payload, 8, 16)),
        field('param_value', fixed(view.getFloat32(0, true), 4)),
        field('param_type', payload[24]),
        field('param_count', view.getUint16(4, true)),
        field('param_index', view.getUint16(6, true)),
      );
    } else if (messageId === 23 && has(23)) {
      // PARAM_SET
      fields.push(
        field('param_id', decodeString(payload, 6, 16)),
        field('param_value', fixed(view.getFloat32(0, true), 4)),
        field('param_type', payload[22]),
        field('target_system', payload[4]),
        field('target_component', payload[5]),
      );
    } else if (messageId === 24 && has(30)) {
      // GPS_RAW_INT
      fields.push(
        field('fix_type', payload[28]),
        field('satellites_visible', payload[29]),
        field('lat', fixed(view.getInt32(8, true) / 1e7, 7), '°'),
        field('lon', fixed(view.getInt32(12, true) / 1e7, 7), '°'),
        field('alt', fixed(view.getInt32(16, true) / 1000, 2), ' m'),
        field('eph (hdop)', fixed(view.getUint16(20, true) / 100, 2)),
        field('epv (vdop)', fixed(view.getUint16(22, true) / 100, 2)),
        field('vel', fixed(view.getUint16(24, true) / 100, 2), ' m/s'),
        field('cog', fixed(view.getUint16(26, true) / 100, 2), '°'),
      );
    } else if ((messageId === 26 || messageId === 116 || messageId === 129) && has(22)) {
      // SCALED_IMU / SCALED_IMU2 / SCALED_IMU3
      fields.push(
        field('time_boot_ms', view.getUint32(0, true), ' ms'),
        field('xacc', view.getInt16(4, true), ' mg'),
        field('yacc', view.getInt16(6, true), ' mg'),
        field('zacc', view.getInt16(8, true), ' mg'),
        field('xgyro', view.getInt16(10, true), ' mrad/s'),
        field('ygyro', view.getInt16(12, true), ' mrad/s'),
        field('zgyro', view.getInt16(14, true), ' mrad/s'),
        field('xmag', view.getInt16(16, true), ' mgauss'),
        field('ymag', view.getInt16(18, true), ' mgauss'),
        field('zmag', view.getInt16(20, true), ' mgauss'),
      );
      if (has(24)) {
        fields.push(field('temperature', fixed(view.getInt16(22, true) / 100, 1), ' °C'));
      }
    } else if (messageId === 29 && has(14)) {
      // SCALED_PRESSURE
      fields.push(
        field('time_boot_ms', view.getUint32(0, true), ' ms'),
        field('press_abs', fixed(view.getFloat32(4, true), 2), ' hPa'),
        field('press_diff', fixed(view.getFloat32(8, true), 2), ' hPa'),
        field('temperature', fixed(view.getInt16(12, true) / 100, 1), ' °C'),
      );
    } else if (messageId === 30 && has(28)) {
      // ATTITUDE
      const r = view.getFloat32(4, true);
      const p = view.getFloat32(8, true);
      const y = view.getFloat32(12, true);
      fields.push(
        field('time_boot_ms', view.getUint32(0, true), ' ms'),
        field('roll', `${fixed(r, 3)} rad (${radToDeg(r)}°)`),
        field('pitch', `${fixed(p, 3)} rad (${radToDeg(p)}°)`),
        field('yaw', `${fixed(y, 3)} rad (${radToDeg(y)}°)`),
        field('rollspeed', fixed(view.getFloat32(16, true)), ' rad/s'),
        field('pitchspeed', fixed(view.getFloat32(20, true)), ' rad/s'),
        field('yawspeed', fixed(view.getFloat32(24, true)), ' rad/s'),
      );
    } else if (messageId === 32 && has(28)) {
      // LOCAL_POSITION_NED
      fields.push(
        field('time_boot_ms', view.getUint32(0, true), ' ms'),
        field('x', fixed(view.getFloat32(4, true), 2), ' m'),
        field('y', fixed(view.getFloat32(8, true), 2), ' m'),
        field('z', fixed(view.getFloat32(12, true), 2), ' m'),
        field('vx', fixed(view.getFloat32(16, true), 2), ' m/s'),
        field('vy', fixed(view.getFloat32(20, true), 2), ' m/s'),
        field('vz', fixed(view.getFloat32(24, true), 2), ' m/s'),
      );
    } else if (messageId === 33 && has(28)) {
      // GLOBAL_POSITION_INT
      fields.push(
        field('time_boot_ms', view.getUint32(0, true), ' ms'),
        field('lat', fixed(view.getInt32(4, true) / 1e7, 7), '°'),
        field('lon', fixed(view.getInt32(8, true) / 1e7, 7), '°'),
        field('alt (MSL)', fixed(view.getInt32(12, true) / 1000, 2), ' m'),
        field('relative_alt', fixed(view.getInt32(16, true) / 1000, 2), ' m'),
        field('vx', fixed(view.getInt16(20, true) / 100, 2), ' m/s'),
        field('vy', fixed(view.getInt16(22, true) / 100, 2), ' m/s'),
        field('vz', fixed(view.getInt16(24, true) / 100, 2), ' m/s'),
        field('heading', fixed(view.getUint16(26, true) / 100, 1), '°'),
      );
    } else if (messageId === 35 && has(22)) {
      // RC_CHANNELS_RAW
      fields.push(
        field('time_boot_ms', view.getUint32(0, true), ' ms'),
        field('port', payload[20]),
        field('rssi', payload[21]),
      );
      for (let i = 0; i < 8; i++) {
        fields.push(field(`chan${i + 1}_raw`, view.getUint16(4 + i * 2, true), ' µs'));
      }
    } else if (messageId === 36 && has(21)) {
      // SERVO_OUTPUT_RAW
      fields.push(
        field('time_usec', view.getUint32(0, true), ' µs'),
        field('port', payload[20]),
      );
      for (let i = 0; i < 8; i++) {
        fields.push(field(`servo${i + 1}_raw`, view.getUint16(4 + i * 2, true), ' µs'));
      }
    } else if ([39, 73].includes(messageId) && has(37)) {
      // MISSION_ITEM / MISSION_ITEM_INT
      const isInt = messageId === 73;
      fields.push(
        field('seq', view.getUint16(28, true)),
        field('frame', payload[34]),
        field('command', view.getUint16(30, true)),
        field('current', payload[35]),
        field('autocontinue', payload[36]),
        field('param1', fixed(view.getFloat32(0, true))),
        field('param2', fixed(view.getFloat32(4, true))),
        field('param3', fixed(view.getFloat32(8, true))),
        field('param4', fixed(view.getFloat32(12, true))),
        field('x', isInt ? view.getInt32(16, true) : fixed(view.getFloat32(16, true), 7)),
        field('y', isInt ? view.getInt32(20, true) : fixed(view.getFloat32(20, true), 7)),
        field('z', fixed(view.getFloat32(24, true), 2), ' m'),
      );
    } else if ([40, 44, 51].includes(messageId) && has(2)) {
      // MISSION_REQUEST / COUNT / REQUEST_INT
      fields.push(field(messageId === 44 ? 'count' : 'seq', view.getUint16(0, true)));
      if (has(4)) {
        fields.push(field('target_system', payload[2]), field('target_component', payload[3]));
      }
    } else if (messageId === 42 && has(2)) {
      // MISSION_CURRENT
      fields.push(field('seq', view.getUint16(0, true)));
    } else if (messageId === 46 && has(2)) {
      // MISSION_ITEM_REACHED
      fields.push(field('seq', view.getUint16(0, true)));
    } else if (messageId === 47 && has(3)) {
      // MISSION_ACK
      fields.push(field('type', payload[2]), field('mission_type', has(4) ? payload[3] : 0));
    } else if (messageId === 62 && has(26)) {
      // NAV_CONTROLLER_OUTPUT
      fields.push(
        field('nav_roll', fixed(view.getFloat32(0, true), 1), '°'),
        field('nav_pitch', fixed(view.getFloat32(4, true), 1), '°'),
        field('nav_bearing', view.getInt16(8, true), '°'),
        field('target_bearing', view.getInt16(10, true), '°'),
        field('wp_dist', view.getUint16(12, true), ' m'),
        field('alt_error', fixed(view.getFloat32(14, true), 2), ' m'),
        field('aspd_error', fixed(view.getFloat32(18, true), 2), ' m/s'),
        field('xtrack_error', fixed(view.getFloat32(22, true), 2), ' m'),
      );
    } else if (messageId === 65 && has(42)) {
      // RC_CHANNELS
      const chancount = payload[40];
      fields.push(
        field('time_boot_ms', view.getUint32(0, true), ' ms'),
        field('chancount', chancount),
        field('rssi', payload[41]),
      );
      const count = Math.min(chancount || 18, 18);
      for (let i = 0; i < count; i++) {
        const val = view.getUint16(4 + i * 2, true);
        if (val !== 65535 && val !== 0) {
          fields.push(field(`chan${i + 1}`, val, ' µs'));
        }
      }
    } else if (messageId === 69 && has(11)) {
      // MANUAL_CONTROL
      fields.push(
        field('x', view.getInt16(0, true)),
        field('y', view.getInt16(2, true)),
        field('z', view.getInt16(4, true)),
        field('r', view.getInt16(6, true)),
        field('buttons', `0x${view.getUint16(8, true).toString(16).toUpperCase()}`),
        field('target', payload[10]),
      );
    } else if (messageId === 70 && has(18)) {
      // RC_CHANNELS_OVERRIDE
      fields.push(
        field('target_system', payload[16]),
        field('target_component', payload[17]),
      );
      for (let i = 0; i < 8; i++) {
        fields.push(field(`chan${i + 1}_raw`, view.getUint16(i * 2, true), ' µs'));
      }
    } else if (messageId === 74 && has(20)) {
      // VFR_HUD
      fields.push(
        field('airspeed', fixed(view.getFloat32(0, true), 2), ' m/s'),
        field('groundspeed', fixed(view.getFloat32(4, true), 2), ' m/s'),
        field('heading', view.getInt16(8, true), '°'),
        field('throttle', view.getUint16(10, true), '%'),
        field('alt', fixed(view.getFloat32(12, true), 2), ' m'),
        field('climb', fixed(view.getFloat32(16, true), 2), ' m/s'),
      );
    } else if (messageId === 76 && has(33)) {
      // COMMAND_LONG
      const command = view.getUint16(28, true);
      fields.push(
        field('command', COMMAND_NAMES[command] ?? `MAV_CMD_${command}`),
        field('command_id', command),
      );
      for (let index = 0; index < 7; index++) {
        fields.push(field(`param${index + 1}`, fixed(view.getFloat32(index * 4, true))));
      }
      fields.push(
        field('target_system', payload[30]),
        field('target_component', payload[31]),
        field('confirmation', payload[32]),
      );
    } else if (messageId === 77 && has(3)) {
      // COMMAND_ACK
      const command = view.getUint16(0, true);
      const result = payload[2];
      fields.push(
        field('command', COMMAND_NAMES[command] ?? `MAV_CMD_${command}`),
        field('command_id', command),
        field('result', RESULT_NAMES[result] ?? `MAV_RESULT_${result}`),
        field('progress', has(4) && payload[3] !== 255 ? payload[3] : null),
        field('result_param2', has(8) ? view.getInt32(4, true) : null),
      );
    } else if (messageId === 100 && has(26)) {
      // OPTICAL_FLOW
      fields.push(
        field('quality', payload[25]),
        field('ground_distance', fixed(view.getFloat32(16, true), 2), ' m'),
        field('flow_comp_m_x', fixed(view.getFloat32(8, true), 3), ' m/s'),
        field('flow_comp_m_y', fixed(view.getFloat32(12, true), 3), ' m/s'),
        field('flow_x', view.getInt16(20, true), ' px'),
        field('flow_y', view.getInt16(22, true), ' px'),
        field('sensor_id', payload[24]),
      );
    } else if (messageId === 111 && has(16)) {
      // TIMESYNC
      fields.push(
        field('tc1', int64(0), ' ns'),
        field('ts1', int64(8), ' ns'),
      );
    } else if (messageId === 125 && has(6)) {
      // POWER_STATUS
      fields.push(
        field('Vcc', fixed(view.getUint16(0, true) / 1000, 2), ' V'),
        field('Vservo', fixed(view.getUint16(2, true) / 1000, 2), ' V'),
        field('flags', `0x${view.getUint16(4, true).toString(16).toUpperCase()}`),
      );
    } else if (messageId === 132 && has(14)) {
      // DISTANCE_SENSOR
      const currentDist = view.getUint16(8, true);
      const orientation = payload[12];
      const sensorType = payload[10];
      fields.push(
        field('time_boot_ms', view.getUint32(0, true), ' ms'),
        field('current_distance', fixed(currentDist / 100, 2), ' m'),
        field('min_distance', fixed(view.getUint16(4, true) / 100, 2), ' m'),
        field('max_distance', fixed(view.getUint16(6, true) / 100, 2), ' m'),
        field('type', SENSOR_TYPE_NAMES[sensorType] ?? sensorType),
        field('id', payload[11]),
        field('orientation', SENSOR_ORIENTATION_NAMES[orientation] ?? orientation),
        field('covariance', payload[13]),
      );
    } else if (messageId === 141 && has(32)) {
      // ALTITUDE
      fields.push(
        field('altitude_monotonic', fixed(view.getFloat32(8, true), 2), ' m'),
        field('altitude_amsl', fixed(view.getFloat32(12, true), 2), ' m'),
        field('altitude_local', fixed(view.getFloat32(16, true), 2), ' m'),
        field('altitude_relative', fixed(view.getFloat32(20, true), 2), ' m'),
        field('altitude_terrain', fixed(view.getFloat32(24, true), 2), ' m'),
        field('bottom_clearance', fixed(view.getFloat32(28, true), 2), ' m'),
      );
    } else if (messageId === 147 && has(36)) {
      // BATTERY_STATUS
      const temp = view.getInt16(8, true);
      const current = view.getInt16(30, true);
      const remaining = view.getInt8(35);
      const consumed = view.getInt32(0, true);
      const energy = view.getInt32(4, true);
      const cellMillivolts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const millivolts = view.getUint16(10 + i * 2, true);
        if (millivolts > 0 && millivolts !== 65535) cellMillivolts.push(millivolts);
      }
      const packMillivolts = cellMillivolts.reduce((total, value) => total + value, 0);
      fields.push(
        field('id', payload[32]),
        field('pack_voltage', packMillivolts > 0 ? fixed(packMillivolts / 1000, 3) : null, ' V'),
        field('current', current === -1 ? null : fixed(current / 100, 2), ' A'),
        field('remaining', remaining < 0 ? null : remaining, '%'),
        field('temperature', temp === 32767 ? null : fixed(temp / 100, 1), ' °C'),
        field('current_consumed', consumed < 0 ? null : consumed, ' mAh'),
        field('energy_consumed', energy < 0 ? null : energy, ' hJ'),
      );
      // Individual cell voltages
      for (let i = 0; i < 10; i++) {
        const v = view.getUint16(10 + i * 2, true);
        if (v !== 65535 && v !== 0) {
          fields.push(field(`cell_${i + 1}`, fixed(v / 1000, 3), ' V'));
        }
      }
    } else if (messageId === 148 && has(28)) {
      // AUTOPILOT_VERSION
      fields.push(
        field('capabilities', `0x${BigInt(uint64(0)).toString(16).toUpperCase()}`),
        field('flight_sw_version', `0x${view.getUint32(8, true).toString(16).toUpperCase()}`),
        field('middleware_sw_version', `0x${view.getUint32(12, true).toString(16).toUpperCase()}`),
        field('os_sw_version', `0x${view.getUint32(16, true).toString(16).toUpperCase()}`),
        field('board_version', `0x${view.getUint32(20, true).toString(16).toUpperCase()}`),
        field('vendor_id', view.getUint16(24, true)),
        field('product_id', view.getUint16(26, true)),
      );
    } else if (messageId === 149 && has(30)) {
      // LANDING_TARGET
      const angleX = view.getFloat32(8, true);
      const angleY = view.getFloat32(12, true);
      const distance = view.getFloat32(16, true);
      fields.push(
        field('target_num', payload[28]),
        field('frame', payload[29]),
        field('angle_x', radToDeg(angleX), '°'),
        field('angle_y', radToDeg(angleY), '°'),
        field('distance', fixed(distance, 2), ' m'),
        field('size_x', radToDeg(view.getFloat32(20, true)), '°'),
        field('size_y', radToDeg(view.getFloat32(24, true)), '°'),
      );
      if (has(42)) {
        fields.push(
          field('x', fixed(view.getFloat32(30, true), 2), ' m'),
          field('y', fixed(view.getFloat32(34, true), 2), ' m'),
          field('z', fixed(view.getFloat32(38, true), 2), ' m'),
        );
      }
    } else if (messageId === 230 && has(42)) {
      // ESTIMATOR_STATUS
      fields.push(
        field('time_usec', uint64(0), ' us'),
        field('flags', `0x${view.getUint16(40, true).toString(16).toUpperCase()}`),
        field('vel_ratio', fixed(view.getFloat32(8, true), 2)),
        field('pos_horiz_ratio', fixed(view.getFloat32(12, true), 2)),
        field('pos_vert_ratio', fixed(view.getFloat32(16, true), 2)),
        field('mag_ratio', fixed(view.getFloat32(20, true), 2)),
        field('hagl_ratio', fixed(view.getFloat32(24, true), 2)),
        field('tas_ratio', fixed(view.getFloat32(28, true), 2)),
        field('pos_horiz_accuracy', fixed(view.getFloat32(32, true), 2), ' m'),
        field('pos_vert_accuracy', fixed(view.getFloat32(36, true), 2), ' m'),
      );
    } else if (messageId === 241 && has(32)) {
      // VIBRATION
      fields.push(
        field('vibration_x', fixed(view.getFloat32(8, true), 2), ' m/s²'),
        field('vibration_y', fixed(view.getFloat32(12, true), 2), ' m/s²'),
        field('vibration_z', fixed(view.getFloat32(16, true), 2), ' m/s²'),
        field('clipping_0', view.getUint32(20, true)),
        field('clipping_1', view.getUint32(24, true)),
        field('clipping_2', view.getUint32(28, true)),
      );
    } else if (messageId === 242 && has(52)) {
      // HOME_POSITION
      fields.push(
        field('latitude', fixed(view.getInt32(0, true) / 1e7, 7), '°'),
        field('longitude', fixed(view.getInt32(4, true) / 1e7, 7), '°'),
        field('altitude', fixed(view.getInt32(8, true) / 1000, 2), ' m'),
        field('x', fixed(view.getFloat32(12, true), 2), ' m'),
        field('y', fixed(view.getFloat32(16, true), 2), ' m'),
        field('z', fixed(view.getFloat32(20, true), 2), ' m'),
      );
    } else if (messageId === 245 && has(2)) {
      // EXTENDED_SYS_STATE
      const landed = payload[1];
      fields.push(
        field('vtol_state', payload[0]),
        field('landed_state', LANDED_STATE_NAMES[landed] ?? landed),
      );
    } else if (messageId === 253 && has(2)) {
      // STATUSTEXT
      const severity = payload[0];
      const text = decodeString(payload, 1, 50);
      fields.push(
        field('severity', SEVERITY_NAMES[severity] ?? severity),
        field('text', text || '--'),
      );
    } else {
      // Fallback for custom or less common messages: decode payload bytes
      fields.push(field('payload_len', `${wireLength} B`));
      if (wireLength > 0) {
        const hexPreview = Array.from(wirePayload.subarray(0, 32), b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        fields.push(field('payload_hex', hexPreview));
        if (payload.byteLength >= 4) {
          fields.push(field('val_u32_0', view.getUint32(0, true)));
        }
      }
    }
  } catch {
    fields.push(field('decode_error', 'Payload shorter than expected'));
  }

  return fields;
}

function summarize(messageId: number, fields: InspectorField[]): string | null {
  const find = (label: string) => fields.find(item => item.label === label)?.value;
  if (messageId === 0) return find('flight_mode') ?? null;
  if (messageId === 76) return find('command') ?? null;
  if (messageId === 77) return find('result') ?? null;
  if ([39, 40, 42, 44, 46, 51, 73].includes(messageId)) return find('seq') ? `SEQ ${find('seq')}` : find('count') ? `COUNT ${find('count')}` : null;
  if (messageId === 253) return find('text') ?? null;
  if (messageId === 132) return find('current_distance') ? `${find('current_distance')}` : null;
  if (messageId === 100) return find('quality') ? `Qual: ${find('quality')}` : null;
  if (messageId === 22) return find('param_id') && find('param_value') ? `${find('param_id')} = ${find('param_value')}` : null;
  if (messageId === 24) return find('satellites_visible') ? `${find('satellites_visible')} sats` : null;
  if (messageId === 74) return find('alt') ? `Alt: ${find('alt')}` : null;
  if (messageId === 147) return find('remaining') ? `Bat: ${find('remaining')}` : null;
  if (messageId === 149) return find('target_num') && find('distance') ? `Target #${find('target_num')} at ${find('distance')}` : null;
  return null;
}
