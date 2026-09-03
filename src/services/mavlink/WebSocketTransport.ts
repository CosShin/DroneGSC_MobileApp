import {
  MavlinkTransport,
  TransportDataListener,
  TransportEndpoint,
  TransportDiagnostics,
  TransportStatus,
} from './MavlinkTransport';

export class WebSocketTransport implements MavlinkTransport {
  readonly kind = 'WEBSOCKET' as const;
  private socket: WebSocket | null = null;
  private data = new Set<TransportDataListener>();
  private errors = new Set<(error: Error) => void>();
  private receiveQueue: Uint8Array[] = [];
  private queuedBytes = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private messageChain = Promise.resolve();
  private endpointUrl = '';
  private status: TransportStatus = 'IDLE';
  private statusListeners = new Set<(status: TransportStatus) => void>();
  private connectedAt: number | null = null;
  private lastDataAt: number | null = null;
  private lastError: string | null = null;
  private closeCode: number | null = null;
  private rxBytes = 0;
  private txBytes = 0;
  private rxPackets = 0;
  private txPackets = 0;

  connect(endpoint: TransportEndpoint) {
    this.disconnect();
    if (!endpoint.url || !/^wss?:\/\//i.test(endpoint.url)) return Promise.reject(new Error('INVALID_WEBSOCKET_URL'));
    this.setStatus('OPENING');
    this.endpointUrl = endpoint.url;
    this.connectedAt = null;
    this.lastDataAt = null;
    this.lastError = null;
    this.closeCode = null;
    this.rxBytes = 0;
    this.txBytes = 0;
    this.rxPackets = 0;
    this.txPackets = 0;
    return new Promise<void>((resolve,reject) => { const socket = new WebSocket(endpoint.url!); socket.binaryType = 'arraybuffer'; this.socket = socket; let opened = false;
      socket.onopen = () => { opened = true; this.connectedAt = Date.now(); this.setStatus('READY'); resolve(); };
      socket.onmessage = event => {
        const incoming = event.data;
        this.messageChain = this.messageChain.then(async () => {
          if (incoming instanceof ArrayBuffer) this.recordIncoming(new Uint8Array(incoming));
          else if (incoming?.arrayBuffer) this.recordIncoming(new Uint8Array(await incoming.arrayBuffer()));
          else this.reportError(new Error('WEBSOCKET_TEXT_FRAME_REJECTED'));
        }).catch(() => this.reportError(new Error('WEBSOCKET_BINARY_READ_FAILED')));
      };
      socket.onerror = () => { const error = new Error('WEBSOCKET_TRANSPORT_ERROR'); this.reportError(error); if (!opened) reject(error); };
      socket.onclose = event => { this.closeCode = event.code ?? null; this.setStatus('IDLE'); if (opened) this.reportError(new Error(`WEBSOCKET_CLOSED_${event.code ?? 0}`)); };
    });
  }
  send(data: Uint8Array) { if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('WEBSOCKET_NOT_OPEN')); const copy = new Uint8Array(data.byteLength); copy.set(data); this.socket.send(copy.buffer); this.txBytes += copy.byteLength; this.txPackets++; return Promise.resolve(); }
  disconnect() { if (this.socket) { this.setStatus('CLOSING'); this.socket.onopen = null; this.socket.onmessage = null; this.socket.onerror = null; this.socket.onclose = null; this.socket.close(); } this.socket = null; if (this.flushTimer) clearTimeout(this.flushTimer); this.flushTimer = null; this.receiveQueue = []; this.queuedBytes = 0; this.messageChain = Promise.resolve(); this.setStatus('IDLE'); }
  getStatus() { return this.status; }
  onData(listener: TransportDataListener) { this.data.add(listener); return () => this.data.delete(listener); }
  onError(listener: (error: Error) => void) { this.errors.add(listener); return () => this.errors.delete(listener); }
  onStatus(listener: (status: TransportStatus) => void) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  getDiagnostics(): TransportDiagnostics {
    return {
      kind: this.kind,
      status: this.status,
      endpoint: this.endpointUrl || null,
      connectedAt: this.connectedAt,
      lastDataAt: this.lastDataAt,
      lastError: this.lastError,
      rxBytes: this.rxBytes,
      txBytes: this.txBytes,
      rxPackets: this.rxPackets,
      txPackets: this.txPackets,
      details: {
        secure: /^wss:\/\//i.test(this.endpointUrl),
        closeCode: this.closeCode,
        bufferedAmount: this.socket?.bufferedAmount ?? 0,
      },
    };
  }

  private recordIncoming(bytes: Uint8Array) {
    this.lastDataAt = Date.now();
    this.rxBytes += bytes.byteLength;
    this.rxPackets++;
    this.enqueue(bytes);
  }

  private enqueue(bytes: Uint8Array) {
    if (!bytes.byteLength) return;
    if (this.queuedBytes + bytes.byteLength > 1024 * 1024) {
      this.reportError(new Error('WEBSOCKET_RECEIVE_OVERFLOW'));
      this.socket?.close();
      return;
    }
    this.receiveQueue.push(bytes);
    this.queuedBytes += bytes.byteLength;
    if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), 16);
  }

  private flush() {
    this.flushTimer = null;
    if (!this.queuedBytes) return;
    const merged = new Uint8Array(this.queuedBytes);
    let offset = 0;
    for (const chunk of this.receiveQueue) { merged.set(chunk, offset); offset += chunk.byteLength; }
    this.receiveQueue = [];
    this.queuedBytes = 0;
    this.data.forEach(listener => listener(merged, { address: this.endpointUrl, port: 0 }));
  }

  private reportError(error: Error) { this.lastError = error.message; this.setStatus('ERROR'); this.errors.forEach(listener => listener(error)); }
  private setStatus(status: TransportStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach(listener => listener(status));
  }
}
