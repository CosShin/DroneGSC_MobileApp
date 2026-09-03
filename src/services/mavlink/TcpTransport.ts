import TcpSocket from 'react-native-tcp-socket';
import {
  type MavlinkTransport,
  type TransportDataListener,
  type TransportDiagnostics,
  type TransportEndpoint,
  type TransportStatus,
} from './MavlinkTransport';

function validPort(value: number | undefined): value is number {
  return Number.isInteger(value) && (value ?? 0) >= 1 && (value ?? 0) <= 65_535;
}

type TcpClientSocket = ReturnType<typeof TcpSocket.createConnection>;

/** Native MAVLink TCP client. Every read is forwarded as an arbitrary stream
 * chunk to the single MavlinkParser owned by MavlinkManager. */
export class TcpTransport implements MavlinkTransport {
  readonly kind = 'TCP' as const;
  private socket: TcpClientSocket | null = null;
  private status: TransportStatus = 'IDLE';
  private endpoint: string | null = null;
  private connectedAt: number | null = null;
  private lastDataAt: number | null = null;
  private lastError: string | null = null;
  private rxBytes = 0;
  private txBytes = 0;
  private rxPackets = 0;
  private txPackets = 0;
  private dataListeners = new Set<TransportDataListener>();
  private errorListeners = new Set<(error: Error) => void>();
  private statusListeners = new Set<(status: TransportStatus) => void>();

  connect(endpoint: TransportEndpoint) {
    this.disconnect();
    const host = endpoint.host?.trim();
    if (!host) return Promise.reject(new Error('INVALID_TCP_HOST'));
    if (!validPort(endpoint.port)) return Promise.reject(new Error('INVALID_TCP_PORT'));

    this.endpoint = `${host}:${endpoint.port}`;
    this.connectedAt = null;
    this.lastDataAt = null;
    this.lastError = null;
    this.rxBytes = 0;
    this.txBytes = 0;
    this.rxPackets = 0;
    this.txPackets = 0;
    this.setStatus('OPENING');

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const socket = TcpSocket.createConnection({
        host,
        port: endpoint.port!,
        connectTimeout: endpoint.timeoutMs,
        reuseAddress: true,
      }, () => {
        if (settled) return;
        settled = true;
        this.connectedAt = Date.now();
        this.setStatus('READY');
        resolve();
      });
      this.socket = socket;
      socket.setNoDelay(true);
      socket.setKeepAlive(true, 1000);
      socket.on('data', chunk => {
        const bytes = typeof chunk === 'string'
          ? new TextEncoder().encode(chunk)
          : new Uint8Array(chunk).slice();
        this.lastDataAt = Date.now();
        this.rxBytes += bytes.byteLength;
        this.rxPackets++;
        this.dataListeners.forEach(listener => listener(bytes, { address: host, port: endpoint.port! }));
      });
      socket.on('error', value => {
        const error = value instanceof Error ? value : new Error(String(value));
        this.reportError(error);
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      socket.on('timeout', () => {
        const error = new Error('TCP_SOCKET_TIMEOUT');
        this.reportError(error);
        socket.destroy();
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      socket.on('close', () => {
        this.socket = null;
        if (this.status !== 'CLOSING' && this.status !== 'IDLE') {
          this.reportError(new Error('TCP_SOCKET_CLOSED'));
        }
        this.setStatus('IDLE');
      });
    });
  }

  send(data: Uint8Array) {
    if (!this.socket || this.status !== 'READY') return Promise.reject(new Error('TCP_SOCKET_NOT_READY'));
    const copy = data.slice();
    return new Promise<void>((resolve, reject) => {
      this.socket?.write(copy, undefined, (error?: Error) => {
        if (error) {
          this.reportError(error);
          reject(error);
          return;
        }
        this.txBytes += copy.byteLength;
        this.txPackets++;
        resolve();
      });
    });
  }

  disconnect() {
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      this.setStatus('CLOSING');
      socket.removeAllListeners();
      socket.destroy();
    }
    this.setStatus('IDLE');
  }

  getStatus() { return this.status; }
  onData(listener: TransportDataListener) { this.dataListeners.add(listener); return () => this.dataListeners.delete(listener); }
  onError(listener: (error: Error) => void) { this.errorListeners.add(listener); return () => this.errorListeners.delete(listener); }
  onStatus(listener: (status: TransportStatus) => void) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  getDiagnostics(): TransportDiagnostics {
    return {
      kind: this.kind,
      status: this.status,
      endpoint: this.endpoint,
      connectedAt: this.connectedAt,
      lastDataAt: this.lastDataAt,
      lastError: this.lastError,
      rxBytes: this.rxBytes,
      txBytes: this.txBytes,
      rxPackets: this.rxPackets,
      txPackets: this.txPackets,
      details: {
        remoteHost: this.socket?.remoteAddress ?? null,
        remotePort: this.socket?.remotePort ?? null,
        localAddress: this.socket?.localAddress ?? null,
        localPort: this.socket?.localPort ?? null,
      },
    };
  }

  private reportError(error: Error) {
    this.lastError = error.message;
    this.setStatus('ERROR');
    this.errorListeners.forEach(listener => listener(error));
  }

  private setStatus(status: TransportStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach(listener => listener(status));
  }
}
