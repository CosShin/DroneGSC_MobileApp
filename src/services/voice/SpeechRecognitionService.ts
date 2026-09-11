function isIOSPlatform(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native')?.Platform?.OS === 'ios';
  } catch {
    return false;
  }
}

export type SpeechRecognitionStatus = 
  | 'IDLE' 
  | 'REQUESTING_PERMISSION' 
  | 'LISTENING' 
  | 'PROCESSING' 
  | 'ERROR';

export type SpeechErrorCode = 
  | 'MIC_PERMISSION_DENIED' 
  | 'SPEECH_RECOGNITION_UNAVAILABLE' 
  | 'NO_SPEECH_DETECTED' 
  | 'RECOGNITION_ERROR';

export interface SpeechRecognitionState {
  status: SpeechRecognitionStatus;
  transcript: string;
  interimTranscript: string;
  errorCode: SpeechErrorCode | null;
  errorMessage: string | null;
  isRecognizing: boolean;
  confidence: number | null;
}

export interface SpeechStartOptions {
  lang?: string;
  requiresOnDevice?: boolean;
}

let nativeModuleCached: any = undefined;

function getNativeSpeechModule(): any {
  if (nativeModuleCached !== undefined) {
    return nativeModuleCached;
  }
  try {
    // Safely query native module without triggering static package import errors
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expo = require('expo');
    if (typeof expo?.requireOptionalNativeModule === 'function') {
      nativeModuleCached = expo.requireOptionalNativeModule('ExpoSpeechRecognition');
    } else {
      nativeModuleCached = null;
    }
  } catch {
    nativeModuleCached = null;
  }
  return nativeModuleCached;
}

export class SpeechRecognitionService {
  private status: SpeechRecognitionStatus = 'IDLE';
  private transcript = '';
  private interimTranscript = '';
  private confidence: number | null = null;
  private errorCode: SpeechErrorCode | null = null;
  private errorMessage: string | null = null;
  private listeners = new Set<(state: SpeechRecognitionState) => void>();
  private activeSubscriptions: Array<{ remove: () => void }> = [];
  private stopPromiseResolve: ((transcript: string) => void) | null = null;

  getState(): SpeechRecognitionState {
    return {
      status: this.status,
      transcript: this.transcript,
      interimTranscript: this.interimTranscript,
      errorCode: this.errorCode,
      errorMessage: this.errorMessage,
      isRecognizing: this.status === 'LISTENING',
      confidence: this.confidence,
    };
  }

