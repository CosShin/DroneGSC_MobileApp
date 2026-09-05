import type { SemanticMetricItem, SemanticStructuredCard, SpeechTone } from './AiTypes';
import type { AniToolSnapshot } from './AniToolbox';
import { buildSpokenResponse } from '../voice/SpokenResponseBuilder';
import { flightEventRecorder, type FlightEventRecorder } from './FlightEventRecorder';

type DiagnosticTone = NonNullable<SemanticMetricItem['tone']>;
type DiagnosticState = 'PASS' | 'WARNING' | 'FAIL' | 'NO DATA';

interface DiagnosticRow {
  label: string;
  state: DiagnosticState;
  value: string;
  detail?: string;
}

export interface AniDeterministicResponse {
  content: string;
  structuredCard: SemanticStructuredCard;
  spokenText: string;
  tone: SpeechTone;
}

function rowTone(state: DiagnosticState): DiagnosticTone {
  if (state === 'PASS') return 'success';
  if (state === 'WARNING') return 'warning';
  if (state === 'FAIL') return 'danger';
  return 'neutral';
}

function metric(row: DiagnosticRow): SemanticMetricItem {
  return { label: row.label, value: `${row.state}${row.value ? ` · ${row.value}` : ''}`, tone: rowTone(row.state) };
}

function fmt(value: number | null | undefined, unit = ''): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return `${value}${unit}`;
}

function gpsLabel(fixType: number | null | undefined) {
  if (fixType == null) return '--';
  if (fixType >= 3) return '3D FIX';
  if (fixType === 2) return '2D FIX';
  return 'NO FIX';
}

export function evaluateSystemHealth(snapshot: AniToolSnapshot): DiagnosticRow[] {
  const ctx = snapshot.flightContext;
  const heartbeatAge = ctx.connection.heartbeatAgeMs;
  const battery = ctx.battery?.percentage ?? null;
  const gpsFix = ctx.gps?.fixType ?? null;
  const sats = ctx.gps?.satellites ?? null;
  const ekf = ctx.sensors.find(s => /ekf|estimator/i.test(s.name));

  return [
    {
      label: 'Vehicle',
      state: ctx.vehicle.connected ? 'PASS' : ctx.connection.mavlinkState === 'ACTIVE' ? 'WARNING' : 'NO DATA',
      value: ctx.vehicle.connected ? `${ctx.vehicle.mode}` : ctx.connection.vehicleState,
      detail: ctx.vehicle.connected ? undefined : 'No fresh vehicle heartbeat confirmed.',
    },
    {
      label: 'MAVLink',
      state: ctx.connection.mavlinkState === 'ACTIVE' && (heartbeatAge == null || heartbeatAge < 2000) ? 'PASS' : ctx.connection.mavlinkState === 'HEARTBEAT_LOST' ? 'FAIL' : 'WARNING',
      value: `RX ${ctx.mavlink.rxPps} pps, HB ${fmt(heartbeatAge, ' ms')}`,
    },
    {
      label: 'Battery',
      state: battery == null ? 'NO DATA' : battery < 20 ? 'FAIL' : battery < 30 ? 'WARNING' : 'PASS',
      value: battery == null ? '--' : `${battery}%`,
    },
    {
      label: 'GPS',
      state: gpsFix == null ? 'NO DATA' : gpsFix >= 3 && (sats ?? 0) >= 6 ? 'PASS' : 'WARNING',
      value: `${gpsLabel(gpsFix)}${sats != null ? `, ${sats} sats` : ''}`,
    },
    {
      label: 'EKF',
      state: ekf ? (ekf.health === 'GOOD' ? 'PASS' : ekf.health === 'CRITICAL' ? 'FAIL' : 'WARNING') : 'NO DATA',
      value: ekf?.value ?? ekf?.message ?? '--',
    },
    {
      label: 'Home',
      state: ctx.home.isSet ? 'PASS' : 'WARNING',
      value: ctx.home.isSet ? `${fmt(ctx.home.distanceMeters, ' m')} away` : 'not set',
    },
    {
      label: 'Video',
      state: snapshot.video.status === 'LIVE' ? 'PASS' : snapshot.video.status === 'ERROR' ? 'FAIL' : 'NO DATA',
      value: snapshot.video.status,
      detail: snapshot.video.lastError ?? undefined,
    },
    {
      label: 'Joystick',
      state: ctx.vehicle.connected ? 'PASS' : 'NO DATA',
      value: ctx.vehicle.connected ? 'control link available' : 'no live control diagnostics',
    },
  ];
}

