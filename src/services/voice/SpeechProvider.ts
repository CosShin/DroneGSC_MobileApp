import type { SpeechVoice, TtsOptions } from './AiSpeechService';
import { AniSpeechQueue, type QueueSegmentItem } from './AniSpeechQueue';

function isIOSPlatform(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native')?.Platform?.OS === 'ios';
  } catch {
    return false;
  }
}

export type VoiceProviderName = 'SYSTEM_TTS' | 'ELEVENLABS';
export type VoiceProviderState = 'READY' | 'UNCONFIGURED' | 'SPEAKING' | 'FALLBACK' | 'ERROR';

export interface VoiceProviderStatus {
  provider: VoiceProviderName;
  state: VoiceProviderState;
  lastError: string | null;
  fallbackProvider?: VoiceProviderName;
}

export interface NeuralVoiceConfig {
  provider: 'ELEVENLABS';
  apiKey?: string | null;
  voiceId?: string | null;
  modelId?: string | null;
  language?: string | null;
  timeoutMs?: number;
  endpointBaseUrl?: string;
}

type FetchLike = (input: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export type NeuralAudioPlayback = (audio: ArrayBuffer, metadata: {
  provider: VoiceProviderName;
  mimeType: string;
  voiceId: string;
}) => Promise<void>;

export interface ISpeechProvider {
  speak(text: string, options: TtsOptions): Promise<void>;
  speakSegments?(segments: QueueSegmentItem[]): Promise<void>;
  stop(): Promise<void>;
  isSpeaking(): boolean;
  getAvailableVoices(filterLang?: string): Promise<SpeechVoice[]>;
  autoSelectVoices?(): Promise<{ vi: string | null; en: string | null }>;
  getAutoSelectedVoices?(): { vi: string | null; en: string | null };
  isAvailable?(): boolean;
  getStatus?(): VoiceProviderStatus;
}

let nativeSpeechModuleCached: any = undefined;

function getNativeSpeechModule(): any {
  if (nativeSpeechModuleCached !== undefined) {
    return nativeSpeechModuleCached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nativeSpeechModuleCached = require('expo-speech');
  } catch {
    nativeSpeechModuleCached = null;
  }
  return nativeSpeechModuleCached;
}

/**
  * SystemSpeechProvider
  * Production speech provider powered by platform native speech engines (iOS AVSpeechSynthesizer, Android TextToSpeech).
  */
export class SystemSpeechProvider implements ISpeechProvider {
  private _isSpeaking = false;
  private onStateChange?: (speaking: boolean) => void;
  private speechQueue: AniSpeechQueue;
  private autoSelectedViVoice: string | null = null;
  private autoSelectedEnVoice: string | null = null;

  constructor(onStateChange?: (speaking: boolean) => void) {
    this.onStateChange = onStateChange;
    this.speechQueue = new AniSpeechQueue(
      (text, opts) => {
        const Speech = getNativeSpeechModule();
        if (Speech && typeof Speech.speak === 'function') {
          try {
            const speakOptions: any = {
              language: opts.language,
              voice: opts.voice || undefined,
              rate: opts.rate ?? 0.95,
              pitch: opts.pitch ?? 1.0,
              volume: opts.volume ?? 1.0,
              onStart: opts.onStart,
              onDone: opts.onDone,
              onStopped: opts.onStopped,
              onError: (error?: any) => {
                console.warn('[SystemSpeechProvider] Segment error:', error);
                // Safe fallback if custom voice or specific language code failed
                if (opts.voice) {
                  try {
                    const retryOptions: any = {
                      language: opts.language,
                      rate: opts.rate ?? 0.95,
                      pitch: opts.pitch ?? 1.0,
                      volume: opts.volume ?? 1.0,
                      onStart: opts.onStart,
                      onDone: opts.onDone,
                      onStopped: opts.onStopped,
                      onError: opts.onError,
                    };
                    if (isIOSPlatform()) {
                      retryOptions.useApplicationAudioSession = false;
                    }
                    Speech.speak(text, retryOptions);
                    return;
                  } catch (retryErr) {
                    console.warn('[SystemSpeechProvider] Retry error:', retryErr);
                  }
                }
                opts.onError?.(error);
              },
            };

            if (isIOSPlatform()) {
              speakOptions.useApplicationAudioSession = false;
            }

            Speech.speak(text, speakOptions);
          } catch (err) {
            console.warn('[SystemSpeechProvider] Speech.speak threw:', err);
            opts.onError?.(err);
          }
        } else {
          opts.onError?.();
        }
      },
      async () => {
        const Speech = getNativeSpeechModule();
        try {
          if (Speech && typeof Speech.stop === 'function') {
            await Speech.stop();
          }
        } catch {
          // Ignore stop error
        }
      }
    );

    this.speechQueue.subscribe((speaking) => {
      this.setSpeaking(speaking);
    });
  }

  isSpeaking(): boolean {
    return this._isSpeaking;
  }

  private setSpeaking(val: boolean) {
    this._isSpeaking = val;
    this.onStateChange?.(val);
  }

  async getAvailableVoices(filterLang?: string): Promise<SpeechVoice[]> {
    const Speech = getNativeSpeechModule();
    if (!Speech || typeof Speech.getAvailableVoicesAsync !== 'function') {
      return [];
    }

    try {
      const rawVoices: any[] = await Speech.getAvailableVoicesAsync();
      if (!Array.isArray(rawVoices)) return [];

      const { detectVoiceGender } = require('./AiSpeechService');

      const voices: SpeechVoice[] = rawVoices.map(v => ({
        identifier: v.identifier || '',
        name: v.name || v.identifier || '',
        quality: v.quality,
        language: v.language || '',
        gender: detectVoiceGender(v),
      }));

      let filtered = voices;
      if (filterLang) {
        const langPrefix = filterLang.split('-')[0].toLowerCase();
        filtered = voices.filter(v => {
          const l = (v.language || '').toLowerCase().replace('_', '-');
          return l.startsWith(langPrefix) || l.startsWith(filterLang.toLowerCase());
        });
      }

      // Prioritize Enhanced quality, then alphabetical
      return filtered.sort((a, b) => {
        const aEnhanced = a.quality === 'Enhanced' ? 1 : 0;
        const bEnhanced = b.quality === 'Enhanced' ? 1 : 0;
        if (aEnhanced !== bEnhanced) return bEnhanced - aEnhanced;
        return (a.name || '').localeCompare(b.name || '');
      });
    } catch {
      return [];
    }
  }

  async autoSelectVoices(): Promise<{ vi: string | null; en: string | null }> {
    const voices = await this.getAvailableVoices();
    const viVoices = voices.filter(v => (v.language || '').toLowerCase().replace('_', '-').startsWith('vi'));
    const bestVi = viVoices.find(v => v.quality === 'Enhanced') || viVoices[0] || null;

    const enVoices = voices.filter(v => (v.language || '').toLowerCase().replace('_', '-').startsWith('en'));
    const bestEn = enVoices.find(v => v.quality === 'Enhanced') || enVoices[0] || null;

    this.autoSelectedViVoice = bestVi ? bestVi.identifier : null;
    this.autoSelectedEnVoice = bestEn ? bestEn.identifier : null;

    return {
      vi: this.autoSelectedViVoice,
      en: this.autoSelectedEnVoice,
    };
  }

  getAutoSelectedVoices(): { vi: string | null; en: string | null } {
    return {
      vi: this.autoSelectedViVoice,
      en: this.autoSelectedEnVoice,
    };
  }

  isAvailable(): boolean {
    const Speech = getNativeSpeechModule();
    return !!Speech && typeof Speech.speak === 'function';
  }

  getStatus(): VoiceProviderStatus {
    return {
      provider: 'SYSTEM_TTS',
      state: this._isSpeaking ? 'SPEAKING' : 'READY',
      lastError: null,
    };
  }

  async speak(text: string, options: TtsOptions): Promise<void> {
    const lang = (options.language || 'vi-VN') as 'vi-VN' | 'en-US';
    await this.speakSegments([{
      text,
      lang: lang === 'en-US' ? 'en-US' : 'vi-VN',
      voice: options.voice,
      rate: options.rate,
      pitch: options.pitch,
      volume: options.volume ?? 1.0,
    }]);
  }

  async speakSegments(segments: QueueSegmentItem[]): Promise<void> {
    await this.speechQueue.play(segments);
  }

  async stop(): Promise<void> {
    await this.speechQueue.stop();
  }
}


export class ElevenLabsVoiceProvider implements ISpeechProvider {
  private config: Required<Pick<NeuralVoiceConfig, 'provider'>> & Omit<NeuralVoiceConfig, 'provider'>;
  private fetchFn: FetchLike;
  private playAudio?: NeuralAudioPlayback;
  private abortController: AbortController | null = null;
  private _isSpeaking = false;
  private lastError: string | null = null;

  constructor(
    config: NeuralVoiceConfig,
    deps: { fetch?: FetchLike; playAudio?: NeuralAudioPlayback } = {},
  ) {
    this.config = { ...config, provider: 'ELEVENLABS' };
    this.fetchFn = deps.fetch ?? (globalThis.fetch as FetchLike);
    this.playAudio = deps.playAudio;
  }

  configure(config: Partial<NeuralVoiceConfig>) {
    this.config = { ...this.config, ...config, provider: 'ELEVENLABS' };
  }

  isSpeaking(): boolean {
    return this._isSpeaking;
  }

  isAvailable(): boolean {
    return (!!this.config.apiKey?.trim() || !!this.config.endpointBaseUrl?.trim())
      && !!this.config.voiceId?.trim()
      && typeof this.fetchFn === 'function'
      && typeof this.playAudio === 'function';
  }

  getStatus(): VoiceProviderStatus {
    return {
      provider: 'ELEVENLABS',
      state: this._isSpeaking ? 'SPEAKING' : this.isAvailable() ? 'READY' : this.lastError ? 'ERROR' : 'UNCONFIGURED',
      lastError: this.lastError,
    };
  }

  async getAvailableVoices(): Promise<SpeechVoice[]> {
    return [];
  }

  async speak(text: string, options: TtsOptions): Promise<void> {
    const apiKey = this.config.apiKey?.trim();
    const voiceId = this.config.voiceId?.trim();
    if ((!apiKey && !this.config.endpointBaseUrl?.trim()) || !voiceId) {
      this.lastError = 'NEURAL_TTS_UNCONFIGURED';
      throw new Error(this.lastError);
    }
    if (!this.playAudio) {
      this.lastError = 'NEURAL_TTS_PLAYBACK_UNAVAILABLE';
      throw new Error(this.lastError);
    }
    if (typeof this.fetchFn !== 'function') {
      this.lastError = 'NEURAL_TTS_FETCH_UNAVAILABLE';
      throw new Error(this.lastError);
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.abortController = new AbortController();
    this._isSpeaking = true;
    this.lastError = null;

    const timeoutMs = Math.max(1000, this.config.timeoutMs ?? 8000);
    const timeout = setTimeout(() => this.abortController?.abort(), timeoutMs);
    const endpointBaseUrl = (this.config.endpointBaseUrl || 'https://api.elevenlabs.io/v1').replace(/\/+$/, '');
    const modelId = this.config.modelId || 'eleven_multilingual_v2';
    const language = this.config.language || options.language || 'vi-VN';

    try {
      const headers: Record<string, string> = {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
      };
      if (apiKey) headers['xi-api-key'] = apiKey;

      const result = await this.fetchFn(`${endpointBaseUrl}/text-to-speech/${encodeURIComponent(voiceId)}`, {
        method: 'POST',
        signal: this.abortController.signal,
        headers,
        body: JSON.stringify({
          text,
          model_id: modelId,
          language_code: language,
          voice_settings: {
            stability: options.tone === 'URGENT' ? 0.58 : 0.68,
            similarity_boost: 0.75,
            style: options.style === 'CALM' ? 0.08 : 0.16,
            use_speaker_boost: true,
          },
        }),
      });

      if (!result.ok) {
        const body = await result.text().catch(() => '');
        this.lastError = `NEURAL_TTS_HTTP_${result.status}`;
        throw new Error(`${this.lastError}${body ? ': request failed' : ''}`);
      }

      const audio = await result.arrayBuffer();
      await this.playAudio(audio, {
        provider: 'ELEVENLABS',
        mimeType: 'audio/mpeg',
        voiceId,
      });
    } catch (error) {
      this.lastError = error instanceof Error && error.name === 'AbortError'
        ? 'NEURAL_TTS_TIMEOUT'
        : error instanceof Error
          ? error.message
          : 'NEURAL_TTS_ERROR';
      throw error instanceof Error ? error : new Error(this.lastError);
    } finally {
      clearTimeout(timeout);
      this.abortController = null;
      this._isSpeaking = false;
    }
  }

  async stop(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this._isSpeaking = false;
  }
}

export class FallbackSpeechProvider implements ISpeechProvider {
  private lastStatus: VoiceProviderStatus;

  constructor(
    private primary: ISpeechProvider,
    private fallback: ISpeechProvider,
  ) {
    this.lastStatus = {
      provider: 'SYSTEM_TTS',
      state: 'READY',
      lastError: null,
    };
  }

  isSpeaking(): boolean {
    return this.primary.isSpeaking() || this.fallback.isSpeaking();
  }

  isAvailable(): boolean {
    return this.primary.isAvailable?.() || this.fallback.isAvailable?.() || true;
  }

  getStatus(): VoiceProviderStatus {
    if (this.isSpeaking()) return { ...this.lastStatus, state: 'SPEAKING' };
    return this.lastStatus;
  }

  async getAvailableVoices(filterLang?: string): Promise<SpeechVoice[]> {
    return this.fallback.getAvailableVoices(filterLang);
  }

  async speak(text: string, options: TtsOptions): Promise<void> {
    const primaryAvailable = this.primary.isAvailable?.() ?? true;
    if (primaryAvailable) {
      try {
        await this.primary.speak(text, options);
        this.lastStatus = {
          provider: this.primary.getStatus?.().provider ?? 'ELEVENLABS',
          state: 'READY',
          lastError: null,
        };
        return;
      } catch (error) {
        this.lastStatus = {
          provider: 'SYSTEM_TTS',
          state: 'FALLBACK',
          lastError: error instanceof Error ? error.message : 'NEURAL_TTS_ERROR',
          fallbackProvider: 'SYSTEM_TTS',
        };
      }
    } else {
      this.lastStatus = {
        provider: 'SYSTEM_TTS',
        state: 'FALLBACK',
        lastError: this.primary.getStatus?.().lastError ?? 'NEURAL_TTS_UNAVAILABLE',
        fallbackProvider: 'SYSTEM_TTS',
      };
    }

    await this.fallback.speak(text, options);
  }

  async speakSegments(segments: QueueSegmentItem[]): Promise<void> {
    const primaryAvailable = this.primary.isAvailable?.() ?? true;
    if (primaryAvailable && this.primary.speakSegments) {
      try {
        await this.primary.speakSegments(segments);
        this.lastStatus = {
          provider: this.primary.getStatus?.().provider ?? 'ELEVENLABS',
          state: 'READY',
          lastError: null,
        };
        return;
      } catch (error) {
        this.lastStatus = {
          provider: 'SYSTEM_TTS',
          state: 'FALLBACK',
          lastError: error instanceof Error ? error.message : 'NEURAL_TTS_ERROR',
          fallbackProvider: 'SYSTEM_TTS',
        };
      }
    }

    if (this.fallback.speakSegments) {
      await this.fallback.speakSegments(segments);
    } else {
      for (const seg of segments) {
        await this.fallback.speak(seg.text, {
          language: seg.lang,
          voice: seg.voice,
          rate: seg.rate,
          pitch: seg.pitch,
        });
      }
    }
  }

  async autoSelectVoices(): Promise<{ vi: string | null; en: string | null }> {
    if (this.fallback.autoSelectVoices) {
      return this.fallback.autoSelectVoices();
    }
    if (this.primary.autoSelectVoices) {
      return this.primary.autoSelectVoices();
    }
    return { vi: null, en: null };
  }

  getAutoSelectedVoices(): { vi: string | null; en: string | null } {
    if (this.fallback.getAutoSelectedVoices) {
      return this.fallback.getAutoSelectedVoices();
    }
    if (this.primary.getAutoSelectedVoices) {
      return this.primary.getAutoSelectedVoices();
    }
    return { vi: null, en: null };
  }

  async stop(): Promise<void> {
    await Promise.all([
      this.primary.stop().catch(() => undefined),
      this.fallback.stop().catch(() => undefined),
    ]);
  }
}
