export type TransportKind = 'UDP' | 'WEBSOCKET' | 'TCP' | 'USB_SERIAL' | 'BLUETOOTH' | 'FAKE';
export type TransportStatus = 'IDLE' | 'OPENING' | 'READY' | 'CLOSING' | 'ERROR';

export interface TransportEndpoint {
  host?: string;
  port?: number;
  localAddress?: string;
  localPort?: number;
  url?: string;
  timeoutMs?: number;
}
export interface TransportRemoteInfo { address: string; port: number }
export type TransportDataListener = (data: Uint8Array, remote: TransportRemoteInfo) => void;

export interface TransportDiagnostics {
  kind: TransportKind;
  status: TransportStatus;
  endpoint: string | null;
  connectedAt: number | null;
  lastDataAt: number | null;
  lastError: string | null;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  details?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface MavlinkTransport {
  readonly kind: TransportKind;
  connect(endpoint: TransportEndpoint): Promise<void>;
  send(data: Uint8Array): Promise<void>;
  disconnect(): void;
  getStatus(): TransportStatus;
  onData(listener: TransportDataListener): () => void;
  onError(listener: (error: Error) => void): () => void;
  onStatus?(listener: (status: TransportStatus) => void): () => void;
  setRemoteEndpoint?(remote: TransportRemoteInfo): void;
  getDiagnostics?(): TransportDiagnostics;
}
