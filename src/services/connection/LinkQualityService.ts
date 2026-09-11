import type {
  HeartbeatSnapshot,
  LinkQuality,
  VideoQualityPolicy,
} from './ConnectionHealth';

export interface LinkQualityInput {
  transportConnected: boolean;
  heartbeat: HeartbeatSnapshot;
  packetLossPct: number | null;
  ackLatencyMs: number | null;
  rttMs: number | null;
}

export interface LinkQualityResult {
  score: number;
  quality: LinkQuality;
  videoPolicy: VideoQualityPolicy;
}

export class LinkQualityService {
  calculate(input: LinkQualityInput): LinkQualityResult {
    if (!input.transportConnected || input.heartbeat.health === 'LOST' || input.heartbeat.health === 'NO_HEARTBEAT') {
      return { score: 0, quality: 'CRITICAL', videoPolicy: 'OFF' };
    }

    const factors: Array<{ score: number; weight: number }> = [
      { score: 100, weight: 20 },
      { score: this.heartbeatScore(input.heartbeat), weight: 50 },
    ];
    if (input.packetLossPct !== null) factors.push({ score: this.lossScore(input.packetLossPct), weight: 20 });
    const latency = input.rttMs ?? input.ackLatencyMs;
    if (latency !== null) factors.push({ score: this.latencyScore(latency), weight: 10 });

    const weight = factors.reduce((sum, factor) => sum + factor.weight, 0);
    const score = Math.round(factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0) / weight);
    const quality = this.qualityForScore(score);
    return { score, quality, videoPolicy: this.videoPolicyForQuality(quality) };
  }

  private heartbeatScore(heartbeat: HeartbeatSnapshot) {
    if (heartbeat.health === 'HEALTHY') {
      const agePenalty = Math.min(15, (heartbeat.heartbeatAgeMs ?? 0) / 100);
      const jitterPenalty = Math.min(15, (heartbeat.jitterMs ?? 0) / 20);
      return Math.max(70, 100 - agePenalty - jitterPenalty);
    }
    if (heartbeat.health === 'DEGRADED') return 55;
    if (heartbeat.health === 'CRITICAL') return 20;
    return 0;
  }

  private lossScore(lossPct: number) {
    if (lossPct <= 0.5) return 100;
    if (lossPct <= 2) return 90;
    if (lossPct <= 5) return 70;
    if (lossPct <= 10) return 45;
    if (lossPct <= 20) return 20;
    return 0;
  }

  private latencyScore(latencyMs: number) {
    if (latencyMs <= 80) return 100;
    if (latencyMs <= 150) return 85;
    if (latencyMs <= 300) return 60;
    if (latencyMs <= 600) return 30;
    return 5;
  }

  private qualityForScore(score: number): LinkQuality {
    if (score >= 90) return 'EXCELLENT';
    if (score >= 75) return 'GOOD';
    if (score >= 50) return 'DEGRADED';
    if (score >= 25) return 'POOR';
    return 'CRITICAL';
  }

  private videoPolicyForQuality(quality: LinkQuality): VideoQualityPolicy {
    if (quality === 'EXCELLENT' || quality === 'GOOD') return 'NORMAL';
    if (quality === 'DEGRADED') return 'REDUCED';
    if (quality === 'POOR') return 'MINIMUM';
    return 'OFF';
  }
}
