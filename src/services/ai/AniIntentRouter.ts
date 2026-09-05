export type AniIntent =
  | 'GENERAL_CHAT'
  | 'APP_HELP'
  | 'VEHICLE_STATUS'
  | 'SYSTEM_HEALTH'
  | 'PREFLIGHT'
  | 'ARM_DIAGNOSTICS'
  | 'CONNECTION_DIAGNOSTICS'
  | 'MAVLINK_DIAGNOSTICS'
  | 'MISSION_QUERY'
  | 'MISSION_CREATE'
  | 'MISSION_EDIT'
  | 'PARAMETER_QUERY'
  | 'PARAMETER_PROPOSAL'
  | 'FLIGHT_ACTION'
  | 'FLIGHT_PLAN'
  | 'MAP_QUERY'
  | 'VISION_QUERY'
  | 'FLIGHT_DEBRIEF';

export interface AniRoute {
  intent: AniIntent;
  confidence: number;
  requiresFlightContext: boolean;
  deterministic: boolean;
  reason: string;
}

const INTENT_REQUIRES_CONTEXT: ReadonlySet<AniIntent> = new Set([
  'VEHICLE_STATUS',
  'SYSTEM_HEALTH',
  'PREFLIGHT',
  'ARM_DIAGNOSTICS',
  'CONNECTION_DIAGNOSTICS',
  'MAVLINK_DIAGNOSTICS',
  'MISSION_QUERY',
  'MISSION_CREATE',
  'MISSION_EDIT',
  'PARAMETER_QUERY',
  'PARAMETER_PROPOSAL',
  'FLIGHT_ACTION',
  'FLIGHT_PLAN',
  'MAP_QUERY',
  'VISION_QUERY',
  'FLIGHT_DEBRIEF',
]);

const DETERMINISTIC_INTENTS: ReadonlySet<AniIntent> = new Set([
  'VEHICLE_STATUS',
  'SYSTEM_HEALTH',
  'PREFLIGHT',
  'ARM_DIAGNOSTICS',
  'CONNECTION_DIAGNOSTICS',
  'MAVLINK_DIAGNOSTICS',
  'PARAMETER_QUERY',
  'PARAMETER_PROPOSAL',
  'FLIGHT_DEBRIEF',
]);

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}\s./:-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function score(text: string, words: readonly string[]) {
  return words.reduce((total, word) => total + (text.includes(word) ? 1 : 0), 0);
}

export function routeAniIntent(userText: string): AniRoute {
  const raw = userText.trim();
  if (/\b[A-Z][A-Z0-9]{1,15}_[A-Z0-9_]{1,15}\b/i.test(raw)) {
    return {
      intent: /(?:giam|giảm|tang|tăng|set|doi|đổi|xuong|xuống|len|lên|=|to)\b/i.test(raw)
        ? 'PARAMETER_PROPOSAL'
        : 'PARAMETER_QUERY',
      confidence: 0.9,
      requiresFlightContext: true,
      deterministic: true,
      reason: 'explicit MAVLink parameter name',
    };
  }

  const text = normalize(userText);
  if (!text) {
    return { intent: 'GENERAL_CHAT', confidence: 0, requiresFlightContext: false, deterministic: false, reason: 'empty input' };
  }

  const candidates: Array<{ intent: AniIntent; value: number; reason: string }> = [
    { intent: 'PREFLIGHT', value: score(text, ['preflight', 'truoc khi bay', 'kiem tra truoc khi bay', 'ready to fly']) * 3, reason: 'preflight terms' },
    { intent: 'ARM_DIAGNOSTICS', value: score(text, ['arm', 'arming', 'khong arm', 'khong the arm', 'cant arm', "can't arm"]) * 3, reason: 'arming diagnostics terms' },
    { intent: 'CONNECTION_DIAGNOSTICS', value: score(text, ['ket noi', 'connection', 'connected', 'gateway', 'pi connected', 'joystick khong dieu khien', 'websocket', 'tailscale']) * 2, reason: 'connection path terms' },
    { intent: 'MAVLINK_DIAGNOSTICS', value: score(text, ['mavlink', 'heartbeat', 'packet', 'pps', 'crc', 'telemetry stream']) * 3, reason: 'mavlink diagnostics terms' },
    { intent: 'SYSTEM_HEALTH', value: score(text, ['health check', 'system health', 'kiem tra he thong', 'suc khoe he thong']) * 3, reason: 'system health terms' },
    { intent: 'VEHICLE_STATUS', value: score(text, ['tinh trang', 'trang thai', 'what is happening', 'whats happening', 'chuyen gi dang xay ra', 'pin drone', 'battery drone', 'mode drone']) * 2, reason: 'vehicle status terms' },
    { intent: 'MISSION_CREATE', value: score(text, ['tao mission', 'create mission', 'waypoint', 'grid mission', 'vong tron', 'circle', 'survey']) * 3, reason: 'mission creation terms' },
    { intent: 'MISSION_EDIT', value: score(text, ['sua mission', 'edit mission', 'xoa diem', 'them diem']) * 3, reason: 'mission editing terms' },
    { intent: 'MISSION_QUERY', value: score(text, ['mission', 'ke hoach bay', 'flight plan']) * 2, reason: 'mission terms' },
    { intent: 'PARAMETER_PROPOSAL', value: score(text, ['giam toc', 'tang toc', 'doi tham so', 'set parameter', 'param set']) * 3, reason: 'parameter change terms' },
    { intent: 'PARAMETER_QUERY', value: score(text, ['tham so', 'parameter', 'mot_thst_hover', 'wpnav_', 'psc_']) * 2, reason: 'parameter query terms' },
    { intent: 'VISION_QUERY', value: score(text, ['camera dang thay gi', 'camera', 'landing marker', 'anh', 'hinh anh', 'vat can']) * 2, reason: 'vision terms' },
    { intent: 'FLIGHT_DEBRIEF', value: score(text, ['debrief', 'sau chuyen bay', 'chuyen vua roi', 'flight summary', 'flight log']) * 3, reason: 'flight debrief terms' },
    { intent: 'MAP_QUERY', value: score(text, ['map', 'ban do', 'diem toi vua chon', 'vung toi vua ve']) * 2, reason: 'map terms' },
    { intent: 'APP_HELP', value: score(text, ['cach dung app', 'huong dan', 'settings', 'man hinh', 'nut nao']) * 2, reason: 'app help terms' },
    { intent: 'FLIGHT_ACTION', value: score(text, ['takeoff', 'cat canh', 'land', 'ha canh', 'rtl', 'disarm', 'set mode', 'loiter', 'guided']) * 2, reason: 'flight action terms' },
  ];

  const best = candidates.sort((a, b) => b.value - a.value)[0];
  const intent = best && best.value > 0 ? best.intent : 'GENERAL_CHAT';
  const confidence = best && best.value > 0 ? Math.min(0.95, 0.45 + best.value * 0.1) : 0.35;

  return {
    intent,
    confidence,
    requiresFlightContext: INTENT_REQUIRES_CONTEXT.has(intent),
    deterministic: DETERMINISTIC_INTENTS.has(intent),
    reason: best && best.value > 0 ? best.reason : 'general assistant fallback',
  };
}
