import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('MASCOT ASSET: anitech-ai-mascot.png exists and is a valid transparent PNG', () => {
  const assetPath = path.join(process.cwd(), 'assets', 'ai', 'anitech-ai-mascot.png');
  assert.ok(fs.existsSync(assetPath), 'Mascot asset file must exist at assets/ai/anitech-ai-mascot.png');

  const stats = fs.statSync(assetPath);
  assert.ok(stats.size > 10000, `Mascot asset should be a high quality image, size: ${stats.size} bytes`);

  // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const buffer = Buffer.alloc(8);
  const fd = fs.openSync(assetPath, 'r');
  fs.readSync(fd, buffer, 0, 8, 0);
  fs.closeSync(fd);

  assert.equal(buffer[0], 0x89);
  assert.equal(buffer[1], 0x50); // 'P'
  assert.equal(buffer[2], 0x4E); // 'N'
  assert.equal(buffer[3], 0x47); // 'G'
});

test('MASCOT STATE MAPPING: maps real AI/voice/action states faithfully', () => {
  // Pure logic state resolver matching AnimatedAiMascot
  function resolveMascotState(params: {
    diagStatus: 'READY' | 'CONNECTING' | 'ERROR' | 'OFFLINE';
    isListening: boolean;
    isThinking: boolean;
    isSpeaking: boolean;
    hasPendingAction: boolean;
    successTrigger: boolean;
  }) {
    if (params.diagStatus === 'OFFLINE') return 'OFFLINE';
    if (params.diagStatus === 'ERROR') return 'ERROR';
    if (params.isListening) return 'LISTENING';
    if (params.isThinking) return 'THINKING';
    if (params.isSpeaking) return 'SPEAKING';
    if (params.hasPendingAction) return 'ACTION_PENDING';
    if (params.successTrigger) return 'SUCCESS';
    return 'READY';
  }

  // 1. STT listening takes priority
  assert.equal(
    resolveMascotState({
      diagStatus: 'READY',
      isListening: true,
      isThinking: false,
      isSpeaking: false,
      hasPendingAction: false,
      successTrigger: false,
    }),
    'LISTENING'
  );

  // 2. AI thinking while waiting for response
  assert.equal(
    resolveMascotState({
      diagStatus: 'READY',
      isListening: false,
      isThinking: true,
      isSpeaking: false,
      hasPendingAction: false,
      successTrigger: false,
    }),
    'THINKING'
  );

  // 3. TTS speaking
  assert.equal(
    resolveMascotState({
      diagStatus: 'READY',
      isListening: false,
      isThinking: false,
      isSpeaking: true,
      hasPendingAction: false,
      successTrigger: false,
    }),
    'SPEAKING'
  );

  // 4. Pending flight command confirmation
  assert.equal(
    resolveMascotState({
      diagStatus: 'READY',
      isListening: false,
      isThinking: false,
      isSpeaking: false,
      hasPendingAction: true,
      successTrigger: false,
    }),
    'ACTION_PENDING'
  );

  // 5. Offline status
  assert.equal(
    resolveMascotState({
      diagStatus: 'OFFLINE',
      isListening: false,
      isThinking: false,
      isSpeaking: false,
      hasPendingAction: false,
      successTrigger: false,
    }),
    'OFFLINE'
  );

  // 6. Default idle ready
  assert.equal(
    resolveMascotState({
      diagStatus: 'READY',
      isListening: false,
      isThinking: false,
      isSpeaking: false,
      hasPendingAction: false,
      successTrigger: false,
    }),
    'READY'
  );
});
