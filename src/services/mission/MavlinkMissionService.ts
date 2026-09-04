import { MavlinkFrame } from '../mavlink/MavlinkProtocol';
import { MavlinkManager } from '../mavlink/MavlinkManager';
import { MissionItemInt } from './MissionTypes';
import { MISSION_ACK_MESSAGES } from './MissionCommandRegistry';

export interface MissionTransferOptions {
  responseTimeoutMs?: number;
  maxRetries?: number;
}

const MISSION_TYPE_MISSION = 0;
const DEFAULT_RESPONSE_TIMEOUT_MS = 1_500;
const DEFAULT_MAX_RETRIES = 5;
const MAX_MISSION_ITEMS = 1_000;
const MAX_BUFFERED_MISSION_FRAMES = 256;
const MAV_MISSION_OPERATION_CANCELLED = 15;
const GCS_SYSTEM_ID = 255;
const GCS_COMPONENT_ID = 190;

interface MissionFrameQueue {
  sessionId: number;
  next(timeoutMs: number): Promise<MavlinkFrame>;
  close(): void;
}

export class MavlinkMissionService {
  private active = false;
  private readonly responseTimeoutMs: number;
  private readonly maxRetries: number;

  constructor(private manager: MavlinkManager, options: MissionTransferOptions = {}) {
    this.responseTimeoutMs = options.responseTimeoutMs ?? DEFAULT_RESPONSE_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /**
   * Uploads an array of MissionItemInt items to the vehicle using the MAVLink Mission Protocol.
   */
  async upload(items: MissionItemInt[], progress?: (value: number) => void): Promise<void> {
    if (this.active) throw new Error('MISSION_TRANSFER_BUSY');
    if (!items.length) throw new Error('MISSION_EMPTY');
    if (items.length > MAX_MISSION_ITEMS) throw new Error('MISSION_TOO_LARGE');
    this.active = true;
    const sessionId = this.manager.getSessionId();
    const frames = this.queue(sessionId);
    let target: { systemId: number; componentId: number } | null = null;

    try {
      const vehicleTarget = this.manager.getVehicleTarget();
      target = vehicleTarget;
      const sendCount = () => this.manager.sendMissionFrame(44, this.countPayload(items.length, vehicleTarget));
      let resend = sendCount;
      await sendCount();

      const sent = new Set<number>();
      while (true) {
        const frame = await this.waitFor(
          frames,
          candidate => this.isForThisGcs(candidate)
            && (candidate.messageId === 47 || candidate.messageId === 40 || candidate.messageId === 51),
          resend,
        );

        if (frame.messageId === 47) {
          this.assertAcceptedAck(frame);
          if (sent.size !== items.length) {
            throw new Error('MISSION_ACK_BEFORE_ALL_ITEMS');
          }
          progress?.(1);
          return;
        }

        if (frame.payload.byteLength < 2) {
          throw new Error('MISSION_REQUEST_MALFORMED');
        }

        const seq = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength).getUint16(0, true);
        if (seq >= items.length) {
          throw new Error('MISSION_REQUEST_OUT_OF_RANGE');
        }

        const sendItem = () => this.manager.sendMissionFrame(73, this.encodeItemIntPayload(items[seq], seq, vehicleTarget));
        resend = sendItem;
        await sendItem();
        sent.add(seq);
        progress?.(sent.size / items.length);
      }
    } catch (error) {
      await this.cancelTransferIfPossible(target, error);
      throw error;
    } finally {
      frames.close();
      this.active = false;
    }
  }