  subscribe(listener: (state: SpeechRecognitionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const state = this.getState();
    this.listeners.forEach(l => l(state));
  }

  isAvailable(): boolean {
    const mod = getNativeSpeechModule();
    if (!mod) return false;
    try {
      if (typeof mod.isRecognitionAvailable === 'function') {
        return Boolean(mod.isRecognitionAvailable());
      }
      return true;
    } catch {
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    const mod = getNativeSpeechModule();
    if (!mod || typeof mod.requestPermissionsAsync !== 'function') {
      this.status = 'ERROR';
      this.errorCode = 'SPEECH_RECOGNITION_UNAVAILABLE';
      this.errorMessage = 'Speech recognition requires a development build (npx expo run:android / expo run:ios).';
      this.emit();
      return false;
    }

    this.status = 'REQUESTING_PERMISSION';
    this.errorCode = null;
    this.errorMessage = null;
    this.emit();

    try {
      const result = await mod.requestPermissionsAsync();
      const granted = result?.granted === true || result?.status === 'granted';
      if (!granted) {
        this.status = 'ERROR';
        this.errorCode = 'MIC_PERMISSION_DENIED';
        this.errorMessage = 'Microphone or Speech Recognition permission was denied in device settings.';
        this.emit();
        return false;
      }
      this.status = 'IDLE';
      this.emit();
      return true;
    } catch (error) {
      this.status = 'ERROR';
      this.errorCode = 'MIC_PERMISSION_DENIED';
      this.errorMessage = error instanceof Error ? error.message : 'Failed to obtain microphone permission.';
      this.emit();
      return false;
    }
  }

  private async resetAudioSessionToPlayback(): Promise<void> {
    const mod = getNativeSpeechModule();
    if (isIOSPlatform() && mod) {
      try {
        if (typeof mod.setCategoryIOS === 'function') {
          await mod.setCategoryIOS({
            category: 'playback',
            categoryOptions: ['duckOthers', 'defaultToSpeaker'],
            mode: 'default',
          });
          console.log('[SpeechRecognitionService] iOS audio session set to playback');
        }
      } catch (err) {
        console.warn('[SpeechRecognitionService] Failed to set playback category:', err);
      }
      try {
        if (typeof mod.setAudioSessionActiveIOS === 'function') {
          await mod.setAudioSessionActiveIOS(false, { notifyOthersOnDeactivation: true });
          console.log('[SpeechRecognitionService] iOS audio session deactivated');
        }
      } catch (err) {
        console.warn('[SpeechRecognitionService] Failed to deactivate audio session:', err);
      }
    }
  }

  async startListening(options: SpeechStartOptions = {}): Promise<void> {
    const mod = getNativeSpeechModule();
    if (!mod || typeof mod.start !== 'function') {
      this.status = 'ERROR';
      this.errorCode = 'SPEECH_RECOGNITION_UNAVAILABLE';
      this.errorMessage = 'Speech recognition requires a development build (npx expo run:android / expo run:ios).';
      this.emit();
      return;
    }

    // Stop any existing TTS playback immediately before opening microphone
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { aiSpeechService } = require('./AiSpeechService');
      await aiSpeechService.stop();
    } catch {
      // Ignore
    }

    // Verify permission first
    const hasPerm = await this.requestPermissions();
    if (!hasPerm) return;

    this.cleanupNativeListeners();
    this.transcript = '';
    this.interimTranscript = '';
    this.confidence = null;
    this.errorCode = null;
    this.errorMessage = null;
    this.status = 'LISTENING';
    this.emit();

    // Register event listeners
    try {
      if (typeof mod.addListener === 'function') {
        const resultSub = mod.addListener('result', (event: any) => {
          const results = event?.results ?? [];
          const firstResult = results[0];
          const best = firstResult?.transcript ?? '';
          const conf = typeof firstResult?.confidence === 'number' ? firstResult.confidence : null;
          this.confidence = conf;
          if (event?.isFinal) {
            this.transcript = best;
            this.interimTranscript = '';
          } else {
            this.interimTranscript = best;
          }
          this.emit();
        });

        const errorSub = mod.addListener('error', (event: any) => {
          this.status = 'ERROR';
          this.confidence = null;
          this.errorCode = 'RECOGNITION_ERROR';
          this.errorMessage = event?.message || 'Speech recognition encountered an error.';
          void this.resetAudioSessionToPlayback();
          this.cleanupNativeListeners();
          this.emit();
          if (this.stopPromiseResolve) {
            const cb = this.stopPromiseResolve;
            this.stopPromiseResolve = null;
            cb(this.transcript);
          }
        });

        const endSub = mod.addListener('end', () => {
          void this.resetAudioSessionToPlayback();
          if (this.status === 'LISTENING' || this.status === 'PROCESSING') {
            const pendingResolve = this.stopPromiseResolve;
            this.stopPromiseResolve = null;
            const finalText = (this.transcript || this.interimTranscript).trim();
            if (pendingResolve) {
              this.cleanupNativeListeners();
              pendingResolve(finalText);
              return;
            }
            this.status = 'IDLE';
            this.cleanupNativeListeners();
            this.emit();
          }
        });

        this.activeSubscriptions.push(resultSub, errorSub, endSub);
      }

      await mod.start({
        lang: options.lang || 'vi-VN',
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: options.requiresOnDevice ?? false,
      });
    } catch (error) {
      this.status = 'ERROR';
      this.errorCode = 'RECOGNITION_ERROR';
      this.errorMessage = error instanceof Error ? error.message : 'Failed to start speech recognition.';
      void this.resetAudioSessionToPlayback();
      this.cleanupNativeListeners();
      this.emit();
    }
  }

  async stopListening(): Promise<string> {
    if (this.status !== 'LISTENING') {
      return this.transcript;
    }

    this.status = 'PROCESSING';
    this.emit();

    const mod = getNativeSpeechModule();

    return new Promise<string>(resolve => {
      this.stopPromiseResolve = async (finalText: string) => {
        const text = (finalText || this.transcript || this.interimTranscript).trim();
        await this.resetAudioSessionToPlayback();
        this.status = 'IDLE';
        if (!text) {
          this.errorCode = 'NO_SPEECH_DETECTED';
          this.errorMessage = 'No speech detected. Tap the microphone and speak again.';
        }
        this.emit();
        resolve(text);
      };

      try {
        if (mod && typeof mod.stop === 'function') {
          mod.stop();
        }
      } catch {
        // Fallback resolution
      }

      // Safety timeout: resolve within 2.5s if native 'end' is delayed
      setTimeout(() => {
        if (this.stopPromiseResolve) {
          const fallbackText = (this.transcript || this.interimTranscript).trim();
          this.cleanupNativeListeners();
          const cb = this.stopPromiseResolve;
          this.stopPromiseResolve = null;
          void cb(fallbackText);
        }
      }, 2500);
    });
  }

  cancelListening() {
    const mod = getNativeSpeechModule();
    try {
      if (mod && typeof mod.abort === 'function') {
        mod.abort();
      }
    } catch {
      // Ignore abort error
    }
    void this.resetAudioSessionToPlayback();
    this.cleanupNativeListeners();
    this.status = 'IDLE';
    this.transcript = '';
    this.interimTranscript = '';
    this.confidence = null;
    this.errorCode = null;
    this.errorMessage = null;
    if (this.stopPromiseResolve) {
      this.stopPromiseResolve('');
      this.stopPromiseResolve = null;
    }
    this.emit();
  }

  private cleanupNativeListeners() {
    this.activeSubscriptions.forEach(sub => {
      try {
        sub?.remove?.();
      } catch {
        // Ignore removal error
      }
    });
    this.activeSubscriptions = [];
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
