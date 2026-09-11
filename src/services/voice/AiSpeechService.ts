import { prepareTextForSpeech, type SpeechLanguage } from './SpeechSanitizer';
import type { SpeechTone } from '../ai/AiTypes';
import { getEffectiveProsody } from './SpokenResponseBuilder';
import { segmentMixedText } from './MixedLanguageTts';
import type { QueueSegmentItem } from './AniSpeechQueue';
import {
  ElevenLabsVoiceProvider,
  FallbackSpeechProvider,
  ISpeechProvider,
  SystemSpeechProvider,
  type NeuralAudioPlayback,
  type NeuralVoiceConfig,
  type VoiceProviderStatus,
} from './SpeechProvider';

export type VoiceGender = 'MALE' | 'FEMALE' | 'UNKNOWN';

export interface SpeechVoice {
  identifier: string;
  name: string;
  quality?: string;
  language: string;
  gender?: VoiceGender;
}

export interface TtsOptions {
  voice?: string | null;
  vietnameseVoice?: string | null;
  englishVoice?: string | null;
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  gender?: 'DEFAULT' | 'MALE' | 'FEMALE';
  tone?: SpeechTone;
  style?: 'NATURAL' | 'COPILOT' | 'CALM';
}

/**
 * Detects whether a device voice is male, female, or unclassified
 * by scanning its identifier and name against known OS naming conventions.
 */
export function detectVoiceGender(v: { identifier?: string; name?: string }): VoiceGender {
  const id = (v.identifier || '').toLowerCase();
  const name = (v.name || '').toLowerCase();
  const str = `${id} ${name}`;

  // Common Android (Google/Samsung) & iOS (Siri/Compact) male patterns
  if (
    /\b(male|nam|vid|vif|man|guy|boy|alex|fred|daniel|aaron|arthur|voice\s*2|voice\s*4)\b/i.test(str) ||
    str.includes('-vid-') ||
    str.includes('-vif-') ||
    str.includes('-male')
  ) {
    return 'MALE';
  }

  // Common Android & iOS female patterns
  if (
    /\b(female|nu|nữ|vic|vie|woman|girl|samantha|victoria|karen|moira|tessa|fiona|voice\s*1|voice\s*3)\b/i.test(str) ||
    str.includes('-vic-') ||
    str.includes('-vie-') ||
    str.includes('-female')
  ) {
    return 'FEMALE';
  }

  return 'UNKNOWN';
}

// Backwards-compatible export
export function cleanTextForSpeech(raw: string): string {
  return prepareTextForSpeech(raw, 'vi-VN');
}

export class AiSpeechService {
  private provider: ISpeechProvider;
  private systemProvider: SystemSpeechProvider;
  private elevenLabsProvider: ElevenLabsVoiceProvider | null = null;
  private listeners = new Set<(isSpeaking: boolean) => void>();
  private preferredVoiceCache = new Map<string, string | null>();
  private autoSelectedViVoice: string | null = null;
  private autoSelectedEnVoice: string | null = null;
  private _isMuted = false;
  private muteListeners = new Set<(isMuted: boolean) => void>();

  constructor(customProvider?: ISpeechProvider) {
    this.systemProvider = new SystemSpeechProvider((speaking) => {
      this.listeners.forEach(l => l(speaking));
    });
    this.provider = customProvider || this.systemProvider;
  }

  get isSpeaking(): boolean {
    return this.provider.isSpeaking();
  }

  get isMuted(): boolean {
    return this._isMuted;
  }

  setMuted(muted: boolean): void {
    if (this._isMuted === muted) return;
    this._isMuted = muted;
    this.muteListeners.forEach(listener => listener(muted));
    if (muted) {
      void this.stop();
    }
  }

  /**
   * Immediately interrupts ongoing speech, clears queue,
   * transitions ANI state to IDLE, and marks TTS as muted.
   */
  async mute(): Promise<void> {
    this._isMuted = true;
    this.muteListeners.forEach(listener => listener(true));
    await this.stop();
  }

  /**
   * Unmutes TTS. Does NOT replay previously interrupted or missed speech.
   */
  unmute(): void {
    this._isMuted = false;
    this.muteListeners.forEach(listener => listener(false));
  }

  subscribeMute(listener: (isMuted: boolean) => void): () => void {
    this.muteListeners.add(listener);
    listener(this._isMuted);
    return () => {
      this.muteListeners.delete(listener);
    };
  }

  setProvider(provider: ISpeechProvider) {
    this.provider = provider;
  }

  configureNeuralVoice(config: NeuralVoiceConfig | null, playback?: NeuralAudioPlayback) {
    if (!config || config.provider !== 'ELEVENLABS') {
      this.elevenLabsProvider = null;
      this.provider = this.systemProvider;
      return;
    }

    if (this.elevenLabsProvider) {
      this.elevenLabsProvider.configure(config);
    } else {
      this.elevenLabsProvider = new ElevenLabsVoiceProvider(config, { playAudio: playback });
    }
    this.provider = new FallbackSpeechProvider(this.elevenLabsProvider, this.systemProvider);
  }

