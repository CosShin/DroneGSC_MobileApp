export interface AiAuditEvent {
  id: string;
  timestamp: number;
  intentType: string;
  source: 'VOICE' | 'TEXT' | 'SUPERVISOR';
  summary: string;
  pilotAction: 'CONFIRMED' | 'CANCELLED' | 'REJECTED_VALIDATION';
  mavCommandId?: number | null;
  ackResult?: number | null;
  stateConfirmed?: boolean;
  notes?: string;
}

const MAX_AUDIT_LOGS = 100;

class AiActionAuditLog {
  private events: AiAuditEvent[] = [];
  private listeners = new Set<(events: AiAuditEvent[]) => void>();

  log(event: Omit<AiAuditEvent, 'id' | 'timestamp'>): AiAuditEvent {
    const fullEvent: AiAuditEvent = {
      ...event,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };

    this.events.unshift(fullEvent);
    if (this.events.length > MAX_AUDIT_LOGS) {
      this.events.pop();
    }

    this.listeners.forEach(cb => cb(this.getEvents()));
    console.log(`[AI-AUDIT] ${fullEvent.intentType} | Action: ${fullEvent.pilotAction} | ${fullEvent.summary}`);
    return fullEvent;
  }

  getEvents(): AiAuditEvent[] {
    return [...this.events];
  }

  clear() {
    this.events = [];
    this.listeners.forEach(cb => cb([]));
  }

  subscribe(listener: (events: AiAuditEvent[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getEvents());
    return () => this.listeners.delete(listener);
  }
}

export const aiActionAuditLog = new AiActionAuditLog();
