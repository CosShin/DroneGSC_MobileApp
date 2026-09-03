import { universalConnectionService } from '../connection/UniversalConnectionService';
import type { MavlinkPacketEvent, MavlinkTrafficDiagnostics } from './MavlinkManager';
import {
  decodeInspectorPacket,
  type InspectorPacket,
  type MavlinkPacketCategory,
} from './MavlinkInspectorDecoder';
import { BoundedRingBuffer } from '../../utils/BoundedRingBuffer';
import type { TransportDiagnostics } from './MavlinkTransport';

export const MAX_INSPECTOR_PACKETS = 1000;
export const INSPECTOR_UI_REFRESH_MS = 125;
const RATE_WINDOW_MS = 5000;

export interface InspectorMessageRate {
  messageId: number;
  messageName: string;
  category: MavlinkPacketCategory;
  rxCount: number;
  txCount: number;
  rateHz: number;
}

export interface InspectorLiveMessage {
  key: string;
  messageId: number;
  messageName: string;
  category: MavlinkPacketCategory;
  direction: InspectorPacket['direction'];
  systemId: number;
  componentId: number;
  count: number;
  rateHz: number;
  latest: InspectorPacket;
}

export interface MavlinkInspectorSnapshot {
  revision: number;
  sessionId: number;
  packets: readonly InspectorPacket[];
  messages: readonly InspectorLiveMessage[];
  rates: readonly InspectorMessageRate[];
  traffic: MavlinkTrafficDiagnostics;
  heartbeatAgeMs: number | null;
  transport: TransportDiagnostics | null;
  reconnectCount: number;
}

interface RateEntry {
  messageId: number;
  messageName: string;
  category: MavlinkPacketCategory;
  rxCount: number;
  txCount: number;
  recent: number[];
}

interface LiveMessageEntry extends Omit<InspectorLiveMessage, 'rateHz'> {
  recent: number[];
}

class MavlinkInspectorService {
  private packets = new BoundedRingBuffer<InspectorPacket>(MAX_INSPECTOR_PACKETS);
  private rates = new Map<number, RateEntry>();
  private messages = new Map<string, LiveMessageEntry>();
  private listeners = new Set<(snapshot: MavlinkInspectorSnapshot) => void>();
  private removePacketListener: (() => void) | null = null;
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private revision = 0;
  private ordinal = 0;
  private sessionId = 0;

  subscribe(listener: (snapshot: MavlinkInspectorSnapshot) => void) {
    this.listeners.add(listener);
    if (!this.removePacketListener) {
      this.removePacketListener = universalConnectionService.onMavlinkPacket(event => this.capture(event));
    }
    listener(this.getSnapshot());

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.removePacketListener?.();
        this.removePacketListener = null;
        if (this.emitTimer) clearTimeout(this.emitTimer);
        this.emitTimer = null;
      }
    };
  }

  clear() {
    this.packets.clear();
    this.rates.clear();
    this.messages.clear();
    this.revision++;
    this.emitNow();
  }

  getSnapshot(): MavlinkInspectorSnapshot {
    const traffic = universalConnectionService.getMavlinkTrafficDiagnostics();
    const heartbeat = universalConnectionService.getState().lastHeartbeatAt;
    const connectionDiagnostics = universalConnectionService.getDiagnostics();
    return {
      revision: this.revision,
      sessionId: traffic.sessionId,
      packets: this.packets.toArray(),
      messages: this.messageSnapshot(),
      rates: this.rateSnapshot(),
      traffic,
      heartbeatAgeMs: heartbeat ? Math.max(0, Date.now() - heartbeat) : null,
      transport: connectionDiagnostics.transport,
      reconnectCount: connectionDiagnostics.reconnectCount,
    };
  }

  private capture(event: MavlinkPacketEvent) {
    if (this.sessionId !== event.sessionId) {
      this.sessionId = event.sessionId;
      this.packets.clear();
      this.rates.clear();
      this.messages.clear();
      this.ordinal = 0;
    }

    const packet = decodeInspectorPacket(event, this.ordinal++);
    this.packets.push(packet);

    const messageKey = `${packet.direction}:${packet.systemId}:${packet.componentId}:${packet.messageId}`;
    const liveMessage = this.messages.get(messageKey) ?? {
      key: messageKey,
      messageId: packet.messageId,
      messageName: packet.messageName,
      category: packet.category,
      direction: packet.direction,
      systemId: packet.systemId,
      componentId: packet.componentId,
      count: 0,
      latest: packet,
      recent: [],
    };
    liveMessage.count++;
    liveMessage.latest = packet;
    liveMessage.recent.push(packet.timestamp);
    const liveCutoff = packet.timestamp - RATE_WINDOW_MS;
    while (liveMessage.recent.length && liveMessage.recent[0] < liveCutoff) liveMessage.recent.shift();
    this.messages.set(messageKey, liveMessage);

    const entry = this.rates.get(packet.messageId) ?? {
      messageId: packet.messageId,
      messageName: packet.messageName,
      category: packet.category,
      rxCount: 0,
      txCount: 0,
      recent: [],
    };
    if (packet.direction === 'RX') entry.rxCount++;
    else entry.txCount++;
    entry.recent.push(packet.timestamp);
    const cutoff = packet.timestamp - RATE_WINDOW_MS;
    while (entry.recent.length && entry.recent[0] < cutoff) entry.recent.shift();
    this.rates.set(packet.messageId, entry);

    this.revision++;
    if (!this.emitTimer) {
      this.emitTimer = setTimeout(() => {
        this.emitTimer = null;
        this.emitNow();
      }, INSPECTOR_UI_REFRESH_MS);
    }
  }

  private rateSnapshot(): InspectorMessageRate[] {
    const now = Date.now();
    const cutoff = now - RATE_WINDOW_MS;
    return Array.from(this.rates.values()).map(entry => {
      while (entry.recent.length && entry.recent[0] < cutoff) entry.recent.shift();
      return {
        messageId: entry.messageId,
        messageName: entry.messageName,
        category: entry.category,
        rxCount: entry.rxCount,
        txCount: entry.txCount,
        rateHz: entry.recent.length / (RATE_WINDOW_MS / 1000),
      };
    }).sort((a, b) => b.rateHz - a.rateHz || b.rxCount + b.txCount - (a.rxCount + a.txCount));
  }

  private messageSnapshot(): InspectorLiveMessage[] {
    const cutoff = Date.now() - RATE_WINDOW_MS;
    return Array.from(this.messages.values()).map(entry => {
      while (entry.recent.length && entry.recent[0] < cutoff) entry.recent.shift();
      return {
        key: entry.key,
        messageId: entry.messageId,
        messageName: entry.messageName,
        category: entry.category,
        direction: entry.direction,
        systemId: entry.systemId,
        componentId: entry.componentId,
        count: entry.count,
        rateHz: entry.recent.length / (RATE_WINDOW_MS / 1000),
        latest: entry.latest,
      };
    }).sort((a, b) => a.systemId - b.systemId
      || a.componentId - b.componentId
      || a.messageName.localeCompare(b.messageName)
      || a.direction.localeCompare(b.direction));
  }

  private emitNow() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }
}

export const mavlinkInspectorService = new MavlinkInspectorService();
