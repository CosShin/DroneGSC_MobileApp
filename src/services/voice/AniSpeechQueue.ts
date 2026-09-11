import type { SpeechSegment } from './MixedLanguageTts';

export interface QueueSegmentItem extends SpeechSegment {
  voice?: string | null;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export type NativeSpeakFunction = (
  text: string,
  options: {
    language: string;
    voice?: string | null;
    rate?: number;
    pitch?: number;
    volume?: number;
    useApplicationAudioSession?: boolean;
    onStart?: () => void;
    onDone?: () => void;
    onStopped?: () => void;
    onError?: (error?: any) => void;
  }
) => void;

export type NativeStopFunction = () => Promise<void> | void;

/**
 * AniSpeechQueue
 * Ensures strictly sequential playback of mixed-language segments with
 * zero overlap between voices, immediate interruption support, and
 * reactive state notification for Mascot/ANI animations.
 */
export class AniSpeechQueue {
  private queue: QueueSegmentItem[] = [];
  private activeItem: QueueSegmentItem | null = null;
  private _isSpeaking = false;
  private currentGeneration = 0;
  private safetyTimeout: any = null;
  private listeners = new Set<(speaking: boolean) => void>();

  constructor(
    private readonly nativeSpeak: NativeSpeakFunction,
    private readonly nativeStop: NativeStopFunction,
  ) {}

  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  subscribe(listener: (speaking: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this._isSpeaking);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setSpeaking(speaking: boolean) {
    if (this._isSpeaking === speaking) return;
    this._isSpeaking = speaking;
    this.listeners.forEach(listener => listener(speaking));
  }

  /**
   * Immediately interrupts ongoing speech, clears all remaining segments,
   * and resets state to IDLE.
   */
  async stop(): Promise<void> {
    this.currentGeneration++;
    this.clearSafetyTimeout();
    this.queue = [];
    this.activeItem = null;
    try {
      await Promise.resolve(this.nativeStop());
    } catch {
      // Ignore native stop errors
    }
    this.setSpeaking(false);
  }

  /**
   * Clears any queued items without stopping the current speaking item.
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Plays a sequence of segments. If speech is already ongoing,
   * it interrupts the existing speech and starts the new sequence.
   */
  async play(segments: QueueSegmentItem[]): Promise<void> {
    // Interruption: stop current speech immediately
    await this.stop();

    if (!segments || segments.length === 0) {
      return;
    }

    this.queue = [...segments];
    this.setSpeaking(true);
    this.playNext(this.currentGeneration);
  }

  private playNext(generation: number): void {
    if (this.currentGeneration !== generation) return;

    this.clearSafetyTimeout();

    if (this.queue.length === 0) {
      this.activeItem = null;
      this.setSpeaking(false);
      return;
    }

    const item = this.queue.shift()!;
    this.activeItem = item;

    // Safety timeout: calculate expected duration (roughly 8 chars per second at rate 1.0)
    // plus a generous 4-second buffer to ensure the queue never gets stuck permanently
    const estimatedSec = Math.max(3, (item.text.length / 8) / (item.rate ?? 1.0) + 4);
    this.safetyTimeout = setTimeout(() => {
      if (this.currentGeneration === generation && this.activeItem === item) {
        console.warn(`[ANI:TTS] Segment timed out, advancing queue: "${item.text.slice(0, 25)}..."`);
        this.playNext(generation);
      }
    }, estimatedSec * 1000);

    const onComplete = () => {
      if (this.currentGeneration !== generation) return;
      this.playNext(generation);
    };

    try {
      this.nativeSpeak(item.text, {
        language: item.lang,
        voice: item.voice || undefined,
        rate: item.rate ?? 0.95,
        pitch: item.pitch ?? 1.0,
        volume: item.volume ?? 1.0,
        onStart: () => {
          if (this.currentGeneration !== generation) return;
          this.setSpeaking(true);
          console.log('[ANI:TTS] started', {
            textLength: item.text.length,
            lang: item.lang,
            voice: item.voice || 'SYSTEM_DEFAULT',
            rate: item.rate ?? 0.95,
          });
        },
        onDone: () => {
          console.log('[ANI:TTS] done', { text: item.text.slice(0, 30) });
          onComplete();
        },
        onStopped: () => {
          console.log('[ANI:TTS] stopped');
          onComplete();
        },
        onError: (err?: any) => {
          console.error('[ANI:TTS] error', err);
          onComplete();
        },
      });
    } catch (err) {
      console.warn('[AniSpeechQueue] Native speak threw synchronously:', err);
      onComplete();
    }
  }

  private clearSafetyTimeout(): void {
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
      this.safetyTimeout = null;
    }
  }
}
