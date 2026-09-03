import { FlightMode } from '../../../types/command';
import { isValidCoordinate } from '../../../utils/geographic';
import type {
  AiActionProposal,
  AiIntentParameters,
  AiIntentType,
  AiStructuredResponse,
  MissionProposalParams,
  MissionWaypointProposal,
} from './AiIntentTypes';

const SUPPORTED_COPTER_MODES = new Set<string>([
  FlightMode.STABILIZE,
  FlightMode.ALT_HOLD,
  FlightMode.LOITER,
  FlightMode.POSHOLD,
  FlightMode.GUIDED,
  FlightMode.AUTO,
  FlightMode.RTL,
  FlightMode.LAND,
]);

const HOLD_CONFIRM_INTENTS = new Set<AiIntentType>([
  'ARM',
  'DISARM',
  'TAKEOFF',
  'START_MISSION',
]);

let proposalCounter = 0;
function generateProposalId(): string {
  return `ai-prop-${Date.now()}-${++proposalCounter}`;
}

export class AiIntentParser {
  /**
   * Parses raw AI response into a user-facing text message and an optional
   * strictly-validated action proposal.
   */
  parse(rawText: string, vehicleSessionId?: string | null): AiStructuredResponse {
    if (!rawText || typeof rawText !== 'string') {
      return { message: '', requiresConfirmation: false, proposal: null };
    }

    // 1. Try to extract embedded JSON block if present
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let parsedJson: any = null;

    if (jsonMatch) {
      try {
        parsedJson = JSON.parse(jsonMatch[1].trim());
      } catch {
        parsedJson = null;
      }
    } else if (rawText.trim().startsWith('{') && rawText.trim().endsWith('}')) {
      try {
        parsedJson = JSON.parse(rawText.trim());
      } catch {
        parsedJson = null;
      }
    }

    // If a JSON block was found with structured intent
    if (parsedJson && typeof parsedJson === 'object') {
      const intentCandidate = parsedJson.intent || parsedJson;
      const intentType = (
        typeof intentCandidate.type === 'string'
          ? intentCandidate.type
          : typeof intentCandidate.intent === 'string'
          ? intentCandidate.intent
          : ''
      ).toUpperCase() as AiIntentType;

      const validatedParams = this.validateParameters(intentType, intentCandidate.parameters || intentCandidate);
      
      // Clean user message without the raw JSON block
      let displayMessage = typeof parsedJson.message === 'string' && parsedJson.message.trim()
        ? parsedJson.message.trim()
        : rawText.replace(/```(?:json)?[\s\S]*?```/g, '').trim();

      if (!displayMessage && validatedParams) {
        displayMessage = this.getDefaultProposalMessage(validatedParams);
      }

      if (validatedParams && validatedParams.type !== 'UNKNOWN') {
        const proposal = this.createProposal(validatedParams, vehicleSessionId);
        return {
          message: displayMessage,
          proposal,
          requiresConfirmation: proposal.requiresConfirmation,
        };
      }

      // JSON present but invalid parameters -> reject intent, retain text message
      return {
        message: displayMessage || rawText,
        proposal: null,
        requiresConfirmation: false,
      };
    }

    // If no JSON block, natural conversation only
    return {
      message: rawText,
      proposal: null,
      requiresConfirmation: false,
    };
  }

