import {
  MavlinkTransport,
  TransportDataListener,
  TransportDiagnostics,
  TransportEndpoint,
  TransportRemoteInfo,
  TransportStatus,
} from './MavlinkTransport';

/** Deterministic in-memory transport used only by automated tests. */
export class FakeTransport implements MavlinkTransport {
  readonly kind = 'FAKE' as const;
  readonly sent: Uint8Array[] = [];
  private status: TransportStatus = 'IDLE';
  private dataListeners = new Set<TransportDataListener>();
  private errorListeners = new Set<(error: Error) => void>();
  private statusListeners = new Set<(status: TransportStatus) => void>();
  private connectedAt: number | null = null;
  private lastDataAt: number | null = null;
  private rxBytes = 0;
  private txBytes = 0;
  private rxPackets = 0;
  private txPackets = 0;

  async connect(_endpoint: TransportEndpoint) {
    this.setStatus('OPENING');
    this.connectedAt = Date.now();
    this.setStatus('READY');
  }

  async send(data: Uint8Array) {
    if (this.status !== 'READY') throw new Error('FAKE_TRANSPORT_NOT_READY');
    this.sent.push(data.slice());
    this.txBytes += data.byteLength;
    this.txPackets++;
  }

  disconnect() { this.setStatus('IDLE'); }
  getStatus() { return this.status; }
  onData(listener: TransportDataListener) { this.dataListeners.add(listener); return () => this.dataListeners.delete(listener); }
  onError(listener: (error: Error) => void) { this.errorListeners.add(listener); return () => this.errorListeners.delete(listener); }
  onStatus(listener: (status: TransportStatus) => void) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  getDiagnostics(): TransportDiagnostics {
    return {
      kind: this.kind,
      status: this.status,
      endpoint: 'memory://fake',
      connectedAt: this.connectedAt,
      lastDataAt: this.lastDataAt,
      lastError: null,
      rxBytes: this.rxBytes,
      txBytes: this.txBytes,
      rxPackets: this.rxPackets,
      txPackets: this.txPackets,
    };
  }

  inject(data: Uint8Array, remote: TransportRemoteInfo = { address: '127.0.0.1', port: 14550 }) {
    this.lastDataAt = Date.now();
    this.rxBytes += data.byteLength;
    this.rxPackets++;
    this.dataListeners.forEach(listener => listener(data.slice(), remote));
  }

  injectError(error: Error) { this.errorListeners.forEach(listener => listener(error)); }

  private setStatus(status: TransportStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach(listener => listener(status));
  }
}
