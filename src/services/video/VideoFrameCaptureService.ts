export interface CapturedFrame {
  base64: string; // JPEG/PNG base64 without data URI prefix
  width: number;
  height: number;
  timestamp: number;
  source: 'WEBRTC_PLAYER' | 'TEST_SNAPSHOT';
  isLive: boolean;
}

export class VideoFrameCaptureService {
  private lastCapturedFrame: CapturedFrame | null = null;
  private frameProvider: (() => Promise<CapturedFrame | null>) | null = null;

  /**
   * Registers a frame provider from the active WebRtcVideoPlayer
   */
  registerFrameProvider(provider: (() => Promise<CapturedFrame | null>) | null) {
    this.frameProvider = provider;
  }

  /**
   * Captures strictly ONE single frame on-demand from the active video player.
   * Never continuously streams video to AI.
   * Returns null if camera is offline or player is unmounted.
   */
  async captureCurrentFrame(): Promise<CapturedFrame | null> {
    if (this.frameProvider) {
      try {
        const frame = await this.frameProvider();
        if (frame && frame.base64) {
          this.lastCapturedFrame = frame;
          return frame;
        }
      } catch (e) {
        console.warn('[FRAME-CAPTURE] Failed to capture from registered provider', e);
      }
    }

    return null;
  }

  getLastFrame(): CapturedFrame | null {
    return this.lastCapturedFrame;
  }
}

export const videoFrameCaptureService = new VideoFrameCaptureService();