function buildCard(type: SemanticStructuredCard['type'], title: string, rows: DiagnosticRow[], summary: string, tone: SpeechTone): SemanticStructuredCard {
  const findings = rows.filter(r => r.state === 'FAIL' || r.state === 'WARNING').map(r => `${r.label}: ${r.detail ?? r.value}`);
  return {
    type,
    title,
    metrics: rows.map(metric),
    summary,
    warnings: findings.length ? findings : undefined,
    tone,
  };
}

function finish(content: string, card: SemanticStructuredCard, tone: SpeechTone): AniDeterministicResponse {
  return {
    content,
    structuredCard: card,
    spokenText: buildSpokenResponse(content, 'vi-VN', card).spokenText,
    tone,
  };
}

export function buildWhatsHappening(snapshot: AniToolSnapshot): AniDeterministicResponse {
  const ctx = snapshot.flightContext;
  const rows: DiagnosticRow[] = [
    { label: 'Mode', state: ctx.vehicle.connected ? 'PASS' : 'NO DATA', value: ctx.vehicle.connected ? ctx.vehicle.mode : '--' },
    { label: 'Armed', state: ctx.vehicle.connected ? 'PASS' : 'NO DATA', value: ctx.vehicle.connected ? (ctx.vehicle.armed ? 'YES' : 'NO') : '--' },
    { label: 'Altitude', state: ctx.flight.altitude != null ? 'PASS' : 'NO DATA', value: fmt(ctx.flight.altitude, ' m') },
    { label: 'Battery', state: ctx.battery?.percentage == null ? 'NO DATA' : ctx.battery.percentage < 30 ? 'WARNING' : 'PASS', value: ctx.battery?.percentage == null ? '--' : `${ctx.battery.percentage}%` },
    { label: 'GPS', state: ctx.gps?.fixType == null ? 'NO DATA' : ctx.gps.fixType >= 3 ? 'PASS' : 'WARNING', value: `${gpsLabel(ctx.gps?.fixType)}${ctx.gps?.satellites != null ? `, ${ctx.gps.satellites} sats` : ''}` },
    { label: 'Link', state: ctx.connection.vehicleState === 'CONNECTED' ? 'PASS' : ctx.connection.mavlinkState === 'HEARTBEAT_LOST' ? 'FAIL' : 'WARNING', value: `${ctx.connection.mavlinkState}, HB ${fmt(ctx.connection.heartbeatAgeMs, ' ms')}` },
    { label: 'Video', state: snapshot.video.status === 'LIVE' ? 'PASS' : snapshot.video.status === 'ERROR' ? 'FAIL' : 'NO DATA', value: snapshot.video.status },
  ];
  const hasWarnings = rows.some(r => r.state === 'WARNING' || r.state === 'FAIL');
  const summary = ctx.vehicle.connected
    ? `Drone đang ở ${ctx.vehicle.mode}. Pin ${ctx.battery?.percentage != null ? `${ctx.battery.percentage}%` : 'chưa có dữ liệu'}, GPS ${gpsLabel(ctx.gps?.fixType)}, heartbeat ${fmt(ctx.connection.heartbeatAgeMs, ' ms')}.`
    : 'Hiện chưa có heartbeat vehicle tươi, nên ANI không thể xác nhận trạng thái bay hiện tại.';
  const card = buildCard('FLIGHT_STATUS', "WHAT'S HAPPENING", rows, summary, hasWarnings ? 'CAUTION' : 'INFORMATIVE');
  return finish(summary, card, card.tone ?? 'INFORMATIVE');
}

