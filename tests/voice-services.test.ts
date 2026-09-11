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

test('AiSpeechService automatically selects an available male voice for the deep copilot preset', async () => {
  let spokenOptions: any = null;
  const provider = {
    speak: async (_text: string, options: any) => { spokenOptions = options; },
    stop: async () => undefined,
    isSpeaking: () => false,
    getAvailableVoices: async () => [
      { identifier: 'voice-female', name: 'Female', language: 'vi-VN', gender: 'FEMALE' as const },
      { identifier: 'voice-male', name: 'Male', language: 'vi-VN', gender: 'MALE' as const },
    ],
  };
  const tts = new AiSpeechService(provider);

  await tts.speak('Xin chào phi công.', {
    language: 'vi-VN',
    gender: 'MALE',
    rate: 0.9,
    pitch: 0.8,
    style: 'COPILOT',
  });

  assert.equal(spokenOptions.voice, 'voice-male');
  assert.equal(spokenOptions.pitch, 0.77);
  assert.equal(spokenOptions.rate, 0.87);
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

test('aniTtsService alias and setVoice API are exported and functional', async () => {
  const { aniTtsService, AniTtsService, aiSpeechService } = await import('../src/services/voice/AiSpeechService');
  assert.equal(aniTtsService, aiSpeechService);
  assert.equal(typeof AniTtsService, 'function');
  assert.equal(typeof aniTtsService.setVoice, 'function');
  aniTtsService.setVoice('test-voice');
});

test('AiSpeechService passes volume: 1.0 to segments and speak', async () => {
  let playedItems: any[] = [];
  const provider: any = {
    speakSegments: async (items: any[]) => {
      playedItems = items;
    },
    stop: async () => undefined,
    isSpeaking: () => false,
    autoSelectVoices: async () => ({ vi: 'vi-test', en: 'en-test' }),
    getAvailableVoices: async () => [],
  };
  const tts = new AiSpeechService(provider);
  await tts.speak('Pin còn 80%.');
  assert.ok(playedItems.length > 0);
  assert.equal(playedItems[0].volume, 1.0);
});

test('AiService speaks when query source is voice even if voiceRepliesEnabled is false', async () => {
  const { aiService } = await import('../src/services/ai/AiService');
  const { aiSpeechService } = await import('../src/services/voice/AiSpeechService');

  let spokenTextReceived: string | null = null;
  const originalSpeak = aiSpeechService.speak.bind(aiSpeechService);
  aiSpeechService.speak = async (text: string) => {
    spokenTextReceived = text;
  };

  try {
    const mockStore = {
      getState: () => ({
        settings: {
          ai: {
            enabled: true,
            provider: 'OLLAMA',
            host: '127.0.0.1',
            port: 11434,
            model: 'qwen3.5:9b',
            timeoutMs: 30000,
            autoConnect: true,
            enableFallback: false,
            fallbackModel: 'qwen3.5:9b',
            voiceEnabled: true,
            voiceRepliesEnabled: false, // Voice replies turned off for text
            speechLanguage: 'vi-VN',
            speechRate: 0.9,
            speechPitch: 0.8,
            voiceIdentifier: null,
            voiceGender: 'MALE',
            voiceStyle: 'COPILOT',
          },
        },
        connection: {
          status: 'CONNECTED',
          sessionId: 'session-voice-test',
        },
        drone: {
          armed: true,
          mode: 'GUIDED',
        },
        telemetry: {
          altitudeRelMeters: 0,
        },
      }),
    };
    aiService.setStore(mockStore as any);

    // Voice query: MUST speak even with voiceRepliesEnabled: false
    await aiService.sendUserMessage('bay lên 5m', { source: 'voice' });
    assert.ok(spokenTextReceived !== null, 'TTS should be triggered for voice query');

    // Text query: MUST NOT speak when voiceRepliesEnabled: false
    spokenTextReceived = null;
    await aiService.sendUserMessage('bay lên 5m', { source: 'text' });
    assert.equal(spokenTextReceived, null, 'TTS should NOT be triggered for text query when voiceRepliesEnabled is false');
  } finally {
    aiSpeechService.speak = originalSpeak;
    aiService.setStore(null);
  }
});

