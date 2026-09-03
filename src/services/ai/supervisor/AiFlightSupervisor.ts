import type { RootState } from '../../../store';
import { calculateDistanceMeters } from '../../../utils/geographic';
import { aiSpeechService } from '../../voice/AiSpeechService';
import { aiService } from '../AiService';
import type { AiActionProposal } from '../intents/AiIntentTypes';

export interface SupervisorAlert {
  id: string;
  timestamp: number;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  suggestedAction?: 'RTL' | 'LAND' | 'CHECK_GPS' | 'CHECK_BATTERY';
  proposal?: AiActionProposal;
}

export type SupervisorListener = (alert: SupervisorAlert) => void;

export class AiFlightSupervisor {
  private timer: any = null;
  private isRunning = false;
  private listeners = new Set<SupervisorListener>();
  private lastAlertTimestamp: Record<string, number> = {};
  private minAlertIntervalMs = 60_000; // Do not spam the same alert within 60s

  start(intervalMs = 15_000, getState: () => RootState) {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(() => {
      try {
        const state = getState();
        this.evaluateTelemetry(state);
      } catch (e) {
        console.warn('[AI-SUPERVISOR] Evaluation error', e);
      }
    }, intervalMs);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  subscribe(listener: SupervisorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  evaluateTelemetry(state: RootState) {
    const { connection, drone, telemetry, home } = state;
    if (connection.status !== 'CONNECTED' || connection.vehicleState !== 'CONNECTED') {
      return;
    }
    if (drone.stale || telemetry.stale) return;

    const now = Date.now();

    // 1. Battery threshold monitoring (Airborne & Low Battery)
    const batteryPct = telemetry.battery?.value?.percentage;
    const isArmed = drone.armed;

    // Check distance to home
    let distToHome = 0;
    if (telemetry.gps?.value && home?.position) {
      distToHome = calculateDistanceMeters(
        telemetry.gps.value.latitude,
        telemetry.gps.value.longitude,
        home.position.latitude,
        home.position.longitude,
      );
    }

    if (isArmed && batteryPct != null && batteryPct <= 25) {
      if (now - (this.lastAlertTimestamp['LOW_BATTERY'] || 0) > this.minAlertIntervalMs) {
        this.lastAlertTimestamp['LOW_BATTERY'] = now;

        const msg = distToHome > 100
          ? `Pin máy bay còn ${batteryPct}% và đang cách Home ${Math.round(distToHome)} mét. Cân nhắc chuyển RTL để đảm bảo an toàn.`
          : `Pin máy bay còn ${batteryPct}%. Cân nhắc hạ cánh hoặc quay về bãi đáp.`;

        this.emitAlert({
          id: `alert-bat-${now}`,
          timestamp: now,
          level: batteryPct <= 15 ? 'CRITICAL' : 'WARNING',
          message: msg,
          suggestedAction: distToHome > 50 ? 'RTL' : 'LAND',
        });

        // Voice alert
        void aiSpeechService.speak(msg, { language: 'vi-VN' });
      }
    }

    // 2. GPS fix check while in autonomous modes
    const gpsFix = telemetry.gps?.value?.gpsFix;
    const mode = drone.flightMode;
    const isAutonomousMode = mode === 'AUTO' || mode === 'GUIDED' || mode === 'RTL' || mode === 'LOITER';

    if (isArmed && isAutonomousMode && (gpsFix == null || gpsFix < 3)) {
      if (now - (this.lastAlertTimestamp['GPS_DEGRADED'] || 0) > this.minAlertIntervalMs) {
        this.lastAlertTimestamp['GPS_DEGRADED'] = now;
        const msg = `Cảnh báo: GPS mất 3D Fix khi đang bay chế độ ${mode}. Hãy chuyển sang ALT_HOLD hoặc hạ cánh khẩn cấp.`;
        this.emitAlert({
          id: `alert-gps-${now}`,
          timestamp: now,
          level: 'CRITICAL',
          message: msg,
          suggestedAction: 'LAND',
        });
        void aiSpeechService.speak(msg, { language: 'vi-VN' });
      }
    }
  }

  private emitAlert(alert: SupervisorAlert) {
    this.listeners.forEach(cb => cb(alert));
    try {
      aiService.addSupervisorAlert(alert);
    } catch (e) {
      console.warn('[AI-SUPERVISOR] Failed to forward alert to aiService', e);
    }
  }
}

export const aiFlightSupervisor = new AiFlightSupervisor();
