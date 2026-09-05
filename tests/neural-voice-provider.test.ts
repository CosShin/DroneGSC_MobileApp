import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ElevenLabsVoiceProvider,
  FallbackSpeechProvider,
  type ISpeechProvider,
} from '../src/services/voice/SpeechProvider';
import type { SpeechVoice, TtsOptions } from '../src/services/voice/AiSpeechService';

function okResponse(audio = new Uint8Array([1, 2, 3]).buffer) {
  return {
    ok: true,
    status: 200,
    async text() {
      return '';
    },
    async arrayBuffer() {
      return audio;
    },
  };
}

class FakeSystemProvider implements ISpeechProvider {
  spoken: string[] = [];
  stopped = 0;
  speaking = false;

  async speak(text: string): Promise<void> {
    this.spoken.push(text);
  }

  async stop(): Promise<void> {
    this.stopped++;
    this.speaking = false;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  async getAvailableVoices(): Promise<SpeechVoice[]> {
    return [];
  }

  isAvailable(): boolean {
    return true;
  }
}

test('ElevenLabsVoiceProvider posts text and plays returned audio without exposing API key', async () => {
  let requestUrl = '';
  let requestBody: any = null;
  let requestHeaders: Record<string, string> = {};
  let playedBytes = 0;

  const provider = new ElevenLabsVoiceProvider({
    provider: 'ELEVENLABS',
    apiKey: 'secret-key',
    voiceId: 'voice-123',
    modelId: 'eleven_multilingual_v2',
    language: 'vi-VN',
    timeoutMs: 5000,
    endpointBaseUrl: 'https://tts.test/v1',
  }, {
    fetch: async (url, init) => {
      requestUrl = url;
      requestBody = JSON.parse(init?.body || '{}');
      requestHeaders = init?.headers || {};
      return okResponse();
    },
    playAudio: async audio => {
      playedBytes = audio.byteLength;
    },
  });

  await provider.speak('Pin 24 phần trăm.', { language: 'vi-VN', tone: 'CAUTION' });

  assert.equal(requestUrl, 'https://tts.test/v1/text-to-speech/voice-123');
  assert.equal(requestBody.text, 'Pin 24 phần trăm.');
  assert.equal(requestBody.model_id, 'eleven_multilingual_v2');
  assert.equal(requestBody.language_code, 'vi-VN');
  assert.equal(requestHeaders['xi-api-key'], 'secret-key');
  assert.equal(playedBytes, 3);
  assert.equal(provider.getStatus().lastError, null);
});

test('FallbackSpeechProvider uses System TTS when neural voice fails', async () => {
  const neural = new ElevenLabsVoiceProvider({
    provider: 'ELEVENLABS',
    apiKey: 'secret-key',
    voiceId: 'voice-123',
    timeoutMs: 5000,
  }, {
    fetch: async () => ({
      ok: false,
      status: 503,
      async text() {
        return 'unavailable';
      },
      async arrayBuffer() {
        return new ArrayBuffer(0);
      },
    }),
    playAudio: async () => undefined,
  });
  const system = new FakeSystemProvider();
  const fallback = new FallbackSpeechProvider(neural, system);

  await fallback.speak('System fallback sentence.', {} as TtsOptions);

  assert.deepEqual(system.spoken, ['System fallback sentence.']);
  assert.equal(fallback.getStatus().state, 'FALLBACK');
  assert.equal(fallback.getStatus().fallbackProvider, 'SYSTEM_TTS');
});

test('ElevenLabsVoiceProvider stop aborts an in-flight request', async () => {
  let aborted = false;
  const provider = new ElevenLabsVoiceProvider({
    provider: 'ELEVENLABS',
    apiKey: 'secret-key',
    voiceId: 'voice-123',
    timeoutMs: 10000,
  }, {
    fetch: async (_url, init) => new Promise<any>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        aborted = true;
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }),
    playAudio: async () => undefined,
  });

  const speaking = provider.speak('Long sentence.', {}).catch(error => error);
  await provider.stop();
  const result = await speaking;

  assert.equal(aborted, true);
  assert.ok(result instanceof Error);
  assert.equal(provider.isSpeaking(), false);
});