  /**
   * Deterministically validates parameters according to safety rules.
   * If any parameter is missing, non-finite, out of bounds, or malformed,
   * returns null (intent rejected).
   */
  validateParameters(type: AiIntentType, rawParams: any): AiIntentParameters | null {
    if (!type || typeof type !== 'string') return null;
    const p = rawParams && typeof rawParams === 'object' ? rawParams : {};

    switch (type) {
      case 'ARM':
        return { type: 'ARM' };

      case 'DISARM':
        return { type: 'DISARM' };

      case 'TAKEOFF': {
        const alt = Number(p.altitudeMeters ?? p.altitude ?? p.alt);
        if (!Number.isFinite(alt) || alt < 1 || alt > 120) {
          return null; // Reject malformed altitude
        }
        return { type: 'TAKEOFF', altitudeMeters: Math.round(alt * 10) / 10 };
      }

      case 'LAND':
        return { type: 'LAND' };

      case 'RTL':
        return { type: 'RTL' };

      case 'SET_MODE': {
        const rawMode = String(p.mode || p.flightMode || '').trim().toUpperCase();
        if (!SUPPORTED_COPTER_MODES.has(rawMode)) {
          return null;
        }
        return { type: 'SET_MODE', mode: rawMode as FlightMode };
      }

      case 'SET_HOME': {
        const useCurrent = Boolean(p.useCurrent);
        if (useCurrent) {
          return { type: 'SET_HOME', useCurrent: true };
        }
        const lat = Number(p.latitude ?? p.lat);
        const lon = Number(p.longitude ?? p.lon ?? p.lng);
        const alt = p.altitude != null ? Number(p.altitude) : undefined;
        if (!isValidCoordinate(lat, lon)) {
          return null;
        }
        return { type: 'SET_HOME', useCurrent: false, latitude: lat, longitude: lon, altitude: alt };
      }

      case 'GOTO': {
        const lat = Number(p.latitude ?? p.lat);
        const lon = Number(p.longitude ?? p.lon ?? p.lng);
        const alt = Number(p.altitudeMeters ?? p.altitude ?? 15);
        if (!isValidCoordinate(lat, lon) || !Number.isFinite(alt) || alt <= 0 || alt > 120) {
          return null;
        }
        return { type: 'GOTO', latitude: lat, longitude: lon, altitudeMeters: alt };
      }

      case 'CREATE_MISSION': {
        const proposal = this.validateMissionProposal(p.proposal || p);
        if (!proposal) return null;
        return { type: 'CREATE_MISSION', proposal };
      }

      case 'UPLOAD_MISSION':
        return { type: 'UPLOAD_MISSION' };

      case 'START_MISSION':
        return { type: 'START_MISSION' };

      case 'PAUSE_MISSION':
        return { type: 'PAUSE_MISSION' };

      case 'RESUME_MISSION':
        return { type: 'RESUME_MISSION' };

      case 'PREFLIGHT_CHECK':
        return { type: 'PREFLIGHT_CHECK' };

      case 'VEHICLE_STATUS':
        return { type: 'VEHICLE_STATUS' };

      case 'MAVLINK_CHECK':
        return { type: 'MAVLINK_CHECK' };

      case 'MISSION_REVIEW':
        return { type: 'MISSION_REVIEW' };

      case 'DESCRIBE_VIDEO':
        return { type: 'DESCRIBE_VIDEO', prompt: typeof p.prompt === 'string' ? p.prompt : undefined };

      case 'ANALYZE_LANDING_AREA':
        return { type: 'ANALYZE_LANDING_AREA' };

      default:
        return null;
    }
  }

  private validateMissionProposal(p: any): MissionProposalParams | null {
    if (!p || typeof p !== 'object') return null;

    const takeoffAlt = Number(p.takeoffAltitudeMeters ?? p.takeoffAltitude ?? 20);
    if (!Number.isFinite(takeoffAlt) || takeoffAlt < 2 || takeoffAlt > 120) return null;

    const speed = p.speedMetersPerSecond != null ? Number(p.speedMetersPerSecond) : undefined;
    if (speed !== undefined && (!Number.isFinite(speed) || speed < 0.5 || speed > 25)) return null;

    if (!Array.isArray(p.waypoints) || p.waypoints.length === 0 || p.waypoints.length > 100) return null;

    const validWaypoints: MissionWaypointProposal[] = [];
    for (const wp of p.waypoints) {
      const lat = Number(wp.latitude ?? wp.lat);
      const lon = Number(wp.longitude ?? wp.lon ?? wp.lng);
      const alt = Number(wp.altitudeMeters ?? wp.altitude ?? takeoffAlt);

      if (!isValidCoordinate(lat, lon) || !Number.isFinite(alt) || alt < 1 || alt > 150) {
        return null; // Reject entire mission if any waypoint is invalid
      }

      validWaypoints.push({
        latitude: lat,
        longitude: lon,
        altitudeMeters: Math.round(alt * 10) / 10,
        speedMetersPerSecond: wp.speedMetersPerSecond ? Number(wp.speedMetersPerSecond) : undefined,
        delaySeconds: wp.delaySeconds ? Number(wp.delaySeconds) : undefined,
      });
    }

    const endAction = ['RTL', 'LAND', 'HOLD'].includes(p.endAction) ? p.endAction : 'RTL';

    return {
      takeoffAltitudeMeters: takeoffAlt,
      speedMetersPerSecond: speed,
      waypoints: validWaypoints,
      endAction,
    };
  }

