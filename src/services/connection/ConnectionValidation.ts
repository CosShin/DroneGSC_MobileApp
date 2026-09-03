import type { ConnectionConfig } from '../../settings/types/connection';

export interface ConnectionValidationIssue {
  field: string;
  message: string;
}

const HOSTNAME = /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*$/;
const IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
export const SUPPORTED_SERIAL_BAUD_RATES = [57_600, 115_200, 230_400, 460_800, 921_600] as const;

export function isValidPort(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 65_535;
}

export function isValidHost(value: string): boolean {
  const host = value.trim();
  return Boolean(host) && !host.includes('..') && (IPV4.test(host) || HOSTNAME.test(host));
}

export function validateWebSocketUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return 'WebSocket URL is required.';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return 'URL must use ws:// or wss://.';
    if (!url.hostname) return 'WebSocket host is required.';
    if (url.port && !isValidPort(Number(url.port))) return 'WebSocket port must be between 1 and 65535.';
    return null;
  } catch {
    return 'WebSocket URL is malformed.';
  }
}

export function validateConnectionConfig(config: ConnectionConfig): ConnectionValidationIssue[] {
  const issues: ConnectionValidationIssue[] = [];
  if (config.type === 'WEBSOCKET') {
    const message = validateWebSocketUrl(config.websocket.url);
    if (message) issues.push({ field: 'websocket.url', message });
  } else if (config.type === 'UDP') {
    if (!isValidPort(config.udp.localPort)) issues.push({ field: 'udp.localPort', message: 'Local UDP port must be between 1 and 65535.' });
    if (config.udp.mode !== 'LISTEN') {
      if (!isValidHost(config.udp.remoteHost)) issues.push({ field: 'udp.remoteHost', message: 'UDP client host must be a valid IPv4 address or hostname.' });
      if (!isValidPort(config.udp.remotePort)) issues.push({ field: 'udp.remotePort', message: 'Remote UDP port must be between 1 and 65535.' });
    }
  } else if (config.type === 'TCP') {
    if (!isValidHost(config.tcp.host)) issues.push({ field: 'tcp.host', message: 'TCP host must be a valid IPv4 address or hostname.' });
    if (!isValidPort(config.tcp.port)) issues.push({ field: 'tcp.port', message: 'TCP port must be between 1 and 65535.' });
    if (!Number.isFinite(config.tcp.connectTimeoutMs) || config.tcp.connectTimeoutMs < 250) {
      issues.push({ field: 'tcp.connectTimeoutMs', message: 'TCP timeout must be at least 250 ms.' });
    }
  } else if (config.type === 'USB_SERIAL') {
    if (!SUPPORTED_SERIAL_BAUD_RATES.includes(config.serial.baudRate as typeof SUPPORTED_SERIAL_BAUD_RATES[number])) {
      issues.push({ field: 'serial.baudRate', message: 'Select a supported USB serial baud rate.' });
    }
  } else if (config.type === 'BLUETOOTH' || config.type === 'MOCK') {
    issues.push({ field: 'type', message: `${config.type} is not a production MAVLink transport.` });
  }
  return issues;
}

