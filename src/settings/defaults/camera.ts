import { CameraSettings } from '../types/camera';

export const DEFAULT_CAMERA_CONFIG: CameraSettings = {
  cameraType: 'MAVLink Camera',
  cameraName: 'Anitech Gimbal Cam',
  
  videoMode: '1080p60',
  photoMode: 'Single',
  
  zoomLevel: 1.0,
  focusMode: 'Continuous',
  
  exposureMode: 'Auto',
  iso: 'Auto',
  shutterSpeed: 'Auto',
};
