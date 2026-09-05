type DevDiagnosticOptions = {
  minIntervalMs?: number;
  maxPerKey?: number;
};

const enabled = typeof __DEV__ !== 'undefined' && __DEV__;

export function createDevDiagnostics(scope: string, options: DevDiagnosticOptions = {}) {
  const minIntervalMs = options.minIntervalMs ?? 1000;
  const maxPerKey = options.maxPerKey ?? 120;
  const lastLoggedAt = new Map<string, number>();
  const counts = new Map<string, number>();

  return (key: string, payload?: Record<string, unknown>) => {
    if (!enabled) return;
    const count = counts.get(key) ?? 0;
    if (count >= maxPerKey) return;

    const now = Date.now();
    const last = lastLoggedAt.get(key) ?? 0;
    if (now - last < minIntervalMs) return;

    counts.set(key, count + 1);
    lastLoggedAt.set(key, now);
    console.info(`[ANITECH:${scope}] ${key}`, payload ?? {});
  };
}
