import type { SemanticStructuredCard, SpeechTone } from './AiTypes';
import type { AniDeterministicResponse } from './AniDiagnostics';
import type { AniToolSnapshot } from './AniToolbox';
import { buildSpokenResponse } from '../voice/SpokenResponseBuilder';

type ParameterValueType = 'REAL32' | 'INT32' | 'UINT8';

export interface CachedParameterValue {
  name: string;
  value: number;
  type: ParameterValueType | string;
  unit?: string;
  updatedAt: number;
  vehicleSessionId?: string | null;
}

export interface KnownParameterMeta {
  name: string;
  unit: string;
  min: number;
  max: number;
  description: string;
  risk: string;
}

const KNOWN_PARAMETERS: Record<string, KnownParameterMeta> = {
  WPNAV_SPEED: {
    name: 'WPNAV_SPEED',
    unit: 'cm/s',
    min: 20,
    max: 2000,
    description: 'Horizontal waypoint/navigation speed used by ArduCopter navigation controllers.',
    risk: 'Too low can make missions sluggish; too high can exceed airframe or pilot expectations.',
  },
  LOIT_SPEED: {
    name: 'LOIT_SPEED',
    unit: 'cm/s',
    min: 20,
    max: 2000,
    description: 'Maximum horizontal speed in Loiter-style position control.',
    risk: 'Changing Loiter speed affects pilot feel and position-control response.',
  },
  MOT_THST_HOVER: {
    name: 'MOT_THST_HOVER',
    unit: 'ratio',
    min: 0.1,
    max: 0.9,
    description: 'Estimated throttle required to hover.',
    risk: 'Incorrect hover throttle can affect altitude control and takeoff/landing behavior.',
  },
  FLOW_TYPE: {
    name: 'FLOW_TYPE',
    unit: 'enum',
    min: 0,
    max: 10,
    description: 'Optical-flow sensor backend selection.',
    risk: 'Wrong sensor type can break optical-flow navigation.',
  },
};

