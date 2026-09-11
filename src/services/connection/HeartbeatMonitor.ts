import type { HeartbeatHealth, HeartbeatSnapshot } from './ConnectionHealth';

export interface HeartbeatMonitorConfig {
  degradedAfterMs: number;
  criticalAfterMs: number;
  lostAfterMs: number;
  expectedIntervalMs: number;
  sampleCount: number;
}

export const DEFAULT_HEARTBEAT_MONITOR_CONFIG: HeartbeatMonitorConfig = {
  degradedAfterMs: 1_500,
  criticalAfterMs: 3_000,
  lostAfterMs: 5_000,
  expectedIntervalMs: 1_000,
  sampleCount: 12,
};

export class HeartbeatMonitor {
  private lastHeartbeatAt: number | null = null;
  private intervals: number[] = [];

  constructor(
    private readonly config: HeartbeatMonitorConfig = DEFAULT_HEARTBEAT_MONITOR_CONFIG,
    private readonly now: () => number = Date.now,
  ) {
    if (!(config.degradedAfterMs < config.criticalAfterMs && config.criticalAfterMs < config.lostAfterMs)) {
      throw new Error('INVALID_HEARTBEAT_THRESHOLDS');
    }
  }

  recordHeartbeat(receivedAt = this.now()) {
    if (this.lastHeartbeatAt !== null && receivedAt > this.lastHeartbeatAt) {
      this.intervals.push(receivedAt - this.lastHeartbeatAt);
      if (this.intervals.length > this.config.sampleCount) this.intervals.shift();
    }
    this.lastHeartbeatAt = receivedAt;
    return this.getSnapshot(receivedAt);
  }

  reset() {
    this.lastHeartbeatAt = null;
    this.intervals = [];
  }

  getSnapshot(at = this.now()): HeartbeatSnapshot {
    if (this.lastHeartbeatAt === null) {
      return {
        health: 'NO_HEARTBEAT',
        lastHeartbeatAt: null,
        heartbeatAgeMs: null,
        heartbeatIntervalMs: null,
        jitterMs: null,
        missedHeartbeatCount: 0,
      };
    }
    const age = Math.max(0, at - this.lastHeartbeatAt);
    const interval = this.average(this.intervals);
    const expected = interval ?? this.config.expectedIntervalMs;
    return {
      health: this.classify(age),
      lastHeartbeatAt: this.lastHeartbeatAt,
      heartbeatAgeMs: age,
      heartbeatIntervalMs: interval,
      jitterMs: this.jitter(this.intervals, expected),
      missedHeartbeatCount: Math.max(0, Math.floor(age / Math.max(1, expected))),
    };
  }

  private classify(ageMs: number): HeartbeatHealth {
    if (ageMs < this.config.degradedAfterMs) return 'HEALTHY';
    if (ageMs < this.config.criticalAfterMs) return 'DEGRADED';
    if (ageMs <= this.config.lostAfterMs) return 'CRITICAL';
    return 'LOST';
  }

  private average(values: number[]) {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private jitter(values: number[], mean: number) {
    if (values.length < 2) return null;
    return values.reduce((sum, value) => sum + Math.abs(value - mean), 0) / values.length;
  }
}
