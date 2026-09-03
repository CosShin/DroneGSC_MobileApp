import type { SpeechTone, SemanticStructuredCard } from '../ai/AiTypes';
import { prepareTextForSpeech, type SpeechLanguage } from './SpeechSanitizer';

export interface SpokenResult {
  spokenText: string;
  tone: SpeechTone;
}

export interface ProsodySettings {
  rate: number;
  pitch: number;
}

/**
 * Deterministic Tone Prosody Mapping (Requirement 14).
 * Subtle pitch & rate adjustments that preserve professional aviation clarity.
 */
export const PROSODY_MAP: Record<SpeechTone, ProsodySettings> = {
  NORMAL: { rate: 0.95, pitch: 1.00 },
  INFORMATIVE: { rate: 0.93, pitch: 1.00 },
  POSITIVE: { rate: 0.98, pitch: 1.03 },
  CAUTION: { rate: 0.90, pitch: 0.98 },
  URGENT: { rate: 0.92, pitch: 1.02 },
};

/**
 * Calculates effective prosody based on tone, user baseline speed/pitch, and voice style.
 */
export function getEffectiveProsody(
  tone: SpeechTone,
  baseRate = 1.0,
  basePitch = 1.0,
  style?: 'NATURAL' | 'COPILOT' | 'CALM'
): ProsodySettings {
  const toneProsody = PROSODY_MAP[tone] ?? PROSODY_MAP.NORMAL;

  let rateMultiplier = toneProsody.rate;
  let pitchMultiplier = toneProsody.pitch;

  if (style === 'CALM') {
    rateMultiplier *= 0.95;
    pitchMultiplier *= 0.98;
  } else if (style === 'COPILOT') {
    rateMultiplier *= 1.02;
    pitchMultiplier *= 0.96; // slightly crisper, authoritative radio timbre
  }

  return {
    rate: Math.max(0.7, Math.min(1.4, Number((baseRate * rateMultiplier).toFixed(2)))),
    pitch: Math.max(0.7, Math.min(1.4, Number((basePitch * pitchMultiplier).toFixed(2)))),
  };
}

/**
 * Extracts a natural, concise spoken summary from an AI response or structured card.
 * Never speaks entire raw tables, markdown syntax, or long lists.
 */
