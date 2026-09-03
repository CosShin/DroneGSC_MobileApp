import test from 'node:test';
import assert from 'node:assert/strict';
import { getModelMetadata } from '../src/settings/defaults/ai';
import { VideoFrameCaptureService } from '../src/services/video/VideoFrameCaptureService';
import { PrecisionLandingAdvisor } from '../src/services/vision/PrecisionLandingAdvisor';

test('Model metadata distinguishes vision-capable models from text-only models', () => {
  const qwen = getModelMetadata('qwen3.5:9b');
  assert.equal(qwen.supportsVision, false, 'qwen3.5:9b must be marked text-only');

  const gemma = getModelMetadata('gemma4:31b-cloud');
  assert.equal(gemma.supportsVision, true, 'gemma4:31b-cloud must support multimodal vision');

  const customLlava = getModelMetadata('llava-phi3:latest');
  assert.equal(customLlava.supportsVision, true, 'llava models should be detected as vision-capable');
});

test('VideoFrameCaptureService captures exactly one frame on-demand without streaming', async () => {
  const service = new VideoFrameCaptureService();

  // Test provider registration
  service.registerFrameProvider(async () => ({
    base64: 'mock-frame-base64-content',
    width: 1280,
    height: 720,
    timestamp: Date.now(),
    source: 'WEBRTC_PLAYER',
    isLive: true,
  }));

  const frame = await service.captureCurrentFrame();
  assert.ok(frame);
  assert.equal(frame?.width, 1280);
  assert.equal(frame?.height, 720);
  assert.equal(frame?.base64, 'mock-frame-base64-content');
  assert.equal(frame?.isLive, true);
});

test('PrecisionLandingAdvisor formats natural pilot explanations from detector telemetry', () => {
  const advisor = new PrecisionLandingAdvisor();

  // 1. When marker is not detected
  advisor.updateTargetState({ targetFound: false });
  assert.ok(advisor.getAdvisoryDescription('vi-VN').includes('Chưa phát hiện landing marker'));

  // 2. When marker is detected
  advisor.updateTargetState({
    targetFound: true,
    tagId: 0,
    offsetXCentimeters: 25,
    offsetYCentimeters: -10,
    altitudeMeters: 3.2,
  });

  const desc = advisor.getAdvisoryDescription('vi-VN');
  assert.ok(desc.includes('landing marker #0'));
  assert.ok(desc.includes('lệch 25cm sang phải'));
  assert.ok(desc.includes('lùi 10cm'));
  assert.ok(desc.includes('3.2m'));
});
