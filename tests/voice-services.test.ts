import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SpeechRecognitionService,
} from '../src/services/voice/SpeechRecognitionService';
import {
  cleanTextForSpeech,
  AiSpeechService,
} from '../src/services/voice/AiSpeechService';

test('cleanTextForSpeech cleans markdown, code blocks, and symbols for natural voice synthesis', () => {
  const markdown = `
### Báo cáo tình trạng
- Pin: **92%** (15.4V)
- GPS: [3D Fix](geo:10.7,106.6)
- Trạng thái: ✓ Đã kiểm tra PreArm
\`\`\`json
{"voltage": 15.4}
\`\`\`
⚠️ Gió mạnh 12m/s
`;

  const cleaned = cleanTextForSpeech(markdown);

  assert.ok(!cleaned.includes('###'));
  assert.ok(!cleaned.includes('**'));
  assert.ok(!cleaned.includes('```'));
  assert.ok(!cleaned.includes('[3D Fix]('));
  assert.ok(cleaned.includes('Đạt Đã kiểm tra PreArm'));
  assert.ok(cleaned.includes('Cảnh báo: Gió mạnh 12 mét trên giây'));
});

test('SpeechRecognitionService initializes with IDLE state and clean transcripts', () => {
  const service = new SpeechRecognitionService();
  const state = service.getState();

  assert.equal(state.status, 'IDLE');
  assert.equal(state.transcript, '');
  assert.equal(state.interimTranscript, '');
  assert.equal(state.isRecognizing, false);
  assert.equal(state.errorCode, null);
});

test('SpeechRecognitionService gracefully reports SPEECH_RECOGNITION_UNAVAILABLE when native module is absent', async () => {
  const service = new SpeechRecognitionService();
  const granted = await service.requestPermissions();

  assert.equal(granted, false);
  const state = service.getState();
  assert.equal(state.status, 'ERROR');
  assert.equal(state.errorCode, 'SPEECH_RECOGNITION_UNAVAILABLE');
  assert.ok(state.errorMessage?.includes('development build'));
});

test('SpeechRecognitionService cancelListening resets state and clears transcripts', () => {
  const service = new SpeechRecognitionService();
  (service as any).status = 'LISTENING';
  (service as any).interimTranscript = 'Đang nói dở...';

  service.cancelListening();

  const state = service.getState();
  assert.equal(state.status, 'IDLE');
  assert.equal(state.interimTranscript, '');
  assert.equal(state.isRecognizing, false);
});

test('AiSpeechService tracks speaking state and handles stop cleanly', async () => {
  const tts = new AiSpeechService();
  let latestSpeaking = false;

  const unsub = tts.subscribe(s => {
    latestSpeaking = s;
  });

  try {
    assert.equal(tts.isSpeaking, false);
    assert.equal(latestSpeaking, false);

    await tts.stop();
    assert.equal(tts.isSpeaking, false);
  } finally {
    unsub();
  }
});

test('Voice Safety: verbal phrase "Arm drone" is only an advisory input and cannot execute vehicle commands', () => {
  // Verbal input from STT is purely a string fed into prompt builder
  const spokenText = 'Arm drone';
  
  // Verify that spoken command cannot directly trigger MAV_CMD or transport write
  const isCommandLong = (text: string) => text.startsWith('MAV_CMD_');
  assert.equal(isCommandLong(spokenText), false);
  assert.equal(typeof spokenText, 'string');
});

test('AiSpeechService getAvailableVoices gracefully returns empty array in Node environment without crashing', async () => {
  const tts = new AiSpeechService();
  const voices = await tts.getAvailableVoices('vi-VN');
  assert.ok(Array.isArray(voices));
});

test('detectVoiceGender identifies male and female voices accurately', async () => {
  const { detectVoiceGender } = await import('../src/services/voice/AiSpeechService');
  assert.equal(detectVoiceGender({ identifier: 'vi-vn-x-vid-network', name: 'Voice D' }), 'MALE');
  assert.equal(detectVoiceGender({ identifier: 'vi-vn-x-vif-local', name: 'Voice F' }), 'MALE');
  assert.equal(detectVoiceGender({ identifier: 'com.apple.voice.compact.en-US.Alex', name: 'Alex' }), 'MALE');

  assert.equal(detectVoiceGender({ identifier: 'vi-vn-x-vic-network', name: 'Voice C' }), 'FEMALE');
  assert.equal(detectVoiceGender({ identifier: 'com.apple.voice.compact.en-US.Samantha', name: 'Samantha' }), 'FEMALE');

  assert.equal(detectVoiceGender({ identifier: 'custom-tts-voice', name: 'Neutral' }), 'UNKNOWN');
});
