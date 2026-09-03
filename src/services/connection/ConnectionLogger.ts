export type ConnectionLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface ConnectionLogEntry {
  id: number;
  timestamp: number;
  level: ConnectionLogLevel;
  category: 'STATE' | 'TRANSPORT' | 'MAVLINK' | 'VEHICLE' | 'COMMAND' | 'LIFECYCLE';
  code: string;
  message: string;
  context?: Record<string, string | number | boolean | null>;
}

/** Bounded in-memory diagnostics log. It never records raw packet payloads. */
export class ConnectionLogger {
  private entries: ConnectionLogEntry[] = [];
  private nextId = 1;
  private listeners = new Set<(entry: ConnectionLogEntry) => void>();

  constructor(private readonly capacity = 500) {}

  write(entry: Omit<ConnectionLogEntry, 'id' | 'timestamp'>) {
    const value: ConnectionLogEntry = {
      ...entry,
      id: this.nextId++,
      timestamp: Date.now(),
    };
    this.entries.push(value);
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
    this.listeners.forEach(listener => listener({ ...value }));
    return value;
  }

  list() { return this.entries.map(entry => ({ ...entry })); }
  clear() { this.entries = []; }
  onEntry(listener: (entry: ConnectionLogEntry) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
