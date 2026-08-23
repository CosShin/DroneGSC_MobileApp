export type VideoSource = 'Disabled' | 'RTSP' | 'UDP H.264' | 'UDP H.265' | 'MPEG-TS' | 'Integrated Camera';
export type VideoResolution = 'Auto' | '720p' | '1080p';
export type VideoFps = 15 | 24 | 30 | 60;
export type VideoBitrate = 'Auto' | 'Low' | 'Medium' | 'High' | 'Custom';
export type VideoBuffer = 'Low' | 'Medium' | 'High';
export type VideoFormat = 'MP4' | 'MKV';
export type RtspTransport = 'UDP' | 'TCP';

export interface VideoSettings {
  source: VideoSource;
  
  // UDP config
  udpListenAddress: string;
  udpPort: number;
  
  // RTSP config
  rtspUrl: string;
  rtspUsername?: string;
  rtspPassword?: string;
  rtspTransport: RtspTransport;
  
  // Quality
  resolution: VideoResolution;
  fps: VideoFps;
  bitrate: VideoBitrate;
  customBitrateKbps?: number;
  
  // Latency
  lowLatencyMode: boolean;
  bufferSize: VideoBuffer;
  
  // Recording
  recordingEnabled: boolean;
  autoRecord: boolean;
  recordWhenArmed: boolean;
  stopWhenDisarmed: boolean;
  format: VideoFormat;
  maxStorageGb: number;
  autoDelete: boolean;
}
