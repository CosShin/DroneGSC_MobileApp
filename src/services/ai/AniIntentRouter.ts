export type AniIntent =
  | 'GENERAL_CHAT'
  | 'WEATHER'
  | 'WEB_SEARCH'
  | 'FLIGHT_STATUS'
  | 'FLIGHT_QUESTION'
  | 'MISSION_ACTION'
  | 'NAVIGATION_ACTION'
  | 'SETTINGS_ACTION'
  | 'VISION_ACTION'
  | 'UNKNOWN'
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
  'FLIGHT_STATUS',
  'FLIGHT_QUESTION',
  'VEHICLE_STATUS',
  'SYSTEM_HEALTH',
  'PREFLIGHT',
  'ARM_DIAGNOSTICS',
  'CONNECTION_DIAGNOSTICS',
  'MAVLINK_DIAGNOSTICS',
  'MISSION_QUERY',
  'MISSION_ACTION',
  'MISSION_CREATE',
  'MISSION_EDIT',
  'PARAMETER_QUERY',
  'PARAMETER_PROPOSAL',
  'FLIGHT_ACTION',
  'FLIGHT_PLAN',
  'NAVIGATION_ACTION',
  'MAP_QUERY',
  'VISION_ACTION',
  'VISION_QUERY',
  'FLIGHT_DEBRIEF',
]);

