import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import { 
  ConnectionConfig, 
  WebSocketSettings,
  UdpSettings, 
  TcpSettings, 
  SerialSettings, 
  BluetoothSettings, 
  MockSettings, 
  ConnectionType, 
  VehicleType, 
  AutopilotType,
  NetworkProfileType,
  SavedConnectionProfile,
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
import { AiSettings } from '../../settings/types/ai';
import { DEFAULT_AI_CONFIG } from '../../settings/defaults/ai';

export interface SettingsState {
  showJoysticks: boolean;
  showTelemetry: boolean;
  mainViewMode: 'VIDEO' | 'MAP' | 'HUD';
  flightDisplayMode: 'HUD' | 'VIDEO';
  flightDisplayManual: boolean;
  connection: ConnectionConfig;
  connectionProfiles: SavedConnectionProfile[];
  mavlink: MavlinkSettings;
  piGateway: PiGatewaySettings;
  video: VideoSettings;
  camera: CameraSettings;
  telemetry: TelemetrySettings;
  joystick: JoystickSettings;
  ai: AiSettings;
  isAiAssistantOpen: boolean;
}

const initialState: SettingsState = {
  showJoysticks: true,
  showTelemetry: true,
  mainViewMode: 'HUD',
  flightDisplayMode: 'HUD',
  flightDisplayManual: false,
  connection: DEFAULT_CONNECTION_CONFIG,
  connectionProfiles: [],
  mavlink: DEFAULT_MAVLINK_CONFIG,
  piGateway: DEFAULT_PI_CONFIG,
  video: DEFAULT_VIDEO_CONFIG,
  camera: DEFAULT_CAMERA_CONFIG,
  telemetry: DEFAULT_TELEMETRY_CONFIG,
  joystick: DEFAULT_JOYSTICK_CONFIG,
  ai: DEFAULT_AI_CONFIG,
  isAiAssistantOpen: false,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    hydrateSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
      const incoming = action.payload;
      Object.assign(state, incoming);
      if (incoming.mainViewMode === 'HUD' || incoming.mainViewMode === 'VIDEO') {
        state.flightDisplayMode = incoming.flightDisplayMode ?? incoming.mainViewMode;
      }
      state.flightDisplayManual = incoming.flightDisplayManual ?? false;
      if (incoming.connection) state.connection = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...incoming.connection,
        udp: { ...DEFAULT_CONNECTION_CONFIG.udp, ...incoming.connection.udp },
        websocket: { ...DEFAULT_CONNECTION_CONFIG.websocket, ...incoming.connection.websocket },
        tcp: { ...DEFAULT_CONNECTION_CONFIG.tcp, ...incoming.connection.tcp },
        serial: { ...DEFAULT_CONNECTION_CONFIG.serial, ...incoming.connection.serial },
        bluetooth: { ...DEFAULT_CONNECTION_CONFIG.bluetooth, ...incoming.connection.bluetooth },
        mock: { ...DEFAULT_CONNECTION_CONFIG.mock, ...incoming.connection.mock },
      };
      // Migrate the former UDP "REMOTE" label to the explicit CLIENT mode.
      if ((state.connection.udp.mode as string) === 'REMOTE') state.connection.udp.mode = 'CLIENT';
      state.connectionProfiles = Array.isArray(incoming.connectionProfiles) ? incoming.connectionProfiles : [];
      if (incoming.video) state.video = { ...DEFAULT_VIDEO_CONFIG, ...incoming.video };
      if (incoming.mavlink) state.mavlink = { ...DEFAULT_MAVLINK_CONFIG, ...incoming.mavlink };
      if (incoming.ai) state.ai = { ...DEFAULT_AI_CONFIG, ...incoming.ai };
    },
    setShowJoysticks: (state, action: PayloadAction<boolean>) => {
      state.showJoysticks = action.payload;
    },
    toggleJoysticks: (state) => {
      state.showJoysticks = !state.showJoysticks;
    },
    toggleTelemetry: (state) => {
      state.showTelemetry = !state.showTelemetry;
    },
    setMainViewMode: (state, action: PayloadAction<'VIDEO' | 'MAP' | 'HUD'>) => {
      state.mainViewMode = action.payload;
      if (action.payload !== 'MAP') {
        state.flightDisplayMode = action.payload;
        state.flightDisplayManual = true;
      }
    },
    toggleMainViewMode: (state) => {
      state.mainViewMode = state.mainViewMode === 'MAP' ? state.flightDisplayMode : 'MAP';
    },
    setFlightDisplayMode: (state, action: PayloadAction<'HUD' | 'VIDEO'>) => {
      state.flightDisplayMode = action.payload;
      state.flightDisplayManual = true;
      if (state.mainViewMode !== 'MAP') state.mainViewMode = action.payload;
    },
    setAutomaticFlightDisplay: (state, action: PayloadAction<'HUD' | 'VIDEO'>) => {
      if (state.flightDisplayManual) return;
      state.flightDisplayMode = action.payload;
      if (state.mainViewMode !== 'MAP') state.mainViewMode = action.payload;
    },
    setPrimaryFlyView: (state, action: PayloadAction<'FLIGHT' | 'MAP'>) => {
      state.mainViewMode = action.payload === 'MAP' ? 'MAP' : state.flightDisplayMode;
    },
    updateConnectionConfig: (state, action: PayloadAction<Partial<ConnectionConfig>>) => {
      state.connection = { ...state.connection, ...action.payload };
    },
    setConnectionType: (state, action: PayloadAction<ConnectionType>) => {
      state.connection.type = action.payload;
    },
    setNetworkProfile: (state, action: PayloadAction<NetworkProfileType>) => {
      state.connection.networkProfile = action.payload;
    },
    upsertConnectionProfile: (state, action: PayloadAction<SavedConnectionProfile>) => {
      const index = state.connectionProfiles.findIndex(profile => profile.id === action.payload.id);
      if (index >= 0) state.connectionProfiles[index] = action.payload;
      else state.connectionProfiles.push(action.payload);
    },
    removeConnectionProfile: (state, action: PayloadAction<string>) => {
      state.connectionProfiles = state.connectionProfiles.filter(profile => profile.id !== action.payload);
    },
    loadConnectionProfile: (state, action: PayloadAction<string>) => {
      const profile = state.connectionProfiles.find(item => item.id === action.payload);
      if (profile) state.connection = profile.config;
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
    updateWebSocketSettings: (state, action: PayloadAction<Partial<WebSocketSettings>>) => {
      state.connection.websocket = { ...state.connection.websocket, ...action.payload };
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
    },
    updateAiSettings: (state, action: PayloadAction<Partial<AiSettings>>) => {
      state.ai = { ...state.ai, ...action.payload };
    },
    setAiAssistantOpen: (state, action: PayloadAction<boolean>) => {
      state.isAiAssistantOpen = action.payload;
    },
    toggleAiAssistant: (state) => {
      state.isAiAssistantOpen = !state.isAiAssistantOpen;
    },
  },
});

