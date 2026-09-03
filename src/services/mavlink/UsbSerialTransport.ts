import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import {
  type MavlinkTransport,
  type TransportDataListener,
  type TransportDiagnostics,
  type TransportEndpoint,
  type TransportStatus,
} from './MavlinkTransport';
import { platformCapabilities } from '../../platform/PlatformCapabilities';

export interface UsbSerialEndpoint extends TransportEndpoint {
  baudRate?: number;
  deviceId?: string;
}

export interface UsbDeviceInfo {
  deviceId: string;
  deviceName: string;
  vendorId: number;
  productId: number;
  permissionGranted: boolean;
}

/** Android USB OTG Serial transport for MAVLink. Feeds raw byte chunks
 * into the single MAVLink parser owned by MavlinkManager. */
export class UsbSerialTransport implements MavlinkTransport {
  readonly kind = 'USB_SERIAL' as const;
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
  private subscriptions: Array<{ remove(): void }> = [];

  static async scanDevices(): Promise<UsbDeviceInfo[]> {
    if (Platform.OS !== 'android') return [];
    const module = NativeModules.AnitechUsbSerial;
    if (!module || typeof module.scanDevices !== 'function') return [];
    try {
      return await module.scanDevices();
    } catch {
      return [];
    }
  }

  async connect(endpoint: UsbSerialEndpoint): Promise<void> {
    this.disconnect();

    if (platformCapabilities.usbSerial.support !== 'SUPPORTED') {
      const reason = platformCapabilities.usbSerial.reason ?? 'USB serial is unsupported on this platform.';
      const error = new Error(reason);
      this.reportError(error);
      throw error;
    }

    const baudRate = endpoint.baudRate ?? 57600;
    const deviceId = endpoint.deviceId ?? 'default';
    this.endpoint = `USB:${deviceId}@${baudRate}`;
    this.connectedAt = null;
    this.lastDataAt = null;
    this.lastError = null;
    this.rxBytes = 0;
    this.txBytes = 0;
    this.rxPackets = 0;
    this.txPackets = 0;
    this.setStatus('OPENING');

    const module = NativeModules.AnitechUsbSerial;
    if (!module) {
      const error = new Error('USB_SERIAL_NATIVE_MODULE_MISSING');
      this.reportError(error);
      throw error;
    }

    try {
      await module.open(deviceId, baudRate);
      this.connectedAt = Date.now();
      this.setStatus('READY');

      const emitter = new NativeEventEmitter(module);
      this.subscriptions.push(emitter.addListener('onUsbData', (payload: string | number[]) => {
        let bytes: Uint8Array;
        if (typeof payload === 'string') {
          // base64 or hex string
          const binary = atob(payload);
          bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        } else if (Array.isArray(payload)) {
          bytes = new Uint8Array(payload);
        } else {
          return;
        }

        this.lastDataAt = Date.now();
        this.rxBytes += bytes.byteLength;
        this.rxPackets++;
        this.dataListeners.forEach(listener => listener(bytes, { address: 'USB', port: baudRate }));
      }));
      this.subscriptions.push(emitter.addListener('onUsbError', (message: string) => {
        const error = new Error(message || 'USB_SERIAL_ERROR');
        this.reportError(error);
        this.setStatus('ERROR');
      }));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.reportError(error);
      this.setStatus('ERROR');
      throw error;
    }
  }

  async send(data: Uint8Array): Promise<void> {
    if (this.status !== 'READY') {
      throw new Error('USB_SERIAL_NOT_READY');
    }
    const module = NativeModules.AnitechUsbSerial;
    if (!module) {
      throw new Error('USB_SERIAL_MODULE_NOT_AVAILABLE');
    }

    try {
      const hex = Array.from(data, b => b.toString(16).padStart(2, '0')).join('');
      await module.writeHex(hex);
      this.txBytes += data.byteLength;
      this.txPackets++;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.reportError(error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.status === 'IDLE') return;
    this.setStatus('CLOSING');
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
    const module = NativeModules.AnitechUsbSerial;
    if (module && typeof module.close === 'function') {
      try {
        void module.close();
      } catch {
        // ignore close error
      }
    }
    this.setStatus('IDLE');
  }

  getStatus(): TransportStatus {
    return this.status;
  }

  onData(listener: TransportDataListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onError(listener: (error: Error) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onStatus(listener: (status: TransportStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

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
    };
  }

  private setStatus(next: TransportStatus) {
    if (this.status === next) return;
    this.status = next;
    this.statusListeners.forEach(listener => listener(next));
  }

  private reportError(error: Error) {
    this.lastError = error.message;
    this.errorListeners.forEach(listener => listener(error));
  }
}
