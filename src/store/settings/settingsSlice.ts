import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import { 
  ConnectionConfig, 
  UdpSettings, 
  TcpSettings, 
  SerialSettings, 
  BluetoothSettings, 
  MockSettings, 
  ConnectionType, 
  VehicleType, 
  AutopilotType 
} from '../../settings/types/connection';
import { DEFAULT_CONNECTION_CONFIG } from '../../settings/defaults/connection';
import { MavlinkSettings } from '../../settings/types/mavlink';
import { DEFAULT_MAVLINK_CONFIG } from '../../settings/defaults/mavlink';
import { PiGatewaySettings } from '../../settings/types/pi';
import { DEFAULT_PI_CONFIG } from '../../settings/defaults/pi';
import { VideoSettings } from '../../settings/types/video';
import { DEFAULT_VIDEO_CONFIG } from '../../settings/defaults/video';
import { CameraSettings } from '../../settings/types/camera';
import { DEFAULT_CAMERA_CONFIG } from '../../settings/defaults/camera';
import { TelemetrySettings } from '../../settings/types/telemetry';
import { DEFAULT_TELEMETRY_CONFIG } from '../../settings/defaults/telemetry';
import { JoystickSettings } from '../../settings/types/joystick';
import { DEFAULT_JOYSTICK_CONFIG } from '../../settings/defaults/joystick';

export interface SettingsState {
  showJoysticks: boolean;
  showTelemetry: boolean;
  mainViewMode: 'MAP' | 'HUD';
  connection: ConnectionConfig;
  mavlink: MavlinkSettings;
  piGateway: PiGatewaySettings;
  video: VideoSettings;
  camera: CameraSettings;
  telemetry: TelemetrySettings;
  joystick: JoystickSettings;
}

const initialState: SettingsState = {
  showJoysticks: true,
  showTelemetry: true,
  mainViewMode: 'HUD',
  connection: DEFAULT_CONNECTION_CONFIG,
  mavlink: DEFAULT_MAVLINK_CONFIG,
  piGateway: DEFAULT_PI_CONFIG,
  video: DEFAULT_VIDEO_CONFIG,
  camera: DEFAULT_CAMERA_CONFIG,
  telemetry: DEFAULT_TELEMETRY_CONFIG,
  joystick: DEFAULT_JOYSTICK_CONFIG,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setShowJoysticks: (state, action: PayloadAction<boolean>) => {
      state.showJoysticks = action.payload;
    },
    toggleJoysticks: (state) => {
      state.showJoysticks = !state.showJoysticks;
    },
    toggleTelemetry: (state) => {
      state.showTelemetry = !state.showTelemetry;
    },
    setMainViewMode: (state, action: PayloadAction<'MAP' | 'HUD'>) => {
      state.mainViewMode = action.payload;
    },
    toggleMainViewMode: (state) => {
      state.mainViewMode = state.mainViewMode === 'MAP' ? 'HUD' : 'MAP';
    },
    updateConnectionConfig: (state, action: PayloadAction<Partial<ConnectionConfig>>) => {
      state.connection = { ...state.connection, ...action.payload };
    },
    setConnectionType: (state, action: PayloadAction<ConnectionType>) => {
      state.connection.type = action.payload;
    },
    setVehicleType: (state, action: PayloadAction<VehicleType>) => {
      state.connection.vehicleType = action.payload;
    },
    setAutopilotType: (state, action: PayloadAction<AutopilotType>) => {
      state.connection.autopilot = action.payload;
    },
    updateUdpSettings: (state, action: PayloadAction<Partial<UdpSettings>>) => {
      state.connection.udp = { ...state.connection.udp, ...action.payload };
    },
    updateTcpSettings: (state, action: PayloadAction<Partial<TcpSettings>>) => {
      state.connection.tcp = { ...state.connection.tcp, ...action.payload };
    },
    updateSerialSettings: (state, action: PayloadAction<Partial<SerialSettings>>) => {
      state.connection.serial = { ...state.connection.serial, ...action.payload };
    },
    updateBluetoothSettings: (state, action: PayloadAction<Partial<BluetoothSettings>>) => {
      state.connection.bluetooth = { ...state.connection.bluetooth, ...action.payload };
    },
    updateMockSettings: (state, action: PayloadAction<Partial<MockSettings>>) => {
      state.connection.mock = { ...state.connection.mock, ...action.payload };
    },
    updateMavlinkSettings: (state, action: PayloadAction<Partial<MavlinkSettings>>) => {
      state.mavlink = { ...state.mavlink, ...action.payload };
    },
    updatePiGatewaySettings: (state, action: PayloadAction<Partial<PiGatewaySettings>>) => {
      state.piGateway = { ...state.piGateway, ...action.payload };
    },
    updateVideoSettings: (state, action: PayloadAction<Partial<VideoSettings>>) => {
      state.video = { ...state.video, ...action.payload };
    },
    updateCameraSettings: (state, action: PayloadAction<Partial<CameraSettings>>) => {
      state.camera = { ...state.camera, ...action.payload };
    },
    updateTelemetrySettings: (state, action: PayloadAction<Partial<TelemetrySettings>>) => {
      state.telemetry = { ...state.telemetry, ...action.payload };
    },
    updateJoystickSettings: (state, action: PayloadAction<Partial<JoystickSettings>>) => {
      state.joystick = { ...state.joystick, ...action.payload };
    }
  },
});

export const { 
  setShowJoysticks, 
  toggleJoysticks, 
  toggleTelemetry, 
  setMainViewMode, 
  toggleMainViewMode,
  updateConnectionConfig,
  setConnectionType,
  setVehicleType,
  setAutopilotType,
  updateUdpSettings,
  updateTcpSettings,
  updateSerialSettings,
  updateBluetoothSettings,
  updateMockSettings,
  updateMavlinkSettings,
  updatePiGatewaySettings,
  updateVideoSettings,
  updateCameraSettings,
  updateTelemetrySettings,
  updateJoystickSettings
} = settingsSlice.actions;

export const selectShowJoysticks = (state: RootState) => state.settings.showJoysticks;
export const selectShowTelemetry = (state: RootState) => state.settings.showTelemetry;
export const selectMainViewMode = (state: RootState) => state.settings.mainViewMode;
export const selectConnectionConfig = (state: RootState) => state.settings.connection;
export const selectMavlinkSettings = (state: RootState) => state.settings.mavlink;
export const selectPiGatewaySettings = (state: RootState) => state.settings.piGateway;
export const selectVideoSettings = (state: RootState) => state.settings.video;
export const selectCameraSettings = (state: RootState) => state.settings.camera;
export const selectTelemetrySettings = (state: RootState) => state.settings.telemetry;
export const selectJoystickSettings = (state: RootState) => state.settings.joystick;

export default settingsSlice.reducer;
