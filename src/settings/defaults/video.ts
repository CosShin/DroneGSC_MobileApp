import { VideoSettings } from '../types/video';
import { WEBRTC_DEFAULTS } from '../../video/VideoConfig';

export const DEFAULT_VIDEO_CONFIG: VideoSettings = {
  ...WEBRTC_DEFAULTS,
  transport: 'WEBRTC',
  source: 'WebRTC',
  
  udpListenAddress: '0.0.0.0',
  udpPort: 5600,
  
  rtspUrl: 'rtsp://192.168.1.100:8554/main',
  rtspTransport: 'UDP',
  
  resolution: 'Auto',
  fps: 30,
  bitrate: 'Auto',
  
  lowLatencyMode: true,
  bufferSize: 'Low',
  
  recordingEnabled: false,
  autoRecord: false,
  recordWhenArmed: true,
  stopWhenDisarmed: true,
  format: 'MP4',
  maxStorageGb: 10,
  autoDelete: true,
};