function normalizeName(value: string) {
  return value.trim().toUpperCase();
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function extractExplicitParameter(text: string): string | null {
  const match = text.match(/\b[A-Z][A-Z0-9]{1,15}_[A-Z0-9_]{1,15}\b/i);
  return match ? normalizeName(match[0]) : null;
}

function inferParameter(text: string): string | null {
  const explicit = extractExplicitParameter(text);
  if (explicit) return explicit;
  const normalized = normalizeText(text);
  if (normalized.includes('loiter') || normalized.includes('loit')) return 'LOIT_SPEED';
  if (normalized.includes('toc') || normalized.includes('speed')) return 'WPNAV_SPEED';
  if (normalized.includes('optical') || normalized.includes('flow')) return 'FLOW_TYPE';
  return null;
}

export class ParameterCache {
  private values = new Map<string, CachedParameterValue>();

  record(value: CachedParameterValue) {
    const name = normalizeName(value.name);
    this.values.set(name, {
      ...value,
      name,
      unit: value.unit ?? KNOWN_PARAMETERS[name]?.unit,
    });
  }

  get(name: string): CachedParameterValue | null {
    return this.values.get(normalizeName(name)) ?? null;
  }

  clearForNewSession(sessionId?: string | null) {
    if (!sessionId) {
      this.values.clear();
      return;
    }
    for (const [name, value] of this.values) {
      if (value.vehicleSessionId && value.vehicleSessionId !== sessionId) this.values.delete(name);
    }
  }
}

export const parameterCache = new ParameterCache();

function response(content: string, card: SemanticStructuredCard, tone: SpeechTone): AniDeterministicResponse {
  return {
    content,
    structuredCard: card,
    spokenText: buildSpokenResponse(content, 'vi-VN', card).spokenText,
    tone,
  };
}

export function buildParameterAssistantResponse(
  userText: string,
  snapshot: AniToolSnapshot,
  cache: ParameterCache = parameterCache,
): AniDeterministicResponse {
  const text = normalizeText(userText);
  const asksList = text.includes('anh huong') || text.includes('lien quan') || text.includes('parameter nao');
  if (asksList) {
    const content = 'Các parameter thường ảnh hưởng tốc độ bay gồm WPNAV_SPEED và LOIT_SPEED. ANI chỉ có thể xác nhận giá trị hiện tại khi đã nhận PARAM_VALUE từ vehicle.';
    return response(content, {
      type: 'PARAMETER_CHANGE',
      title: 'PARAMETER ASSISTANT',
      tone: 'INFORMATIVE',
      summary: content,
      metrics: [
        { label: 'WPNAV_SPEED', value: 'Waypoint/nav horizontal speed · cm/s', tone: 'neutral' },
        { label: 'LOIT_SPEED', value: 'Loiter horizontal speed · cm/s', tone: 'neutral' },
      ],
    }, 'INFORMATIVE');
  }

  const parameterName = inferParameter(userText);
  if (!parameterName) {
    const content = 'ANI chưa xác định được parameter cụ thể. Hãy nêu tên parameter, ví dụ WPNAV_SPEED hoặc MOT_THST_HOVER.';
    return response(content, {
      type: 'PARAMETER_CHANGE',
      title: 'PARAMETER ASSISTANT',
      tone: 'CAUTION',
      summary: content,
    }, 'CAUTION');
  }

  const meta = KNOWN_PARAMETERS[parameterName];
  const current = cache.get(parameterName);
  const wantsChange = text.includes('giam') || text.includes('tang') || text.includes('set') || text.includes('xuong') || text.includes('len');

  if (!current) {
    const content = `${parameterName} hiện chưa có trong parameter cache. ANI không thể xác nhận giá trị hiện tại hoặc tạo proposal an toàn.`;
    return response(content, {
      type: 'PARAMETER_CHANGE',
      title: wantsChange ? 'PARAMETER CHANGE BLOCKED' : 'PARAMETER QUERY',
      tone: 'CAUTION',
      summary: content,
      metrics: [
        { label: 'Parameter', value: parameterName, tone: 'primary' },
        { label: 'Current', value: '--', tone: 'warning' },
        { label: 'Vehicle session', value: snapshot.flightContext.connection.sessionId ?? '--', tone: 'neutral' },
      ],
      warnings: ['Current PARAM_VALUE is unavailable.'],
    }, 'CAUTION');
  }

  if (!wantsChange) {
    const content = `${parameterName} hiện là ${current.value} ${current.unit ?? meta?.unit ?? ''}.`;
    return response(content, {
      type: 'PARAMETER_CHANGE',
      title: 'PARAMETER QUERY',
      tone: 'INFORMATIVE',
      summary: content,
      metrics: [
        { label: 'Parameter', value: parameterName, tone: 'primary' },
        { label: 'Current', value: `${current.value} ${current.unit ?? meta?.unit ?? ''}`.trim(), tone: 'success' },
        { label: 'Updated', value: `${Math.max(0, Date.now() - current.updatedAt)} ms ago`, tone: 'neutral' },
      ],
      findings: meta ? [meta.description] : undefined,
    }, 'INFORMATIVE');
  }

  if (!meta) {
    const content = `${parameterName} không có metadata an toàn trong ANI, nên proposal thay đổi bị chặn.`;
    return response(content, {
      type: 'PARAMETER_CHANGE',
      title: 'PARAMETER CHANGE BLOCKED',
      tone: 'CAUTION',
      summary: content,
      metrics: [
        { label: 'Parameter', value: parameterName, tone: 'primary' },
        { label: 'Current', value: String(current.value), tone: 'neutral' },
      ],
      warnings: ['Missing deterministic metadata and bounds.'],
    }, 'CAUTION');
  }

  const explicitValue = userText.match(/(?:xuống|xuong|lên|len|=|to)\s*([0-9]+(?:[.,][0-9]+)?)/i)?.[1]?.replace(',', '.');
  const proposed = explicitValue != null
    ? Number(explicitValue)
    : text.includes('giam')
      ? Math.round(current.value * 0.7)
      : Math.round(current.value * 1.15);

  if (!Number.isFinite(proposed) || proposed < meta.min || proposed > meta.max) {
    const content = `Proposal cho ${parameterName} bị chặn vì giá trị ${proposed} ${meta.unit} nằm ngoài giới hạn ${meta.min}-${meta.max} ${meta.unit}.`;
    return response(content, {
      type: 'PARAMETER_CHANGE',
      title: 'PARAMETER CHANGE BLOCKED',
      tone: 'CAUTION',
      summary: content,
      metrics: [
        { label: 'Parameter', value: parameterName, tone: 'primary' },
        { label: 'Current', value: `${current.value} ${meta.unit}`, tone: 'neutral' },
        { label: 'Proposed', value: `${proposed} ${meta.unit}`, tone: 'danger' },
      ],
      warnings: ['Proposed value is outside deterministic safe bounds.'],
    }, 'CAUTION');
  }

  const content = `PARAMETER CHANGE\n${parameterName}: current ${current.value} ${meta.unit}, proposed ${proposed} ${meta.unit}. Cần pilot xác nhận giữ để áp dụng; ANI không ghi parameter trực tiếp.`;
  return response(content, {
    type: 'PARAMETER_CHANGE',
    title: 'PARAMETER CHANGE',
    tone: 'CAUTION',
    summary: 'Proposal đã được tạo nhưng yêu cầu xác nhận phi công và PARAM_VALUE verification.',
    metrics: [
      { label: 'Parameter', value: parameterName, tone: 'primary' },
      { label: 'Current', value: `${current.value} ${meta.unit}`, tone: 'neutral' },
      { label: 'Proposed', value: `${proposed} ${meta.unit}`, tone: 'warning' },
      { label: 'Apply', value: 'BLOCKED until confirmed service verifies PARAM_VALUE', tone: 'warning' },
    ],
    findings: [meta.description],
    warnings: [meta.risk],
    recommendations: ['Pilot hold-to-apply confirmation is required before PARAM_SET.'],
  }, 'CAUTION');
}
