export type ConnectionPhase =
  | 'IDLE'
  | 'OPENING_TRANSPORT'
  | 'TRANSPORT_READY'
  | 'WAITING_HEARTBEAT'
  | 'VEHICLE_DETECTED'
  | 'LINK_ACTIVE'
  | 'DEGRADED'
  | 'RECONNECTING'
  | 'CLOSING'
  | 'ERROR';

export interface ConnectionPhaseSnapshot {
  phase: ConnectionPhase;
  previous: ConnectionPhase | null;
  changedAt: number;
  reason: string | null;
}

const ALLOWED: Record<ConnectionPhase, ReadonlySet<ConnectionPhase>> = {
  IDLE: new Set(['OPENING_TRANSPORT', 'ERROR']),
  OPENING_TRANSPORT: new Set(['TRANSPORT_READY', 'RECONNECTING', 'CLOSING', 'ERROR']),
  TRANSPORT_READY: new Set(['WAITING_HEARTBEAT', 'CLOSING', 'ERROR']),
  WAITING_HEARTBEAT: new Set(['VEHICLE_DETECTED', 'DEGRADED', 'RECONNECTING', 'CLOSING', 'ERROR']),
  VEHICLE_DETECTED: new Set(['LINK_ACTIVE', 'DEGRADED', 'CLOSING', 'ERROR']),
  LINK_ACTIVE: new Set(['DEGRADED', 'RECONNECTING', 'CLOSING', 'ERROR']),
  DEGRADED: new Set(['LINK_ACTIVE', 'RECONNECTING', 'CLOSING', 'ERROR']),
  RECONNECTING: new Set(['OPENING_TRANSPORT', 'LINK_ACTIVE', 'CLOSING', 'ERROR']),
  CLOSING: new Set(['IDLE', 'ERROR']),
  ERROR: new Set(['RECONNECTING', 'OPENING_TRANSPORT', 'CLOSING', 'IDLE']),
};

export class ConnectionStateMachine {
  private snapshot: ConnectionPhaseSnapshot = {
    phase: 'IDLE',
    previous: null,
    changedAt: Date.now(),
    reason: null,
  };
  private listeners = new Set<(snapshot: ConnectionPhaseSnapshot) => void>();

  getSnapshot(): ConnectionPhaseSnapshot { return { ...this.snapshot }; }

  transition(next: ConnectionPhase, reason: string | null = null) {
    const current = this.snapshot.phase;
    if (current === next) return this.getSnapshot();
    if (!ALLOWED[current].has(next)) {
      throw new Error(`INVALID_CONNECTION_TRANSITION_${current}_TO_${next}`);
    }
    this.snapshot = {
      phase: next,
      previous: current,
      changedAt: Date.now(),
      reason,
    };
    const copy = this.getSnapshot();
    this.listeners.forEach(listener => listener(copy));
    return copy;
  }

  /** Safe shutdown from any non-idle phase. */
  close(reason: string | null = null) {
    if (this.snapshot.phase === 'IDLE') return this.getSnapshot();
    if (this.snapshot.phase !== 'CLOSING') this.transition('CLOSING', reason);
    return this.transition('IDLE', reason);
  }

  onChange(listener: (snapshot: ConnectionPhaseSnapshot) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
