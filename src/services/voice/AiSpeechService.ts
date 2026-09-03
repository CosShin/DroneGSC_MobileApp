import { prepareTextForSpeech, type SpeechLanguage } from './SpeechSanitizer';
import type { SpeechTone } from '../ai/AiTypes';
import { getEffectiveProsody } from './SpokenResponseBuilder';
import { ISpeechProvider, SystemSpeechProvider } from './SpeechProvider';

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
  language?: string;
  rate?: number;
  pitch?: number;
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
  private listeners = new Set<(isSpeaking: boolean) => void>();

  constructor(customProvider?: ISpeechProvider) {
    this.provider = customProvider || new SystemSpeechProvider((speaking) => {
      this.listeners.forEach(l => l(speaking));
    });
  }

  get isSpeaking(): boolean {
    return this.provider.isSpeaking();
  }

  setProvider(provider: ISpeechProvider) {
    this.provider = provider;
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

  async speak(text: string, options: TtsOptions = {}): Promise<void> {
    const lang = (options.language || 'vi-VN') as SpeechLanguage;
    const cleanText = prepareTextForSpeech(text, lang);
    if (!cleanText) return;

    // Interrupt any ongoing speech
    await this.stop();

    // Calculate deterministic prosody based on real flight tone & style
    const tone = options.tone || 'NORMAL';
    const prosody = getEffectiveProsody(
      tone,
      options.rate ?? 1.0,
      options.pitch ?? 1.0,
      options.style
    );

    let effectivePitch = prosody.pitch;
    if (options.gender === 'MALE' && (options.pitch == null || options.pitch === 1.0)) {
      effectivePitch = Number((prosody.pitch * 0.85).toFixed(2));
    } else if (options.gender === 'FEMALE' && (options.pitch == null || options.pitch === 1.0)) {
      effectivePitch = Number((prosody.pitch * 1.05).toFixed(2));
    }

    await this.provider.speak(cleanText, {
      ...options,
      language: lang,
      rate: prosody.rate,
      pitch: effectivePitch,
    });
  }

  async stop(): Promise<void> {
    await this.provider.stop();
  }
}

export const aiSpeechService = new AiSpeechService();
