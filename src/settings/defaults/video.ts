import { VideoSettings } from '../types/video';

export const DEFAULT_VIDEO_CONFIG: VideoSettings = {
  source: 'Disabled',
  
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