const DETERMINISTIC_INTENTS: ReadonlySet<AniIntent> = new Set([
  'FLIGHT_STATUS',
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

function hasAny(text: string, words: readonly string[]) {
  return words.some(word => text.includes(word));
}

function looksLikeExplanationOrAdvice(text: string) {
  return hasAny(text, [
    ' la gi',
    'la gi',
    'nghia la gi',
    'giai thich',
    'co nghia',
    'toi co nen',
    'co nen',
    'nen khong',
    'should i',
    'what is',
    'explain',
    'meaning',
  ]);
}

function looksLikeWeather(text: string) {
  return hasAny(text, ['thoi tiet', 'weather', 'mua khong', 'co mua', 'nhiet do', 'gio hom nay', 'rain today']);
}

function looksLikeRealtimeWeb(text: string) {
  return hasAny(text, [
    'moi nhat',
    'latest',
    'hien tai gia',
    'gia raspberry',
    'gia pi',
    'phien ban moi',
    'current price',
    'today price',
  ]);
}

function looksLikeFlightAction(text: string) {
  if (looksLikeExplanationOrAdvice(text)) return false;
  return hasAny(text, [
    'arm drone',
    'cho drone arm',
    'mo dong co',
    'mở động cơ',
    'chuan bi bay',
    'disarm',
    'tat dong co',
    'takeoff',
    'cat canh',
    'bay len',
    'len do cao',
    'ha canh',
    'dap xuong',
    'land',
    'rtl',
    'return home',
    'quay ve home',
    'bay ve',
    'qua loiter',
    'qua stabilize',
    'chuyen sang',
    'doi sang',
    'set mode',
  ]) || /^(arm|land|rtl|takeoff|disarm)$/i.test(text);
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

  if (looksLikeWeather(text)) {
    return {
      intent: 'WEATHER',
      confidence: 0.86,
      requiresFlightContext: hasAny(text, ['drone', 'may bay', 'khu vuc drone', 'dang bay']),
      deterministic: false,
      reason: 'weather request requires realtime tool data',
    };
  }

  if (looksLikeRealtimeWeb(text)) {
    return {
      intent: 'WEB_SEARCH',
      confidence: 0.78,
      requiresFlightContext: false,
      deterministic: false,
      reason: 'realtime web information request',
    };
  }

  if (looksLikeExplanationOrAdvice(text)) {
    if (hasAny(text, ['co nen arm', 'toi co nen arm', 'nen arm', 'san sang bay', 'bay duoc khong', 'gps on chua', 'gps on khong', 'pin on khong', 'drone on khong', 'drone the nao', 'drone sao roi'])) {
      return {
        intent: 'FLIGHT_QUESTION',
        confidence: 0.82,
        requiresFlightContext: true,
        deterministic: false,
        reason: 'flight advisory question, not an action command',
      };
    }
    return {
      intent: 'GENERAL_CHAT',
      confidence: 0.74,
      requiresFlightContext: false,
      deterministic: false,
      reason: 'definition or explanation question',
    };
  }

  if (looksLikeFlightAction(text)) {
    const isMission = hasAny(text, ['mission', 'waypoint', 'ke hoach bay']);
    const isNavigation = hasAny(text, ['goto', 'bay toi', 'di toi', 'toa do']);
    return {
      intent: isMission ? 'MISSION_ACTION' : isNavigation ? 'NAVIGATION_ACTION' : 'FLIGHT_ACTION',
      confidence: 0.9,
      requiresFlightContext: true,
      deterministic: false,
      reason: 'natural flight command phrasing',
    };
  }

  const candidates: Array<{ intent: AniIntent; value: number; reason: string }> = [
    { intent: 'PREFLIGHT', value: score(text, ['preflight', 'truoc khi bay', 'kiem tra truoc khi bay', 'ready to fly']) * 3, reason: 'preflight terms' },
    { intent: 'ARM_DIAGNOSTICS', value: score(text, ['arm', 'arming', 'khong arm', 'khong the arm', 'cant arm', "can't arm"]) * 3, reason: 'arming diagnostics terms' },
    { intent: 'CONNECTION_DIAGNOSTICS', value: score(text, ['ket noi', 'connection', 'connected', 'gateway', 'pi connected', 'joystick khong dieu khien', 'websocket', 'tailscale']) * 2, reason: 'connection path terms' },
    { intent: 'MAVLINK_DIAGNOSTICS', value: score(text, ['mavlink', 'heartbeat', 'packet', 'pps', 'crc', 'telemetry stream']) * 3, reason: 'mavlink diagnostics terms' },
    { intent: 'SYSTEM_HEALTH', value: score(text, ['health check', 'system health', 'kiem tra he thong', 'suc khoe he thong', 'kiem tra cam bien', 'cam bien', 'sensor', 'sensors', 'tinh trang cam bien', 'trang thai cam bien', 'kiem tra ekf', 'ekf', 'kiem tra imu', 'imu', 'kiem tra compass', 'compass', 'la ban', 'optical flow', 'flow', 'rangefinder', 'khoang cach']) * 3, reason: 'system health terms' },
    { intent: 'FLIGHT_STATUS', value: score(text, ['tinh trang drone', 'trang thai drone', 'kiem tra drone', 'drone sao roi', 'drone the nao', 'drone the nao roi', 'drone hien tai sao', 'drone cua toi', 'drone ok khong', 'drone on khong', 'what is happening', 'whats happening', 'chuyen gi dang xay ra', 'pin drone', 'drone pin', 'battery drone', 'mode drone', 'gps drone', 'drone toi sao roi', 'pin bao nhieu', 'pin con bao nhieu', 'kiem tra pin', 'pin the nao', 'battery bao nhieu', 'gps the nao', 'kiem tra gps', 'gps bao nhieu', 'bao nhieu ve tinh', 've tinh bao nhieu', 'do cao bao nhieu', 'toc do bao nhieu', 'vi tri drone', 'drone dang o dau']) * 2, reason: 'vehicle status terms' },
    { intent: 'FLIGHT_QUESTION', value: score(text, ['co nen arm', 'san sang bay', 'gps on chua', 'gps on khong', 'pin on khong', 'pin on chua', 'bay duoc khong', 'co bay duoc khong', 'drone on chua']) * 2, reason: 'flight advisory question' },
    { intent: 'MISSION_CREATE', value: score(text, ['tao mission', 'create mission', 'waypoint', 'grid mission', 'vong tron', 'circle', 'survey']) * 3, reason: 'mission creation terms' },
    { intent: 'MISSION_EDIT', value: score(text, ['sua mission', 'edit mission', 'xoa diem', 'them diem']) * 3, reason: 'mission editing terms' },
    { intent: 'MISSION_QUERY', value: score(text, ['mission', 'ke hoach bay', 'flight plan']) * 2, reason: 'mission terms' },
    { intent: 'PARAMETER_PROPOSAL', value: score(text, ['giam toc', 'tang toc', 'doi tham so', 'set parameter', 'param set']) * 3, reason: 'parameter change terms' },
    { intent: 'PARAMETER_QUERY', value: score(text, ['tham so', 'parameter', 'mot_thst_hover', 'wpnav_', 'psc_']) * 2, reason: 'parameter query terms' },
    { intent: 'VISION_ACTION', value: score(text, ['camera dang thay gi', 'camera', 'landing marker', 'anh', 'hinh anh', 'vat can']) * 2, reason: 'vision terms' },
    { intent: 'FLIGHT_DEBRIEF', value: score(text, ['debrief', 'sau chuyen bay', 'chuyen vua roi', 'flight summary', 'flight log']) * 3, reason: 'flight debrief terms' },
    { intent: 'MAP_QUERY', value: score(text, ['map', 'ban do', 'diem toi vua chon', 'vung toi vua ve']) * 2, reason: 'map terms' },
    { intent: 'APP_HELP', value: score(text, ['cach dung app', 'huong dan', 'settings', 'man hinh', 'nut nao']) * 2, reason: 'app help terms' },
    { intent: 'FLIGHT_ACTION', value: looksLikeExplanationOrAdvice(text) ? 0 : score(text, ['takeoff', 'cat canh', 'land', 'ha canh', 'rtl', 'disarm', 'set mode', 'loiter', 'guided']) * 2, reason: 'flight action terms' },
  ];

  const best = candidates.sort((a, b) => b.value - a.value)[0];
  const intent = best && best.value > 0 ? best.intent : 'GENERAL_CHAT';
  const confidence = best && best.value > 0 ? Math.min(0.95, 0.45 + best.value * 0.1) : 0.35;

  const mentionsTelemetry = hasAny(text, [
    'drone', 'may bay', 'pin', 'battery', 'gps', 've tinh', 'satellites',
    'cam bien', 'sensor', 'sensors', 'ekf', 'imu', 'compass', 'la ban',
    'do cao', 'altitude', 'toc do', 'speed', 'flight mode', 'che do bay',
    'heartbeat', 'mavlink', 'telemetry',
  ]);

  const fallbackIntent = intent === 'GENERAL_CHAT' && mentionsTelemetry && !looksLikeExplanationOrAdvice(text)
    ? 'FLIGHT_QUESTION'
    : intent;

  const requiresFlightContext = INTENT_REQUIRES_CONTEXT.has(fallbackIntent) || (!looksLikeExplanationOrAdvice(text) && mentionsTelemetry);

  return {
    intent: fallbackIntent,
    confidence,
    requiresFlightContext,
    deterministic: DETERMINISTIC_INTENTS.has(fallbackIntent),
    reason: best && best.value > 0 ? best.reason : mentionsTelemetry ? 'telemetry mention' : 'general assistant fallback',
  };
}