export function buildHealthCheck(snapshot: AniToolSnapshot): AniDeterministicResponse {
  const rows = evaluateSystemHealth(snapshot);
  const issues = rows.filter(r => r.state === 'FAIL' || r.state === 'WARNING');
  const noData = rows.filter(r => r.state === 'NO DATA');
  const tone: SpeechTone = issues.some(r => r.state === 'FAIL') ? 'URGENT' : issues.length ? 'CAUTION' : 'POSITIVE';
  const summary = `${issues.length} issue(s), ${noData.length} unavailable metric(s). ${issues.length ? 'Không đạt READY.' : 'Các mục có dữ liệu đều ổn.'}`;
  const card = buildCard('SYSTEM_HEALTH', 'ANI HEALTH CHECK', rows, summary, tone);
  return finish(`ANI HEALTH CHECK\n${summary}`, card, tone);
}

export function buildPreflight(snapshot: AniToolSnapshot): AniDeterministicResponse {
  const rows = evaluateSystemHealth(snapshot).filter(row => row.label !== 'Video' && row.label !== 'Joystick');
  const hasFail = rows.some(r => r.state === 'FAIL' || r.state === 'NO DATA');
  const hasWarn = rows.some(r => r.state === 'WARNING');
  const tone: SpeechTone = hasFail ? 'URGENT' : hasWarn ? 'CAUTION' : 'POSITIVE';
  const summary = hasFail || hasWarn ? 'NOT READY. Cần xử lý các mục cảnh báo trước khi bay.' : 'READY. Các điều kiện tiền kiểm có dữ liệu đều đạt.';
  const card = buildCard('PREFLIGHT_CHECK', 'PRE-FLIGHT', rows, summary, tone);
  return finish(`PRE-FLIGHT\n${summary}`, card, tone);
}

export function buildArmDiagnostics(snapshot: AniToolSnapshot): AniDeterministicResponse {
  const ctx = snapshot.flightContext;
  const rows: DiagnosticRow[] = [
    { label: 'Vehicle', state: ctx.vehicle.connected ? 'PASS' : 'FAIL', value: ctx.vehicle.connected ? 'connected' : ctx.connection.vehicleState },
    { label: 'Already armed', state: ctx.vehicle.armed ? 'WARNING' : 'PASS', value: ctx.vehicle.armed ? 'YES' : 'NO' },
    { label: 'Battery', state: ctx.battery?.percentage == null ? 'NO DATA' : ctx.battery.percentage < 20 ? 'FAIL' : ctx.battery.percentage < 30 ? 'WARNING' : 'PASS', value: ctx.battery?.percentage == null ? '--' : `${ctx.battery.percentage}%` },
    { label: 'GPS 3D Fix', state: ctx.gps?.fixType == null ? 'NO DATA' : ctx.gps.fixType >= 3 ? 'PASS' : 'FAIL', value: gpsLabel(ctx.gps?.fixType) },
    { label: 'PreArm text', state: ctx.warnings.length ? 'FAIL' : 'PASS', value: ctx.warnings[0] ?? 'none' },
  ];
  const blockers = rows.filter(r => r.state === 'FAIL').map(r => `${r.label}: ${r.value}`);
  const tone: SpeechTone = blockers.length ? 'URGENT' : rows.some(r => r.state !== 'PASS') ? 'CAUTION' : 'POSITIVE';
  const summary = blockers.length
    ? `ARM BLOCKED. ${blockers.join('; ')}.`
    : 'Không thấy blocker ARM trong dữ liệu hiện có. Nếu Pixhawk vẫn từ chối ARM, cần đọc STATUSTEXT/PreArm mới hơn.';
  const card = buildCard('ARM_DIAG', 'WHY CAN’T I ARM?', rows, summary, tone);
  return finish(summary, card, tone);
}

