export interface ReconnectPolicyConfig {
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export const DEFAULT_RECONNECT_POLICY: ReconnectPolicyConfig = {
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  jitterRatio: 0.2,
};

export class ReconnectPolicy {
  constructor(
    private readonly config: ReconnectPolicyConfig = DEFAULT_RECONNECT_POLICY,
    private readonly random: () => number = Math.random,
  ) {}

  delayForAttempt(attempt: number, configuredBaseMs?: number) {
    const base = Math.max(100, configuredBaseMs ?? this.config.baseDelayMs);
    const exponential = Math.min(base * (2 ** Math.max(0, attempt)), this.config.maxDelayMs);
    const jitter = exponential * this.config.jitterRatio * ((this.random() * 2) - 1);
    return Math.max(100, Math.round(exponential + jitter));
  }
}