  /**
   * Downloads the complete mission from the vehicle and returns wire-protocol MissionItemInt array.
   */
  async download(progress?: (value: number) => void): Promise<MissionItemInt[]> {
    if (this.active) throw new Error('MISSION_TRANSFER_BUSY');
    this.active = true;
    const sessionId = this.manager.getSessionId();
    const frames = this.queue(sessionId);
    let target: { systemId: number; componentId: number } | null = null;

    try {
      const vehicleTarget = this.manager.getVehicleTarget();
      target = vehicleTarget;
      const sendListRequest = () => this.manager.sendMissionFrame(43, this.targetPayload(vehicleTarget));
      await sendListRequest();

      const countFrame = await this.waitFor(
        frames,
        frame => frame.messageId === 44 && this.isForThisGcs(frame),
        sendListRequest,
      );
      if (countFrame.payload.byteLength < 2) {
        throw new Error('MISSION_COUNT_MALFORMED');
      }

      const count = new DataView(countFrame.payload.buffer, countFrame.payload.byteOffset, countFrame.payload.byteLength).getUint16(0, true);
      if (count > MAX_MISSION_ITEMS) throw new Error('MISSION_COUNT_TOO_LARGE');
      const result: MissionItemInt[] = [];

      for (let seq = 0; seq < count; seq++) {
        const sendItemRequest = () => this.manager.sendMissionFrame(51, this.requestPayload(seq, vehicleTarget));
        await sendItemRequest();

        const itemFrame = await this.waitFor(
          frames,
          frame => (frame.messageId === 73 || frame.messageId === 39)
            && this.isForThisGcs(frame)
            && frame.payload.byteLength >= 30
            && this.sequence(frame) === seq,
          sendItemRequest,
        );

        result.push(this.decodeItemPayload(itemFrame, seq));
        progress?.((seq + 1) / Math.max(1, count));
      }

      // Send MISSION_ACK to acknowledge successful download
      await this.manager.sendMissionFrame(47, this.ackPayload(vehicleTarget, 0));
      return result;
    } catch (error) {
      await this.cancelTransferIfPossible(target, error);
      throw error;
    } finally {
      frames.close();
      this.active = false;
    }
  }

  /**
   * Clears all mission items on the vehicle autopilot.
   */
  async clear(): Promise<void> {
    if (this.active) throw new Error('MISSION_TRANSFER_BUSY');
    this.active = true;
    const sessionId = this.manager.getSessionId();
    const frames = this.queue(sessionId);
    let target: { systemId: number; componentId: number } | null = null;

    try {
      const vehicleTarget = this.manager.getVehicleTarget();
      target = vehicleTarget;
      const sendClear = () => this.manager.sendMissionFrame(45, this.targetPayload(vehicleTarget));
      await sendClear();
      const ack = await this.waitFor(
        frames,
        frame => frame.messageId === 47 && this.isForThisGcs(frame),
        sendClear,
      );
      this.assertAcceptedAck(ack);
    } catch (error) {
      await this.cancelTransferIfPossible(target, error);
      throw error;
    } finally {
      frames.close();
      this.active = false;
    }
  }

  private queue(sessionId: number): MissionFrameQueue {
    const buffered: MavlinkFrame[] = [];
    let closed = false;
    let waiting: { resolve: (frame: MavlinkFrame) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> } | null = null;

    const remove = this.manager.onMissionFrame(frame => {
      if (closed) return;
      if (this.manager.getSessionId() !== sessionId) {
        if (waiting) {
          const current = waiting;
          waiting = null;
          clearTimeout(current.timeout);
          current.reject(new Error('MISSION_SESSION_CHANGED'));
        }
        return;
      }
      if (!this.isForThisGcs(frame)) return;
      if (!waiting) {
        if (buffered.length >= MAX_BUFFERED_MISSION_FRAMES) buffered.shift();
        buffered.push(frame);
        return;
      }
      const current = waiting;
      waiting = null;
      clearTimeout(current.timeout);
      current.resolve(frame);
    });

    return {
      sessionId,
      next: (timeoutMs: number) => new Promise<MavlinkFrame>((resolve, reject) => {
        if (closed) { reject(new Error('MISSION_TRANSFER_CLOSED')); return; }
        const ready = buffered.shift();
        if (ready) { resolve(ready); return; }
        if (waiting) { reject(new Error('MISSION_QUEUE_CONCURRENT_WAIT')); return; }
        const timeout = setTimeout(() => {
          waiting = null;
          reject(new Error('MISSION_TIMEOUT'));
        }, timeoutMs);
        waiting = { resolve, reject, timeout };
      }),
      close: () => {
        if (closed) return;
        closed = true;
        remove();
        if (waiting) {
          const current = waiting;
          waiting = null;
          clearTimeout(current.timeout);
          current.reject(new Error('MISSION_TRANSFER_CLOSED'));
        }
      },
    };
  }