export function buildConnectionDoctor(snapshot: AniToolSnapshot): AniDeterministicResponse {
  const ctx = snapshot.flightContext;
  const rows: DiagnosticRow[] = [
    { label: 'Network', state: ctx.connection.networkState === 'BOUND' ? 'PASS' : ctx.connection.networkState === 'ERROR' ? 'FAIL' : 'WARNING', value: ctx.connection.networkState },
    { label: 'Transport', state: ctx.connection.transport ? 'PASS' : 'NO DATA', value: `${ctx.connection.transport} ${ctx.connection.portInfo}` },
    { label: 'MAVLink RX', state: ctx.mavlink.rxPps > 0 ? 'PASS' : 'WARNING', value: `${ctx.mavlink.rxPps} pps` },
    { label: 'Parser CRC', state: ctx.mavlink.crcErrors > 0 ? 'WARNING' : 'PASS', value: `${ctx.mavlink.crcErrors} CRC errors` },
    { label: 'Heartbeat', state: ctx.connection.mavlinkState === 'ACTIVE' ? 'PASS' : ctx.connection.mavlinkState === 'HEARTBEAT_LOST' ? 'FAIL' : 'WARNING', value: fmt(ctx.connection.heartbeatAgeMs, ' ms') },
    { label: 'Vehicle', state: ctx.vehicle.connected ? 'PASS' : 'FAIL', value: ctx.connection.vehicleState },
    { label: 'Video', state: snapshot.video.status === 'LIVE' ? 'PASS' : snapshot.video.status === 'ERROR' ? 'FAIL' : 'NO DATA', value: snapshot.video.status },
  ];
  const firstFail = rows.find(r => r.state === 'FAIL' || r.state === 'WARNING');
  const tone: SpeechTone = rows.some(r => r.state === 'FAIL') ? 'URGENT' : rows.some(r => r.state === 'WARNING') ? 'CAUTION' : 'POSITIVE';
  const summary = firstFail
    ? `Connection Doctor: điểm cần chú ý đầu tiên là ${firstFail.label} (${firstFail.value}).`
    : 'Connection Doctor: iPhone, transport, MAVLink, heartbeat và vehicle đều có tín hiệu tốt.';
  const card = buildCard('CONNECTION_DIAG', 'CONNECTION DOCTOR', rows, summary, tone);
  return finish(summary, card, tone);
}

export function buildMavlinkDoctor(snapshot: AniToolSnapshot): AniDeterministicResponse {
  const ctx = snapshot.flightContext;
  const rows: DiagnosticRow[] = [
    { label: 'HEARTBEAT', state: ctx.connection.heartbeatAgeMs != null && ctx.connection.heartbeatAgeMs < 2000 ? 'PASS' : 'WARNING', value: fmt(ctx.connection.heartbeatAgeMs, ' ms') },
    { label: 'RX', state: ctx.mavlink.rxPps > 0 ? 'PASS' : 'WARNING', value: `${ctx.mavlink.rxPps} pps` },
    { label: 'TX', state: ctx.mavlink.txPps >= 0 ? 'PASS' : 'NO DATA', value: `${ctx.mavlink.txPps} pps` },
    { label: 'CRC errors', state: ctx.mavlink.crcErrors > 0 ? 'WARNING' : 'PASS', value: String(ctx.mavlink.crcErrors) },
    { label: 'Dropped', state: ctx.mavlink.dropped > 0 ? 'WARNING' : 'PASS', value: String(ctx.mavlink.dropped) },
    { label: 'Reconnects', state: ctx.mavlink.reconnectCount > 0 ? 'WARNING' : 'PASS', value: String(ctx.mavlink.reconnectCount) },
  ];
  const topRates = ctx.mavlink.topRates.map(r => `${r.name}: ${r.rateHz} Hz`).join(', ');
  const tone: SpeechTone = rows.some(r => r.state === 'WARNING' || r.state === 'FAIL') ? 'CAUTION' : 'POSITIVE';
  const summary = `MAVLink RX ${ctx.mavlink.rxPps} pps, TX ${ctx.mavlink.txPps} pps, heartbeat ${fmt(ctx.connection.heartbeatAgeMs, ' ms')}.${topRates ? ` Top rates: ${topRates}.` : ''}`;
  const card = buildCard('MAVLINK_DIAG', 'MAVLINK DOCTOR', rows, summary, tone);
  return finish(summary, card, tone);
}

function fmtDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '--';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function buildFlightDebrief(
  snapshot: AniToolSnapshot,
  recorder: FlightEventRecorder = flightEventRecorder,
): AniDeterministicResponse {
  const ctx = snapshot.flightContext;
  recorder.recordSnapshot(snapshot);
  const summaryData = recorder.getSummary(snapshot.capturedAt);
  const rows: DiagnosticRow[] = [
    { label: 'Flight time', state: summaryData.flightTimeMs != null ? 'PASS' : 'NO DATA', value: fmtDuration(summaryData.flightTimeMs) },
    { label: 'Distance', state: summaryData.distanceMeters != null ? 'PASS' : 'NO DATA', value: fmt(summaryData.distanceMeters, ' m') },
    { label: 'Max altitude', state: summaryData.maxAltitudeMeters != null ? 'PASS' : 'NO DATA', value: fmt(summaryData.maxAltitudeMeters, ' m') },
    { label: 'Lowest battery', state: summaryData.minBatteryPercent != null ? summaryData.minBatteryPercent < 30 ? 'WARNING' : 'PASS' : 'NO DATA', value: summaryData.minBatteryPercent != null ? `${summaryData.minBatteryPercent}%` : '--' },
    { label: 'Minimum GPS', state: summaryData.minGpsFixType == null && summaryData.minGpsSatellites == null ? 'NO DATA' : (summaryData.minGpsFixType ?? 0) >= 3 && (summaryData.minGpsSatellites ?? 0) >= 6 ? 'PASS' : 'WARNING', value: summaryData.minGpsFixType == null && summaryData.minGpsSatellites == null ? '--' : `${gpsLabel(summaryData.minGpsFixType)}${summaryData.minGpsSatellites != null ? `, ${summaryData.minGpsSatellites} sats` : ''}` },
    { label: 'Connection events', state: summaryData.connectionEvents.some(e => e.severity === 'CRITICAL') ? 'FAIL' : summaryData.connectionEvents.some(e => e.severity === 'WARNING') ? 'WARNING' : summaryData.connectionEvents.length ? 'PASS' : 'NO DATA', value: summaryData.connectionEvents.length ? String(summaryData.connectionEvents.length) : '--' },
    { label: 'Mode changes', state: summaryData.modeChanges.length ? 'PASS' : 'NO DATA', value: summaryData.modeChanges.length ? String(summaryData.modeChanges.length) : '--' },
    { label: 'Warnings', state: summaryData.warnings.length || ctx.warnings.length ? 'WARNING' : 'PASS', value: summaryData.warnings.length ? summaryData.warnings.slice(-2).map(e => e.message).join('; ') : ctx.warnings.length ? ctx.warnings.slice(0, 2).join('; ') : 'none' },
  ];
  const summary = summaryData.events.length > 1
    ? `Flight Debrief dùng ${summaryData.events.length} sự kiện đã ghi trong session hiện tại. Không thấy metric nào thì giữ trạng thái --.`
    : 'Flight Debrief chưa có đủ lịch sử sự kiện trong session hiện tại; ANI không bịa flight history.';
  const card = buildCard('FLIGHT_DEBRIEF', 'FLIGHT DEBRIEF', rows, summary, rows.some(r => r.state === 'WARNING') ? 'CAUTION' : 'INFORMATIVE');
  return finish(summary, card, card.tone ?? 'INFORMATIVE');
}