  getProviderStatus(): VoiceProviderStatus {
    return this.provider.getStatus?.() ?? {
      provider: 'SYSTEM_TTS',
      state: this.provider.isSpeaking() ? 'SPEAKING' : 'READY',
      lastError: null,
    };
  }

  subscribe(listener: (isSpeaking: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this.isSpeaking);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async getAvailableVoices(filterLang?: string): Promise<SpeechVoice[]> {
    return this.provider.getAvailableVoices(filterLang);
  }

  async autoSelectVoices(): Promise<{ vi: string | null; en: string | null }> {
    if (typeof this.provider.autoSelectVoices === 'function') {
      const auto = await this.provider.autoSelectVoices();
      this.autoSelectedViVoice = auto.vi;
      this.autoSelectedEnVoice = auto.en;
      return auto;
    }
    return { vi: null, en: null };
  }

  async speak(text: string, options: TtsOptions = {}): Promise<void> {
    if (this._isMuted) return;
    if (!text || typeof text !== 'string' || !text.trim()) return;

    // Interrupt any ongoing speech
    await this.stop();

    const lang = (options.language || 'vi-VN') as SpeechLanguage;
    let resolvedVoice = options.voice || null;
    if (!resolvedVoice && options.gender && options.gender !== 'DEFAULT') {
      const cacheKey = `${lang}:${options.gender}`;
      if (this.preferredVoiceCache.has(cacheKey)) {
        resolvedVoice = this.preferredVoiceCache.get(cacheKey) ?? null;
      } else {
        const voices = await this.provider.getAvailableVoices(lang).catch(() => []);
        resolvedVoice = voices.find(voice => voice.gender === options.gender)?.identifier || null;
        if (resolvedVoice) this.preferredVoiceCache.set(cacheKey, resolvedVoice);
      }
    }

    // Calculate deterministic prosody based on real flight tone & style
    const tone = options.tone || 'NORMAL';
    const prosody = getEffectiveProsody(
      tone,
      options.rate ?? 1.0,
      options.pitch ?? 1.0,
      options.style
    );

    let effectivePitch = prosody.pitch;
    if (options.gender === 'MALE' && !resolvedVoice) {
      effectivePitch = Number((prosody.pitch * 0.85).toFixed(2));
    } else if (options.gender === 'FEMALE' && !resolvedVoice) {
      effectivePitch = Number((prosody.pitch * 1.05).toFixed(2));
    }
    effectivePitch = Math.max(0.7, Math.min(1.4, effectivePitch));

    // If provider supports speakSegments (System TTS with mixed language pipeline)
    if (typeof this.provider.speakSegments === 'function') {
      const segments = segmentMixedText(text);
      if (segments.length === 0) return;

      // Ensure auto-selected voices are resolved
      if (!this.autoSelectedViVoice || !this.autoSelectedEnVoice) {
        if (typeof this.provider.autoSelectVoices === 'function') {
          const auto = await this.provider.autoSelectVoices().catch(() => ({ vi: null, en: null }));
          this.autoSelectedViVoice = auto.vi;
          this.autoSelectedEnVoice = auto.en;
        }
      }

      const queueItems: QueueSegmentItem[] = segments.map(seg => {
        let voice: string | null = null;
        if (seg.lang === 'vi-VN') {
          voice = options.vietnameseVoice || resolvedVoice || this.autoSelectedViVoice || null;
        } else {
          voice = options.englishVoice || this.autoSelectedEnVoice || null;
        }

        return {
          text: seg.text,
          lang: seg.lang,
          voice,
          rate: prosody.rate,
          pitch: effectivePitch,
          volume: options.volume ?? 1.0,
        };
      });

      await this.provider.speakSegments(queueItems);
      return;
    }

    // Fallback for custom or legacy single-voice providers (e.g. ElevenLabs, unit test mocks)
    const cleanText = prepareTextForSpeech(text, lang);
    if (!cleanText) return;

    await this.provider.speak(cleanText, {
      ...options,
      voice: resolvedVoice,
      language: lang,
      rate: prosody.rate,
      pitch: effectivePitch,
      volume: options.volume ?? 1.0,
    });
  }

  setVoice(voiceIdentifier: string | null): void {
    this.preferredVoiceCache.clear();
  }

  async speakSegments(segments: QueueSegmentItem[]): Promise<void> {
    if (this._isMuted) return;
    await this.stop();
    if (typeof this.provider.speakSegments === 'function') {
      await this.provider.speakSegments(segments);
    } else {
      for (const seg of segments) {
        await this.provider.speak(seg.text, {
          language: seg.lang,
          voice: seg.voice,
          rate: seg.rate,
          pitch: seg.pitch,
          volume: seg.volume ?? 1.0,
        });
      }
    }
  }

  async stop(): Promise<void> {
    await this.provider.stop();
  }
}

export const aiSpeechService = new AiSpeechService();
export const aniTtsService = aiSpeechService;
export const AniTtsService = AiSpeechService;