  private async waitFor(
    frames: MissionFrameQueue,
    matches: (frame: MavlinkFrame) => boolean,
    resend: () => Promise<void>,
  ): Promise<MavlinkFrame> {
    let retries = 0;
    while (true) {
      let frame: MavlinkFrame;
      try {
        if (this.manager.getSessionId() !== frames.sessionId) throw new Error('MISSION_SESSION_CHANGED');
        frame = await frames.next(this.responseTimeoutMs);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'MISSION_TIMEOUT' || retries >= this.maxRetries) {
          if (error instanceof Error && error.message === 'MISSION_TIMEOUT') {
            throw new Error(`MISSION_TIMEOUT_AFTER_${retries + 1}_ATTEMPTS`);
          }
          throw error;
        }
        retries++;
        await resend();
        continue;
      }
      if (matches(frame)) {
        if (frame.messageId === 47) this.assertAcceptedAck(frame);
        return frame;
      }
    }
  }

  private assertAcceptedAck(frame: MavlinkFrame) {
    if (frame.payload.byteLength === 0) throw new Error('MISSION_ACK_MALFORMED');
    if (frame.version === 1 && frame.payload.byteLength < 3) throw new Error('MISSION_ACK_MALFORMED');
    const result = frame.payload[2] ?? 0;
    if (result !== 0) {
      const msg = MISSION_ACK_MESSAGES[result] ?? `Code ${result}`;
      throw new Error(`MISSION_ACK_REJECTED: ${msg}`);
    }
  }

  private targetPayload(t: { systemId: number; componentId: number }) {
    return Uint8Array.of(t.systemId, t.componentId, MISSION_TYPE_MISSION);
  }

  private countPayload(count: number, t: { systemId: number; componentId: number }) {
    const p = new Uint8Array(5);
    const v = new DataView(p.buffer);
    v.setUint16(0, count, true);
    p[2] = t.systemId;
    p[3] = t.componentId;
    p[4] = MISSION_TYPE_MISSION;
    return p;
  }

  private requestPayload(seq: number, t: { systemId: number; componentId: number }) {
    const p = new Uint8Array(5);
    const v = new DataView(p.buffer);
    v.setUint16(0, seq, true);
    p[2] = t.systemId;
    p[3] = t.componentId;
    p[4] = MISSION_TYPE_MISSION;
    return p;
  }

  private ackPayload(t: { systemId: number; componentId: number }, result: number) {
    return Uint8Array.of(t.systemId, t.componentId, result, MISSION_TYPE_MISSION);
  }

  private isForThisGcs(frame: MavlinkFrame) {
    const payload = frame.payload;
    let targetSystem: number | null = null;
    let targetComponent: number | null = null;
    let missionType = MISSION_TYPE_MISSION;

    if (frame.messageId === 47) {
      // MAVLink 2 may truncate the trailing accepted result (zero), leaving
      // only target_system and target_component on the wire.
      if (payload.byteLength < 2 || (frame.version === 1 && payload.byteLength < 3)) return false;
      targetSystem = payload[0];
      targetComponent = payload[1];
      missionType = payload.byteLength >= 4 ? payload[3] : MISSION_TYPE_MISSION;
    } else if (frame.messageId === 40 || frame.messageId === 44 || frame.messageId === 51) {
      if (payload.byteLength < 4) return false;
      targetSystem = payload[2];
      targetComponent = payload[3];
      missionType = payload.byteLength >= 5 ? payload[4] : MISSION_TYPE_MISSION;
    } else if (frame.messageId === 39 || frame.messageId === 73) {
      if (payload.byteLength < 34) return false;
      targetSystem = payload[32];
      targetComponent = payload[33];
      missionType = payload.byteLength >= 38 ? payload[37] : MISSION_TYPE_MISSION;
    } else {
      return false;
    }

    return targetSystem === GCS_SYSTEM_ID
      && (targetComponent === GCS_COMPONENT_ID || targetComponent === 0)
      && missionType === MISSION_TYPE_MISSION;
  }

  private async cancelTransferIfPossible(
    target: { systemId: number; componentId: number } | null,
    error: unknown,
  ) {
    if (!target || this.manager.getState().systemId === null) return;
    const reason = error instanceof Error ? error.message : '';
    if (!reason.includes('TIMEOUT') && !reason.includes('SESSION') && !reason.includes('CLOSED')) return;
    try {
      await this.manager.sendMissionFrame(47, this.ackPayload(target, MAV_MISSION_OPERATION_CANCELLED));
    } catch {
      // The transport may already be gone; the original transfer error is authoritative.
    }
  }

  /**
   * Encodes MISSION_ITEM_INT (Message #73, 38 bytes)
   */
  private encodeItemIntPayload(item: MissionItemInt, seq: number, t: { systemId: number; componentId: number }): Uint8Array {
    const p = new Uint8Array(38);
    const v = new DataView(p.buffer);

    v.setFloat32(0, item.param1, true);
    v.setFloat32(4, item.param2, true);
    v.setFloat32(8, item.param3, true);
    v.setFloat32(12, item.param4, true);
    v.setInt32(16, item.x, true);
    v.setInt32(20, item.y, true);
    v.setFloat32(24, item.z, true);
    v.setUint16(28, seq, true);
    v.setUint16(30, item.command, true);
    p[32] = t.systemId;
    p[33] = t.componentId;
    p[34] = item.frame;
    p[35] = item.current;
    p[36] = item.autocontinue;
    p[37] = item.missionType ?? MISSION_TYPE_MISSION;

    return p;
  }

  private sequence(frame: MavlinkFrame): number {
    return new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength).getUint16(28, true);
  }

  /**
   * Decodes MISSION_ITEM_INT (#73) or fallback float MISSION_ITEM (#39)
   */
  private decodeItemPayload(frame: MavlinkFrame, fallbackSeq: number): MissionItemInt {
    const v = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);
    const isInt = frame.messageId === 73;

    const param1 = v.getFloat32(0, true);
    const param2 = v.getFloat32(4, true);
    const param3 = v.getFloat32(8, true);
    const param4 = v.getFloat32(12, true);

    const x = isInt ? v.getInt32(16, true) : Math.round(v.getFloat32(16, true) * 1e7);
    const y = isInt ? v.getInt32(20, true) : Math.round(v.getFloat32(20, true) * 1e7);
    const z = v.getFloat32(24, true);
    const seq = v.byteLength >= 30 ? v.getUint16(28, true) : fallbackSeq;
    const command = v.byteLength >= 32 ? v.getUint16(30, true) : 16;
    const frameType = v.byteLength >= 35 ? frame.payload[34] : 3;
    const current = v.byteLength >= 36 ? frame.payload[35] : 0;
    const autocontinue = v.byteLength >= 37 ? frame.payload[36] : 1;
    const missionType = v.byteLength >= 38 ? frame.payload[37] : 0;

    return {
      seq,
      frame: frameType,
      command,
      current,
      autocontinue,
      param1,
      param2,
      param3,
      param4,
      x,
      y,
      z,
      missionType,
    };
  }
}