export const { 
  hydrateSettings,
  setShowJoysticks, 
  toggleJoysticks, 
  toggleTelemetry, 
  setMainViewMode, 
  toggleMainViewMode,
  setFlightDisplayMode,
  setAutomaticFlightDisplay,
  setPrimaryFlyView,
  updateConnectionConfig,
  setConnectionType,
  setNetworkProfile,
  upsertConnectionProfile,
  removeConnectionProfile,
  loadConnectionProfile,
  setVehicleType,
  setAutopilotType,
  updateUdpSettings,
  updateWebSocketSettings,
  updateTcpSettings,
  updateSerialSettings,
  updateBluetoothSettings,
  updateMockSettings,
  updateMavlinkSettings,
  updatePiGatewaySettings,
  updateVideoSettings,
  updateCameraSettings,
  updateTelemetrySettings,
  updateJoystickSettings,
  updateAiSettings,
  setAiAssistantOpen,
  toggleAiAssistant,
} = settingsSlice.actions;

export const selectShowJoysticks = (state: RootState) => state.settings.showJoysticks;
export const selectShowTelemetry = (state: RootState) => state.settings.showTelemetry;
export const selectMainViewMode = (state: RootState) => state.settings.mainViewMode;
export const selectPrimaryFlyView = (state: RootState) => state.settings.mainViewMode === 'MAP' ? 'MAP' : 'FLIGHT';
export const selectFlightDisplayMode = (state: RootState) => state.settings.flightDisplayMode;
export const selectFlightDisplayManual = (state: RootState) => state.settings.flightDisplayManual;
export const selectConnectionConfig = (state: RootState) => state.settings.connection;
export const selectConnectionProfiles = (state: RootState) => state.settings.connectionProfiles;
export const selectMavlinkSettings = (state: RootState) => state.settings.mavlink;
export const selectPiGatewaySettings = (state: RootState) => state.settings.piGateway;
export const selectVideoSettings = (state: RootState) => state.settings.video;
export const selectCameraSettings = (state: RootState) => state.settings.camera;
export const selectTelemetrySettings = (state: RootState) => state.settings.telemetry;
export const selectJoystickSettings = (state: RootState) => state.settings.joystick;
export const selectAiSettings = (state: RootState) => state.settings.ai;
export const selectIsAiAssistantOpen = (state: RootState) => !!state.settings.isAiAssistantOpen;

export default settingsSlice.reducer;
