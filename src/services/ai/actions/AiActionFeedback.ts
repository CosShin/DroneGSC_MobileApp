import type { AiActionLifecycle, AiActionProposal } from '../intents/AiIntentTypes';

export interface AiActionFailurePresentation {
  state: AiActionLifecycle;
  title: string;
  reason: string;
  technical: string | null;
}

function stripPreArmPrefix(error: string) {
  return error.replace(/^prearm:\s*/i, '').trim();
}

function humanizePreArmReason(raw: string) {
  const reason = stripPreArmPrefix(raw);
  if (/rc\s+not\s+found/i.test(reason)) {
    return 'RC chưa được phát hiện.';
  }
  if (/gps/i.test(reason)) {
    return 'GPS chưa đạt điều kiện Pre-Arm.';
  }
  if (/compass/i.test(reason)) {
    return 'Compass chưa đạt điều kiện Pre-Arm.';
  }
  if (/battery/i.test(reason)) {
    return 'Pin chưa đạt điều kiện Pre-Arm.';
  }
  return reason || 'Kiểm tra Pre-Arm chưa đạt.';
}

function humanizeCommandError(error: string | null | undefined) {
  if (!error) return 'Autopilot chưa trả về lý do cụ thể.';
  if (/MAV_RESULT_1/.test(error)) return 'Autopilot đang tạm thời từ chối lệnh.';
  if (/MAV_RESULT_2/.test(error)) return 'Autopilot từ chối lệnh.';
  if (/MAV_RESULT_10/.test(error)) return 'GCS hiện không có quyền điều khiển lệnh này.';
  if (/TIMEOUT|VEHICLE_CONFIRMATION_TIMEOUT|COMMAND_TIMEOUT/.test(error)) return 'Đã gửi lệnh nhưng chưa nhận được xác nhận từ flight controller.';
  if (/NO_FRESH_VEHICLE_CONNECTED/.test(error)) return 'Chưa có vehicle heartbeat tươi nên không thể gửi lệnh.';
  if (/HEARTBEAT_STALE|TIMEOUT/.test(error)) return 'Heartbeat vehicle đã stale hoặc timeout.';
  if (/TELEMETRY_STALE/.test(error)) return 'Telemetry đang stale nên lệnh bị chặn.';
  if (/DISARM_BLOCKED_VEHICLE_AIRBORNE/.test(error)) return 'Drone đang ở trên không, DISARM có thể dừng động cơ ngay.';
  if (/DRONE_MUST_BE_ARMED_BEFORE_TAKEOFF/.test(error)) return 'Drone cần ARM trước khi TAKEOFF.';
  if (/TAKEOFF_REQUIRES_GUIDED_MODE/.test(error)) return 'TAKEOFF cần mode GUIDED.';
  return error.replace(/_/g, ' ').toLowerCase();
}

export function classifyAiActionFailure(
  proposal: AiActionProposal,
  recentWarnings: readonly string[] = [],
): AiActionFailurePresentation | null {
  const rawError = proposal.error ?? null;
  const preArm = [rawError, ...recentWarnings].find(item => typeof item === 'string' && /^prearm:/i.test(item.trim()));
  if (proposal.intent.type === 'ARM' && preArm) {
    return {
      state: 'PREARM_FAILED',
      title: 'Không thể ARM',
      reason: humanizePreArmReason(preArm),
      technical: preArm,
    };
  }

  if (!rawError) return null;

  const state: AiActionLifecycle = /TIMEOUT|VEHICLE_CONFIRMATION_TIMEOUT|COMMAND_TIMEOUT/i.test(rawError)
    ? 'TIMEOUT'
    : /MAV_RESULT_1|MAV_RESULT_2|MAV_RESULT_10|DENIED|REJECTED/i.test(rawError)
    ? 'COMMAND_DENIED'
    : 'FAILED';

  return {
    state,
    title: state === 'TIMEOUT'
      ? `${proposal.intent.type} chưa có xác nhận`
      : `${proposal.intent.type} chưa thành công`,
    reason: humanizeCommandError(rawError),
    technical: rawError,
  };
}

export function buildAiActionNaturalStatus(
  proposal: AiActionProposal,
  presentation: AiActionFailurePresentation | null,
) {
  if (presentation) return `${presentation.title}: ${presentation.reason}`;
  switch (proposal.state) {
    case 'WAITING_CONFIRMATION':
      return 'Đang chờ phi công xác nhận.';
    case 'VALIDATING':
      return 'Đang kiểm tra an toàn.';
    case 'SENDING':
      return 'Đang gửi lệnh.';
    case 'WAITING_ACK':
      return 'Đang chờ flight controller xác nhận.';
    case 'SUCCESS':
    case 'ACKNOWLEDGED':
      return `${proposal.intent.type} thành công.`;
    case 'CANCELLED':
      return 'Đã hủy lệnh.';
    default:
      return null;
  }
}