export function buildSpokenResponse(
  rawText: string,
  language: SpeechLanguage = 'vi-VN',
  structuredCard?: SemanticStructuredCard | null
): SpokenResult {
  const isVi = language === 'vi-VN';

  // 1. If we have a structured card, use dedicated concise spoken scripts
  if (structuredCard) {
    switch (structuredCard.type) {
      case 'FLIGHT_STATUS': {
        const mode = structuredCard.metrics?.find(m => m.label === 'MODE')?.value || 'LOITER';
        const armed = structuredCard.metrics?.find(m => m.label === 'ARMED')?.value === 'YES';
        const batt = structuredCard.metrics?.find(m => m.label === 'BATTERY')?.value || '--';
        const gps = structuredCard.metrics?.find(m => m.label === 'GPS')?.value || '--';
        const conclusion = structuredCard.summary || (isVi ? 'Chuyến bay hiện ổn định.' : 'Flight is currently stable.');

        const tone: SpeechTone = structuredCard.tone || 'INFORMATIVE';
        let script = '';

        if (isVi) {
          const armedStr = armed ? 'Động cơ đã arm, sẵn sàng.' : 'Động cơ đang disarmed.';
          script = `Drone đang ở chế độ ${mode}. ${armedStr} Pin còn ${batt}. GPS ${gps}. ${conclusion}`;
        } else {
          const armedStr = armed ? 'Vehicle is armed and ready.' : 'Vehicle is disarmed.';
          script = `Drone is in ${mode} mode. ${armedStr} Battery at ${batt}. GPS ${gps}. ${conclusion}`;
        }

        return {
          spokenText: prepareTextForSpeech(script, language),
          tone,
        };
      }

      case 'CAMERA_ANALYSIS': {
        const summary = structuredCard.summary || (isVi ? 'Đã hoàn tất phân tích hình ảnh camera.' : 'Camera analysis completed.');
        const rec = structuredCard.recommendations?.[0] || '';
        const tone: SpeechTone = structuredCard.tone || 'INFORMATIVE';

        const script = isVi
          ? `Kết quả phân tích camera. ${summary} ${rec ? `Khuyến nghị: ${rec}.` : ''}`
          : `Camera analysis results. ${summary} ${rec ? `Recommendation: ${rec}.` : ''}`;

        return {
          spokenText: prepareTextForSpeech(script, language),
          tone,
        };
      }

      case 'WARNING': {
        const summary = structuredCard.summary || (isVi ? 'Phát hiện cảnh báo hệ thống.' : 'System warning detected.');
        const rec = structuredCard.recommendations?.[0] || '';
        const tone: SpeechTone = structuredCard.tone || 'CAUTION';

        const script = isVi
          ? `${summary} ${rec ? `Tôi khuyên bạn: ${rec}.` : ''}`
          : `${summary} ${rec ? `Recommendation: ${rec}.` : ''}`;

        return {
          spokenText: prepareTextForSpeech(script, language),
          tone,
        };
      }

      case 'PREFLIGHT_CHECK': {
        const hasWarning = (structuredCard.warnings && structuredCard.warnings.length > 0);
        const tone: SpeechTone = hasWarning ? 'CAUTION' : 'POSITIVE';
        const summary = structuredCard.summary || (hasWarning
          ? (isVi ? 'Phát hiện cảnh báo tiền kiểm soát bay.' : 'Preflight warnings detected.')
          : (isVi ? 'Tiền kiểm soát bay hoàn tất, hệ thống an toàn.' : 'Preflight check passed. All systems ready.'));

        const script = isVi
          ? `Kiểm tra an toàn bay. ${summary}`
          : `Preflight safety check. ${summary}`;

        return {
          spokenText: prepareTextForSpeech(script, language),
          tone,
        };
      }

      case 'MISSION_REVIEW': {
        const summary = structuredCard.summary || (isVi ? 'Kế hoạch bay đã sẵn sàng.' : 'Mission plan is ready.');
        const tone: SpeechTone = structuredCard.tone || 'POSITIVE';

        const script = isVi
          ? `Kế hoạch bay. ${summary}`
          : `Mission plan. ${summary}`;

        return {
          spokenText: prepareTextForSpeech(script, language),
          tone,
        };
      }
    }
  }

  // 2. Freeform text processing: Extract concise, natural spoken script
  let text = (rawText || '').trim();

  // Strip thinking tags or metadata
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, ' ');
  text = text.replace(/\[TRẠNG THÁI[^\]]*\]/gi, ' ');
  text = text.replace(/\[CẢNH BÁO[^\]]*\]/gi, ' ');

  // Detect deterministic tone from semantic keywords
  let tone: SpeechTone = 'NORMAL';
  const lower = text.toLowerCase();
  if (
    lower.includes('khẩn cấp') ||
    lower.includes('nguy hiểm') ||
    lower.includes('emergency') ||
    lower.includes('critical') ||
    lower.includes('pin cạn') ||
    lower.includes('mất liên lạc')
  ) {
    tone = 'URGENT';
  } else if (
    lower.includes('cảnh báo') ||
    lower.includes('warning') ||
    lower.includes('caution') ||
    lower.includes('mất 3d fix') ||
    lower.includes('chú ý')
  ) {
    tone = 'CAUTION';
  } else if (
    lower.includes('hoàn thành') ||
    lower.includes('thành công') ||
    lower.includes('sẵn sàng cất cánh') ||
    lower.includes('đã khóa marker') ||
    lower.includes('success') ||
    lower.includes('completed')
  ) {
    tone = 'POSITIVE';
  } else if (
    lower.includes('chế độ') ||
    lower.includes('tình trạng') ||
    lower.includes('vệ tinh') ||
    lower.includes('thông số') ||
    lower.includes('status') ||
    lower.includes('preflight')
  ) {
    tone = 'INFORMATIVE';
  }

  // Remove markdown tables and large lists before splitting sentences
  const nonTableLines = text
    .split('\n')
    .filter(line => !line.trim().startsWith('|') && !line.trim().startsWith('---') && !line.trim().startsWith('==='));
  text = nonTableLines.join(' ');

  // Split into sentences
  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('#') && !s.startsWith('-') && !s.startsWith('*'));

  let conciseScript = '';
  if (sentences.length <= 3) {
    conciseScript = sentences.join(' ');
  } else {
    // Take the 2 most informative sentences
    conciseScript = `${sentences[0]} ${sentences[1]}`;
  }

  // Sanitize formatting and expand telemetry units
  const spokenText = prepareTextForSpeech(conciseScript || text, language);

  return {
    spokenText,
    tone,
  };
}
