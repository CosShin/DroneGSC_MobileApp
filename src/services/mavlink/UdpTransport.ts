import dgram from 'react-native-udp';
import type UdpSocket from 'react-native-udp/lib/types/UdpSocket';
import { NativeModules } from 'react-native';
import {
  MavlinkTransport,
  TransportDataListener,
  TransportDiagnostics,
  TransportEndpoint,
  TransportRemoteInfo,
  TransportStatus,
} from './MavlinkTransport';

type NativeRemoteInfo = { address: string; port: number };
type UdpSocketWithEvents = UdpSocket & {
  on(event: 'error', listener: (error: unknown) => void): UdpSocketWithEvents;
  on(event: 'message', listener: (message: Uint8Array, info: NativeRemoteInfo) => void): UdpSocketWithEvents;
  once(event: 'listening', listener: () => void): UdpSocketWithEvents;
};

function validPort(value: number | undefined): value is number {
  return Number.isInteger(value) && (value ?? 0) > 0 && (value ?? 0) <= 65535;
}

/**
 * Native UDP transport for MAVLink datagrams.
 *
 * The socket binds before a remote endpoint is required. A configured remote
 * is used initially; the MAVLink manager then learns the command destination
 * from the selected vehicle heartbeat source.
 */
export class UdpTransport implements MavlinkTransport {
  readonly kind = 'UDP' as const;
  private socket: UdpSocketWithEvents | null = null;
  private remote: TransportRemoteInfo | null = null;
  private status: TransportStatus = 'IDLE';
  private dataListeners = new Set<TransportDataListener>();
  private errorListeners = new Set<(error: Error) => void>();
  private statusListeners = new Set<(status: TransportStatus) => void>();
  private localAddress = '0.0.0.0';
  private localPort: number | null = null;
  private connectedAt: number | null = null;
  private lastDataAt: number | null = null;
  private lastError: string | null = null;
  private rxBytes = 0;
  private txBytes = 0;
  private rxPackets = 0;
  private txPackets = 0;

  connect(endpoint: TransportEndpoint) {
    this.disconnect();
    if (!NativeModules.UdpSockets) {
      return Promise.reject(new Error('NATIVE_UDP_MODULE_UNAVAILABLE_REBUILD_DEVELOPMENT_CLIENT'));
    }
    if (!validPort(endpoint.localPort)) return Promise.reject(new Error('INVALID_UDP_LOCAL_PORT'));
    if ((endpoint.host && !validPort(endpoint.port)) || (!endpoint.host && endpoint.port !== undefined)) {
      return Promise.reject(new Error('INVALID_UDP_REMOTE_ENDPOINT'));
    }

    this.remote = endpoint.host && endpoint.port
      ? { address: endpoint.host, port: endpoint.port }
      : null;
    this.localAddress = endpoint.localAddress ?? '0.0.0.0';
    this.localPort = endpoint.localPort;
    this.connectedAt = null;
    this.lastDataAt = null;
    this.lastError = null;
    this.rxBytes = 0;
    this.txBytes = 0;
    this.rxPackets = 0;
    this.txPackets = 0;
    this.setStatus('OPENING');

    return new Promise<void>((resolve, reject) => {
      const socket = dgram.createSocket({ type: 'udp4', reusePort: true }) as UdpSocketWithEvents;
      this.socket = socket;
      let settled = false;

      const fail = (value: unknown) => {
        const error = value instanceof Error ? value : new Error(String(value));
        this.lastError = error.message;
        this.setStatus('ERROR');
        this.errorListeners.forEach(listener => listener(error));
        if (!settled) {
          settled = true;
          reject(error);
        }
      };

      socket.on('error', fail);
      socket.on('message', (message: Uint8Array, info: NativeRemoteInfo) => {
        const copy = new Uint8Array(message.byteLength);
        copy.set(message);
        this.lastDataAt = Date.now();
        this.rxBytes += copy.byteLength;
        this.rxPackets++;
        this.dataListeners.forEach(listener => listener(copy, {
          address: info.address,
          port: info.port,
        }));
      });
      socket.once('listening', () => {
        if (settled) return;
        settled = true;
        this.connectedAt = Date.now();
        this.setStatus('READY');
        resolve();
      });

      try {
        socket.bind(endpoint.localPort, endpoint.localAddress ?? '0.0.0.0');
      } catch (error) {
        fail(error);
      }
    });
  }

  send(data: Uint8Array) {
    if (!this.socket || this.status !== 'READY') return Promise.reject(new Error('UDP_SOCKET_NOT_READY'));
    if (!this.remote) return Promise.reject(new Error('UDP_REMOTE_ENDPOINT_UNKNOWN'));
    const remote = this.remote;
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    return new Promise<void>((resolve, reject) => {
      this.socket?.send(copy, 0, copy.byteLength, remote.port, remote.address, error => {
        if (error) {
          this.lastError = error.message;
          reject(error);
        } else {
          this.txBytes += copy.byteLength;
          this.txPackets++;
          resolve();
        }
      });
    });
  }

  disconnect() {
    const socket = this.socket;
    this.socket = null;
    this.remote = null;
    if (socket) {
      this.setStatus('CLOSING');
      try { socket.close(); } catch { /* already closed */ }
    }
    this.setStatus('IDLE');
  }

  getStatus() { return this.status; }
  setRemoteEndpoint(remote: TransportRemoteInfo) { this.remote = { ...remote }; }
  onData(listener: TransportDataListener) { this.dataListeners.add(listener); return () => this.dataListeners.delete(listener); }
  onError(listener: (error: Error) => void) { this.errorListeners.add(listener); return () => this.errorListeners.delete(listener); }
  onStatus(listener: (status: TransportStatus) => void) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  getDiagnostics(): TransportDiagnostics {
    const remote = this.remote ? `${this.remote.address}:${this.remote.port}` : null;
    return {
      kind: this.kind,
      status: this.status,
      endpoint: `${this.localAddress}:${this.localPort ?? '--'}`,
      connectedAt: this.connectedAt,
      lastDataAt: this.lastDataAt,
      lastError: this.lastError,
      rxBytes: this.rxBytes,
      txBytes: this.txBytes,
      rxPackets: this.rxPackets,
      txPackets: this.txPackets,
      details: {
        localAddress: this.localAddress,
        localPort: this.localPort,
        remoteEndpoint: remote,
        remoteDiscovered: Boolean(this.remote),
      },
    };
  }

  private setStatus(status: TransportStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach(listener => listener(status));
  }
}