  private createProposal(intent: AiIntentParameters, vehicleSessionId?: string | null): AiActionProposal {
    const isHoldRequired = HOLD_CONFIRM_INTENTS.has(intent.type);
    const { title, description } = this.getProposalDisplayInfo(intent);

    return {
      id: generateProposalId(),
      intent,
      requiresConfirmation: true,
      requiresHoldConfirmation: isHoldRequired,
      title,
      description,
      state: 'WAITING_CONFIRMATION',
      proposedAt: Date.now(),
      vehicleSessionId: vehicleSessionId ?? null,
    };
  }

  private getProposalDisplayInfo(intent: AiIntentParameters): { title: string; description: string } {
    switch (intent.type) {
      case 'ARM':
        return { title: 'ARM VEHICLE', description: 'Kích hoạt động cơ máy bay. Đảm bảo khu vực cánh quạt an toàn.' };
      case 'DISARM':
        return { title: 'DISARM VEHICLE', description: 'Tắt động cơ máy bay. Chỉ thực hiện khi đã tiếp đất an toàn.' };
      case 'TAKEOFF':
        return {
          title: `TAKEOFF (${intent.altitudeMeters}m)`,
          description: `Tự động cất cánh lên độ cao ${intent.altitudeMeters}m ở chế độ GUIDED.`,
        };
      case 'LAND':
        return { title: 'LAND VEHICLE', description: 'Hạ cánh thẳng đứng tại vị trí hiện tại.' };
      case 'RTL':
        return { title: 'RETURN TO LAUNCH (RTL)', description: 'Bay về điểm Home đã ghi nhận và hạ cánh an toàn.' };
      case 'SET_MODE':
        return {
          title: `CHUYỂN CHẾ ĐỘ ${intent.mode}`,
          description: `Yêu cầu chuyển chế độ bay sang ${intent.mode}.`,
        };
      case 'SET_HOME':
        return {
          title: 'SET HOME POSITION',
          description: intent.useCurrent ? 'Cài đặt Home tại vị trí GPS hiện tại của máy bay.' : 'Cài đặt tọa độ Home mới.',
        };
      case 'GOTO':
        return {
          title: 'GOTO POINT',
          description: `Bay đến tọa độ (${intent.latitude.toFixed(6)}, ${intent.longitude.toFixed(6)}) ở độ cao ${intent.altitudeMeters}m.`,
        };
      case 'CREATE_MISSION':
        return {
          title: 'KẾ HOẠCH BAY AI PROPOSAL',
          description: `Tạo kế hoạch ${intent.proposal.waypoints.length} điểm bay, cất cánh ${intent.proposal.takeoffAltitudeMeters}m.`,
        };
      case 'START_MISSION':
        return { title: 'BẮT ĐẦU BAY MISSION', description: 'Chuyển sang chế độ AUTO để bắt đầu thực thi nhiệm vụ bay.' };
      default:
        return { title: `YÊU CẦU: ${intent.type}`, description: 'Yêu cầu hành động từ AI Copilot.' };
    }
  }

  private getDefaultProposalMessage(intent: AiIntentParameters): string {
    switch (intent.type) {
      case 'ARM': return 'Tôi đã tạo yêu cầu ARM máy bay. Hãy xác nhận trên màn hình.';
      case 'DISARM': return 'Tôi đã tạo yêu cầu DISARM máy bay. Hãy xác nhận trên màn hình.';
      case 'TAKEOFF': return `Tôi đã tạo yêu cầu cất cánh lên ${intent.altitudeMeters} mét. Hãy xác nhận trên màn hình.`;
      case 'RTL': return 'Tôi đã tạo yêu cầu quay về điểm Home (RTL). Hãy xác nhận trên màn hình.';
      case 'LAND': return 'Tôi đã tạo yêu cầu hạ cánh. Hãy xác nhận trên màn hình.';
      case 'SET_MODE': return `Tôi đã tạo yêu cầu chuyển sang chế độ ${intent.mode}. Hãy xác nhận trên màn hình.`;
      case 'CREATE_MISSION': return `Tôi đã xây dựng kế hoạch bay gồm ${intent.proposal.waypoints.length} điểm. Vui lòng xem trước và xác nhận nạp mission.`;
      default: return `Tôi đã tạo yêu cầu ${intent.type}. Vui lòng xác nhận trên màn hình.`;
    }
  }
}

export const aiIntentParser = new AiIntentParser();
