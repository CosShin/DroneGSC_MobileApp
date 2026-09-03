import assert from 'node:assert/strict';
import test from 'node:test';
import { MavlinkManager } from '../src/services/mavlink/MavlinkManager';
import { MavlinkFrame } from '../src/services/mavlink/MavlinkProtocol';
import { MavlinkMissionService } from '../src/services/mission/MavlinkMissionService';
import { MissionItemInt } from '../src/services/mission/MissionTypes';
import { MAV_CMD, MAV_FRAME } from '../src/services/mission/MissionCommandRegistry';

type MissionListener = (frame: MavlinkFrame) => void;

class MissionManagerHarness {
  readonly sent: Array<{ messageId: number; payload: Uint8Array }> = [];
  countSends = 0;
  respondAfterCountAttempt = 1;
  ackType = 0;
  private listeners = new Set<MissionListener>();

  getVehicleTarget() { return { systemId: 1, componentId: 1 }; }
  onMissionFrame(listener: MissionListener) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }

  async sendMissionFrame(messageId: number, payload: Uint8Array) {
    this.sent.push({ messageId, payload: payload.slice() });
    if (messageId === 44) {
      this.countSends++;
      if (this.countSends >= this.respondAfterCountAttempt) {
        queueMicrotask(() => this.emit(51, Uint8Array.of(0, 0, 255, 190)));
      }
    } else if (messageId === 73) {
      const ack = this.ackType === 0
        ? Uint8Array.of(255, 190) // MAVLink 2 may trim trailing type=0.
        : Uint8Array.of(255, 190, this.ackType);
      queueMicrotask(() => this.emit(47, ack));
    }
  }

  private emit(messageId: number, payload: Uint8Array) {
    const frame: MavlinkFrame = {
      version: 2,
      sequence: 1,
      systemId: 1,
      componentId: 1,
      messageId,
      payload,
    };
    this.listeners.forEach(listener => listener(frame));
  }
}

const testItem: MissionItemInt = {
  seq: 0,
  frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
  command: MAV_CMD.NAV_TAKEOFF,
  current: 1,
  autocontinue: 1,
  param1: 0,
  param2: 0,
  param3: 0,
  param4: 0,
  x: Math.round(10.841883 * 1e7),
  y: Math.round(106.676717 * 1e7),
  z: 15,
  missionType: 0,
};

test('mission upload accepts a zero-truncated MAVLink 2 success ACK', async () => {
  const harness = new MissionManagerHarness();
  const service = new MavlinkMissionService(harness as unknown as MavlinkManager, { responseTimeoutMs: 20, maxRetries: 1 });
  const progress: number[] = [];

  await service.upload([testItem], value => progress.push(value));

  assert.deepEqual(harness.sent.map(frame => frame.messageId), [44, 73]);
  assert.equal(new DataView(harness.sent[0].payload.buffer).getUint16(0, true), 1);
  const item = new DataView(harness.sent[1].payload.buffer);
  assert.equal(item.getInt32(16, true), testItem.x);
  assert.equal(item.getInt32(20, true), testItem.y);
  assert.equal(item.getFloat32(24, true), testItem.z);
  assert.equal(progress.at(-1), 1);
});

test('mission upload retries MISSION_COUNT after a lost request', async () => {
  const harness = new MissionManagerHarness();
  harness.respondAfterCountAttempt = 2;
  const service = new MavlinkMissionService(harness as unknown as MavlinkManager, { responseTimeoutMs: 5, maxRetries: 2 });

  await service.upload([testItem]);

  assert.equal(harness.countSends, 2);
  assert.deepEqual(harness.sent.map(frame => frame.messageId), [44, 44, 73]);
});

test('mission upload reports a named autopilot rejection', async () => {
  const harness = new MissionManagerHarness();
  harness.ackType = 5;
  const service = new MavlinkMissionService(harness as unknown as MavlinkManager, { responseTimeoutMs: 20, maxRetries: 1 });

  await assert.rejects(service.upload([testItem]), /MISSION_ACK_REJECTED/);
});
