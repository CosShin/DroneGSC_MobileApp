import type { SpeechVoice, TtsOptions } from './AiSpeechService';

export interface ISpeechProvider {
  speak(text: string, options: TtsOptions): Promise<void>;
  stop(): Promise<void>;
  isSpeaking(): boolean;
  getAvailableVoices(filterLang?: string): Promise<SpeechVoice[]>;
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

  constructor(onStateChange?: (speaking: boolean) => void) {
    this.onStateChange = onStateChange;
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

  async speak(text: string, options: TtsOptions): Promise<void> {
    const Speech = getNativeSpeechModule();
    if (!Speech || typeof Speech.speak !== 'function') {
      this.setSpeaking(false);
      return;
    }

    this.setSpeaking(true);

    const speakOptions: any = {
      language: options.language || 'vi-VN',
      rate: options.rate ?? 1.0,
      pitch: options.pitch ?? 1.0,
      onDone: () => {
        this.setSpeaking(false);
      },
      onStopped: () => {
        this.setSpeaking(false);
      },
      onError: () => {
        this.setSpeaking(false);
      },
    };

    if (options.voice) {
      speakOptions.voice = options.voice;
    }

    try {
      Speech.speak(text, speakOptions);
    } catch {
      if (speakOptions.voice) {
        try {
          delete speakOptions.voice;
          Speech.speak(text, speakOptions);
          return;
        } catch {
          // Ignore
        }
      }
      this.setSpeaking(false);
    }
  }

  async stop(): Promise<void> {
    const Speech = getNativeSpeechModule();
    try {
      if (Speech && typeof Speech.stop === 'function') {
        await Speech.stop();
      }
    } catch {
      // Ignore stop error
    } finally {
      this.setSpeaking(false);
    }
  }
}
