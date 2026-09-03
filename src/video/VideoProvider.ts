import type React from 'react';
import type { VideoSettings } from '../settings/types/video';
import { platformCapabilities, type PlatformCapability } from '../platform/PlatformCapabilities';
import { validateRtspUrl, validateWebRtcConfig } from './VideoSourceResolver';
import type { VideoTransport } from './VideoTypes';

export interface VideoPlayerProps {
  enabled?: boolean;
  publishGlobalRuntime?: boolean;
  onOpenFullscreen?: () => void;
}

export interface VideoProvider {
  readonly type: Extract<VideoTransport, 'WEBRTC' | 'RTSP'>;
  getCapability(): PlatformCapability;
  validate(settings: VideoSettings): string | null;
  loadPlayer(): React.ComponentType<VideoPlayerProps>;
}

class WebRtcVideoProvider implements VideoProvider {
  readonly type = 'WEBRTC' as const;
  getCapability() { return platformCapabilities.webRtc; }
  validate(settings: VideoSettings) {
    try {
      validateWebRtcConfig(settings);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Invalid WebRTC configuration.';
    }
  }
  loadPlayer() {
    return require('../components/video/WebRtcVideoPlayer').WebRtcVideoPlayer as React.ComponentType<VideoPlayerProps>;
  }
}

class RtspVideoProvider implements VideoProvider {
  readonly type = 'RTSP' as const;
  getCapability() { return platformCapabilities.rtsp; }
  validate(settings: VideoSettings) {
    try {
      validateRtspUrl(settings.rtspUrl);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Invalid RTSP configuration.';
    }
  }
  loadPlayer() {
    return require('../components/video/RtspVideoPlayer').RtspVideoPlayer as React.ComponentType<VideoPlayerProps>;
  }
}

const providers: Readonly<Record<'WEBRTC' | 'RTSP', VideoProvider>> = Object.freeze({
  WEBRTC: new WebRtcVideoProvider(),
  RTSP: new RtspVideoProvider(),
});

export function getVideoProvider(type: VideoTransport): VideoProvider | null {
  return type === 'WEBRTC' || type === 'RTSP' ? providers[type] : null;
}
