export type CameraType = 'MAVLink Camera' | 'Pi Camera API' | 'USB Webcam' | 'None';
export type CameraVideoMode = '1080p30' | '1080p60' | '4K30' | '720p60';
export type CameraPhotoMode = 'Single' | 'Time-lapse' | 'Burst';
export type CameraExposureMode = 'Auto' | 'Manual' | 'Shutter Priority' | 'Aperture Priority';
export type CameraIso = 'Auto' | '100' | '200' | '400' | '800' | '1600' | '3200';

export interface CameraSettings {
  cameraType: CameraType;
  cameraName: string;
  
  // Modes
  videoMode: CameraVideoMode;
  photoMode: CameraPhotoMode;
  
  // Optical
  zoomLevel: number;
  focusMode: 'Auto' | 'Manual' | 'Continuous';
  
  // Exposure
  exposureMode: CameraExposureMode;
  iso: CameraIso;
  shutterSpeed: string; // e.g., "1/500", "Auto"
}
