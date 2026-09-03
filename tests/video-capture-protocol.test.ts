import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAPTURE_PROTOCOL,
  createCaptureSessionId,
  extensionForRecordingMime,
  formatRecordingDuration,
  parseVideoCaptureMessage,
} from '../src/services/video/VideoCaptureProtocol';

test('parses a bounded recording chunk and rejects malformed bridge input', () => {
  const sessionId = 'video_session_1234';
  const message = parseVideoCaptureMessage(JSON.stringify({
    protocol: CAPTURE_PROTOCOL,
    version: 1,
    type: 'RECORDING_CHUNK',
    sessionId,
    index: 0,
    base64: 'AQIDBA==',
  }));
  assert.deepEqual(message, { type: 'RECORDING_CHUNK', sessionId, index: 0, base64: 'AQIDBA==' });
  assert.equal(parseVideoCaptureMessage('VIDEO_PLAYING'), null);
  assert.equal(parseVideoCaptureMessage('{bad json'), null);
});

test('validates photo dimensions and session identifiers', () => {
  const valid = parseVideoCaptureMessage(JSON.stringify({
    protocol: CAPTURE_PROTOCOL,
    version: 1,
    type: 'PHOTO_RESULT',
    sessionId: 'photo_session_1234',
    base64: 'AQID',
    width: 1920,
    height: 1080,
  }));
  assert.equal(valid?.type, 'PHOTO_RESULT');

  const invalid = parseVideoCaptureMessage(JSON.stringify({
    protocol: CAPTURE_PROTOCOL,
    version: 1,
    type: 'PHOTO_RESULT',
    sessionId: '../bad',
    base64: 'AQID',
    width: 1920,
    height: 1080,
  }));
  assert.equal(invalid, null);
});

test('builds safe capture metadata and display duration', () => {
  assert.match(createCaptureSessionId('photo', 1234, 0.5), /^photo_[A-Za-z0-9_]+$/);
  assert.equal(extensionForRecordingMime('video/mp4;codecs=h264'), 'mp4');
  assert.equal(extensionForRecordingMime('video/webm;codecs=vp8'), 'webm');
  assert.equal(formatRecordingDuration(65.9), '01:05');
});
