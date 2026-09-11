import { FlightMode } from '../../types/command';
import type { AiIntentParameters } from './intents/AiIntentTypes';

export type PendingAniCommand =
  | { type: 'TAKEOFF_ALTITUDE'; createdAt: number }
  | { type: 'SET_MODE'; createdAt: number };

export interface AniCommandResolution {
  intent?: AiIntentParameters;
  clarification?: PendingAniCommand;
  message: string;
}

const MODE_ALIASES: Record<string, FlightMode> = {
  stabilize: FlightMode.STABILIZE,
  stablize: FlightMode.STABILIZE,
  alt_hold: FlightMode.ALT_HOLD,
  althold: FlightMode.ALT_HOLD,
  alt: FlightMode.ALT_HOLD,
  loiter: FlightMode.LOITER,
  poshold: FlightMode.POSHOLD,
  guided: FlightMode.GUIDED,
  auto: FlightMode.AUTO,
  rtl: FlightMode.RTL,
  land: FlightMode.LAND,
};

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}\s.,:_-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isQuestionOrDefinition(text: string) {
  return [
    ' la gi',
    'nghia la gi',
    'giai thich',
    'co nghia',
    'what is',
    'explain',
    'meaning',
    'toi co nen',
    'co nen',
    'nen khong',
    'should i',
  ].some(term => text.includes(term));
}

function extractAltitudeMeters(text: string): number | null {
  const match = text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:m|met|meter|meters|metre|metres)?(?:\s|$)/);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(value) || value < 1 || value > 120) return null;
  return Math.round(value * 10) / 10;
}

function extractMode(text: string): FlightMode | null {
  const compact = text.replace(/\s+/g, '_');
  for (const [alias, mode] of Object.entries(MODE_ALIASES)) {
    if (compact.includes(alias)) return mode;
  }
  return null;
}

function looksLikeTakeoff(text: string) {
  return [
    'takeoff',
    'cat canh',
    'bay len',
    'len do cao',
    'cho drone len',
  ].some(term => text.includes(term));
}

function looksLikeModeChange(text: string) {
  return [
    'chuyen mode',
    'chuyen sang',
    'doi sang',
    'qua ',
    'set mode',
    'mode ',
  ].some(term => text.includes(term));
}

export function resolveAniCommand(
  userText: string,
  pending: PendingAniCommand | null,
): AniCommandResolution | null {
  const text = normalize(userText);
  if (!text) return null;
  if (isQuestionOrDefinition(text)) return null;

  if (pending && Date.now() - pending.createdAt < 60_000) {
    if (pending.type === 'TAKEOFF_ALTITUDE') {
      const altitude = extractAltitudeMeters(text);
      if (altitude != null) {
        return {
          intent: { type: 'TAKEOFF', altitudeMeters: altitude },
          message: `Tôi đã tạo yêu cầu cất cánh lên ${altitude} mét. Hãy xác nhận trên màn hình.`,
        };
      }
    }
    if (pending.type === 'SET_MODE') {
      const mode = extractMode(text);
      if (mode) {
        return {
          intent: { type: 'SET_MODE', mode },
          message: `Tôi đã tạo yêu cầu chuyển sang chế độ ${mode}. Hãy xác nhận trên màn hình.`,
        };
      }
    }
  }

  if (/^(arm|arm drone|cho drone arm)$/.test(text) || text.includes('mo dong co') || text.includes('chuan bi bay')) {
    return {
      intent: { type: 'ARM' },
      message: 'Tôi đã tạo yêu cầu ARM máy bay. Hãy xác nhận trên màn hình.',
    };
  }

  if (/^(disarm|disarm drone)$/.test(text) || text.includes('tat dong co')) {
    return {
      intent: { type: 'DISARM' },
      message: 'Tôi đã tạo yêu cầu DISARM máy bay. Hãy xác nhận trên màn hình.',
    };
  }

  if (looksLikeTakeoff(text)) {
    const altitude = extractAltitudeMeters(text);
    if (altitude == null) {
      return {
        clarification: { type: 'TAKEOFF_ALTITUDE', createdAt: Date.now() },
        message: 'Bạn muốn cất cánh lên độ cao bao nhiêu mét?',
      };
    }
    return {
      intent: { type: 'TAKEOFF', altitudeMeters: altitude },
      message: `Tôi đã tạo yêu cầu cất cánh lên ${altitude} mét. Hãy xác nhận trên màn hình.`,
    };
  }

  if (/^(land|ha canh|ha xuong)$/.test(text) || text.includes('ha canh') || text.includes('dap xuong') || text.includes('cho no dap')) {
    return {
      intent: { type: 'LAND' },
      message: 'Tôi đã tạo yêu cầu hạ cánh. Hãy xác nhận trên màn hình.',
    };
  }

  if (/^(rtl|return home)$/.test(text) || text.includes('quay ve home') || text.includes('bay ve')) {
    return {
      intent: { type: 'RTL' },
      message: 'Tôi đã tạo yêu cầu quay về điểm Home (RTL). Hãy xác nhận trên màn hình.',
    };
  }

  if (looksLikeModeChange(text)) {
    const mode = extractMode(text);
    if (!mode) {
      return {
        clarification: { type: 'SET_MODE', createdAt: Date.now() },
        message: 'Bạn muốn chuyển sang mode nào?',
      };
    }
    return {
      intent: { type: 'SET_MODE', mode },
      message: `Tôi đã tạo yêu cầu chuyển sang chế độ ${mode}. Hãy xác nhận trên màn hình.`,
    };
  }

  return null;
}
