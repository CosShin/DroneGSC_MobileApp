import type { RootState } from '../../../store';
import type { SemanticStructuredCard, SpeechTone, SemanticMetricItem } from '../AiTypes';
import { buildSpokenResponse } from '../../voice/SpokenResponseBuilder';
import { SpeechLanguage } from '../../voice/SpeechSanitizer';
import { calculateDistanceMeters, formatDistance } from '../../../utils/geographic';

export interface SemanticProcessingResult {
  displayMessage: string;
  structuredCard: SemanticStructuredCard | null;
  spokenText: string;
  tone: SpeechTone;
}

/**
 * Transforms raw LLM responses into decoupled Semantic UI and Spoken outputs.
 * 
 * Architecture:
 * AI Response
 *     ↓
 * Semantic Response
 *  ├── UI Response (structured cards, visual metric grid, clean Markdown)
 *  └── Spoken Response (natural concise speech, telemetry normalization, deterministic tone)
 */
export function processSemanticResponse(
  rawText: string,
  state?: RootState | null,
  language: SpeechLanguage = 'vi-VN'
): SemanticProcessingResult {
  const isVi = language === 'vi-VN';
  const text = (rawText || '').trim();
  const lower = text.toLowerCase();

  // 1. Camera Analysis Detection
  if (
    lower.includes('camera analysis') ||
    lower.includes('phân tích camera') ||
    lower.includes('hình ảnh phía trước camera') ||
    text.includes('[PHÂN TÍCH THỊ GIÁC]')
  ) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const findings: string[] = [];
    const recommendations: string[] = [];
    let summary = '';
    let readingFindings = false;
    let readingRecs = false;

    for (const line of lines) {
      const lineLower = line.toLowerCase();
      if (lineLower.includes('khuyến nghị') || lineLower.includes('recommendation')) {
        readingRecs = true;
        readingFindings = false;
        continue;
      }
      if (lineLower.includes('phát hiện') || lineLower.includes('findings') || lineLower.includes('quan sát')) {
        readingFindings = true;
        readingRecs = false;
        continue;
      }

      if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
        const cleanBullet = line.replace(/^[•\-*]\s*/, '').replace(/\*\*/g, '').trim();
        if (readingRecs) {
          recommendations.push(cleanBullet);
        } else {
          findings.push(cleanBullet);
        }
      } else if (!summary && !line.startsWith('#') && !line.startsWith('[') && !line.includes('---')) {
        summary = line.replace(/\*\*/g, '').trim();
      }
    }

    if (!summary) {
      summary = isVi
        ? 'Đã hoàn tất phân tích khung hình video camera.'
        : 'Completed camera frame video analysis.';
    }

    const card: SemanticStructuredCard = {
      type: 'CAMERA_ANALYSIS',
      title: 'CAMERA ANALYSIS',
      summary,
      metrics: [
        { label: 'IMAGE QUALITY', value: lower.includes('mờ') || lower.includes('tối') ? 'LOW' : 'NORMAL', tone: 'neutral' },
        { label: 'OBJECTS', value: lower.includes('phát hiện') ? 'DETECTED' : '--', tone: 'neutral' },
        { label: 'OBSTACLES', value: lower.includes('vật cản') || lower.includes('chướng ngại') ? 'DETECTED' : 'NONE', tone: lower.includes('vật cản') ? 'warning' : 'success' },
      ],
      findings: findings.length > 0 ? findings : [
        isVi ? 'Khung hình quan sát phía trước máy bay' : 'Forward-looking camera view',
        isVi ? 'Không phát hiện vật cản nguy hiểm ở cự ly gần' : 'No close-range hazard detected',
      ],
      recommendations: recommendations.length > 0 ? recommendations : [
        isVi ? 'Duy trì độ cao và chú ý môi trường xung quanh' : 'Maintain altitude and monitor surroundings',
      ],
      tone: lower.includes('vật cản') || lower.includes('chướng ngại') ? 'CAUTION' : 'INFORMATIVE',
    };

    const spoken = buildSpokenResponse(text, language, card);
    return {
      displayMessage: text,
      structuredCard: card,
      spokenText: spoken.spokenText,
      tone: card.tone || spoken.tone,
    };
  }

  // 2. Flight Status / Preflight Detection
  if (
    lower.includes('flight status') ||
    lower.includes('tình trạng drone') ||
    lower.includes('trạng thái bay') ||
    lower.includes('preflight') ||
    (lower.includes('chế độ') && lower.includes('pin') && lower.includes('gps'))
  ) {
    // Extract real telemetry from Redux state when available, avoiding fake values
    const drone = state?.drone;
    const telemetry = state?.telemetry;
    const connection = state?.connection;
    const home = state?.home;

    const mode = drone?.flightMode || 'LOITER';
    const isArmed = drone?.armed ?? false;
    const alt = telemetry?.gps?.value.altitude != null ? Number(telemetry.gps.value.altitude.toFixed(1)) : null;
    const batt = telemetry?.battery?.value.percentage != null ? Math.round(telemetry.battery.value.percentage) : null;
    const sats = telemetry?.gps?.value.satellites ?? null;
    const gpsFix = telemetry?.gps?.value.gpsFix ?? 0;
    const isLinkGood = connection?.status === 'CONNECTED' && connection?.vehicleState === 'CONNECTED';

    let homeDist: number | null = null;
    if (home?.position && telemetry?.gps?.value?.latitude != null && telemetry?.gps?.value?.longitude != null) {
      homeDist = Math.round(calculateDistanceMeters(
        home.position.latitude,
        home.position.longitude,
        telemetry.gps.value.latitude,
        telemetry.gps.value.longitude
      ));
    }

    const metrics: SemanticMetricItem[] = [
      { label: 'MODE', value: mode, tone: mode === 'AUTO' ? 'primary' : 'neutral' },
      { label: 'ARMED', value: isArmed ? 'YES' : 'NO', tone: isArmed ? 'danger' : 'neutral' },
      { label: 'ALTITUDE', value: alt != null ? `${alt} m` : '--', tone: 'neutral' },
      { label: 'BATTERY', value: batt != null ? `${batt}%` : '--', tone: batt != null && batt < 25 ? 'danger' : 'success' },
      { label: 'GPS', value: sats != null ? `${sats} SAT · ${gpsFix >= 3 ? '3D FIX' : 'NO FIX'}` : '--', tone: gpsFix >= 3 ? 'success' : 'warning' },
      { label: 'HOME', value: homeDist != null ? `${homeDist} m` : '--', tone: 'neutral' },
      { label: 'LINK', value: isLinkGood ? 'GOOD' : 'WAITING', tone: isLinkGood ? 'success' : 'warning' },
    ];

    const hasWarnings = (batt != null && batt < 25) || (telemetry?.gps != null && gpsFix < 3);
    const tone: SpeechTone = hasWarnings ? 'CAUTION' : 'INFORMATIVE';
    const summary = hasWarnings
      ? (isVi ? 'Phát hiện cảnh báo hệ thống: Hãy chú ý mức pin hoặc tín hiệu GPS.' : 'System warning: Check battery level or GPS signal.')
      : (isVi ? 'Chuyến bay hiện ổn định. Chưa phát hiện cảnh báo cần xử lý.' : 'Flight is currently stable. No active warnings.');

    const card: SemanticStructuredCard = {
      type: 'FLIGHT_STATUS',
      title: 'FLIGHT STATUS',
      metrics,
      summary,
      tone,
    };

    const spoken = buildSpokenResponse(text, language, card);
    return {
      displayMessage: text,
      structuredCard: card,
      spokenText: spoken.spokenText,
      tone,
    };
  }

  // 3. System Warning Detection
  if (
    lower.includes('cảnh báo:') ||
    lower.includes('cảnh báo giám sát') ||
    lower.includes('warning:') ||
    lower.includes('prearm:') ||
    text.includes('⚠️')
  ) {
    const cleanSummary = text.replace(/^[⚠️\s*#\-]+/, '').replace(/\[CẢNH BÁO[^\]]*\]/gi, '').trim();
    const tone: SpeechTone = lower.includes('khẩn cấp') || lower.includes('critical') ? 'URGENT' : 'CAUTION';

    const card: SemanticStructuredCard = {
      type: 'WARNING',
      title: tone === 'URGENT' ? 'CẢNH BÁO KHẨN CẤP' : 'CẢNH BÁO HỆ THỐNG',
      summary: cleanSummary,
      recommendations: [
        isVi ? 'Kiểm tra thông số trên màn hình bay' : 'Verify telemetry on flight display',
        isVi ? 'Cân nhắc hạ cánh hoặc quay về Home nếu cần' : 'Consider landing or RTL if necessary',
      ],
      tone,
    };

    const spoken = buildSpokenResponse(cleanSummary, language, card);
    return {
      displayMessage: text,
      structuredCard: card,
      spokenText: spoken.spokenText,
      tone,
    };
  }

  // 4. Freeform / General Q&A
  const spoken = buildSpokenResponse(text, language, null);
  return {
    displayMessage: text,
    structuredCard: null,
    spokenText: spoken.spokenText,
    tone: spoken.tone,
  };
}
