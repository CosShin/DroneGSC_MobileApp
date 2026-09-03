import { VehicleType, AutopilotType, ConnectionType } from '../../settings/types/connection';
import { SensorHealth } from '../../store/telemetry/telemetrySlice';

export type AiMessageRole = 'system' | 'user' | 'assistant';

export type AiMessageStatus = 'sending' | 'streaming' | 'success' | 'error';

export type SpeechTone = 'NORMAL' | 'INFORMATIVE' | 'POSITIVE' | 'CAUTION' | 'URGENT';

export type SemanticCardType =
  | 'FLIGHT_STATUS'
  | 'PREFLIGHT_CHECK'
  | 'MAVLINK_DIAG'
  | 'CAMERA_ANALYSIS'
  | 'WARNING'
  | 'RECOMMENDATION'
  | 'MISSION_REVIEW';

export interface SemanticMetricItem {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
}

export interface SemanticStructuredCard {
  type: SemanticCardType;
  title: string;
  tone?: SpeechTone;
  metrics?: SemanticMetricItem[];
  summary?: string;
  findings?: string[];
  recommendations?: string[];
  warnings?: string[];
}

export interface AiChatMessage {
  id: string;
  role: AiMessageRole;
  content: string;
  timestamp: number;
  status: AiMessageStatus;
  errorMessage?: string;
  proposal?: import('./intents/AiIntentTypes').AiActionProposal | null;
  image?: string | null;
  spokenText?: string;
  tone?: SpeechTone;
  structuredCard?: SemanticStructuredCard | null;
}

export interface NormalizedVehicleState {
  connected: boolean;
  name: string;
  vehicleType: VehicleType | string;
  autopilot: AutopilotType | string;
  armed: boolean;
  mode: string;
  systemStatus: string;
  stale: boolean;
}

export interface NormalizedConnectionState {
  transport: ConnectionType | string;
  portInfo: string;
  networkState: string;
  mavlinkState: string;
  vehicleState: string;
  heartbeatAgeMs: number | null;
  latencyMs: number | null;
  rxPps: number;
  txPps: number;
  bytesReceived: number;
  bytesSent: number;
  packetsLost: number;
  mavlinkVersion: number | null;
}

export interface NormalizedBatteryState {
  voltage: number | null;
  current: number | null;
  percentage: number | null;
}

export interface NormalizedGpsState {
  fixType: number | null;
  satellites: number | null;
  hdop: number | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
}

export interface NormalizedFlightState {
  altitude: number | null;
  groundSpeed: number | null;
  verticalSpeed: number | null;
  heading: number | null;
  roll: number | null;
  pitch: number | null;
  yaw: number | null;
}

export interface NormalizedHomeState {
  isSet: boolean;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  distanceMeters: number | null;
  bearingDegrees: number | null;
}

export interface NormalizedMavlinkDiagnostics {
  rxPps: number;
  txPps: number;
  crcErrors: number;
  dropped: number;
  reconnectCount: number;
  topRates: Array<{
    name: string;
    rateHz: number;
    rxCount: number;
    txCount: number;
  }>;
}

export interface NormalizedSensorItem {
  name: string;
  health: SensorHealth | string;
  value?: string;
  message?: string;
}

export interface NormalizedMissionSummary {
  count: number;
  totalDistanceMeters: number;
  maxAltitudeMeters: number;
  commands: string[];
  hasRtl: boolean;
  hasLand: boolean;
  hasTakeoff: boolean;
  speedChanges: Array<{ index: number; speedMps: number }>;
}

export interface NormalizedPrecisionLandingState {
  targetFound: boolean;
  tagId?: number | null;
  offsetXCentimeters?: number | null;
  offsetYCentimeters?: number | null;
  altitudeMeters?: number | null;
  confidence?: number | null;
}

export interface FlightContextSnapshot {
  timestamp: number;
  vehicle: NormalizedVehicleState;
  connection: NormalizedConnectionState;
  battery: NormalizedBatteryState | null;
  gps: NormalizedGpsState | null;
  flight: NormalizedFlightState;
  home: NormalizedHomeState;
  mavlink: NormalizedMavlinkDiagnostics;
  sensors: NormalizedSensorItem[];
  warnings: string[];
  mission: NormalizedMissionSummary | null;
  precisionLanding?: NormalizedPrecisionLandingState | null;
}

export type AiQuickActionType = 
  | 'PREFLIGHT' 
  | 'WHY_CANT_ARM' 
  | 'MAVLINK_CHECK' 
  | 'MISSION_REVIEW'
  | 'ANALYZE_CAMERA'
  | 'CHECK_LANDING_MARKER';

export type { AiExecutionType, AiModelMetadata } from '../../settings/types/ai';

export interface AiTestResult {
  success: boolean;
  latencyMs: number;
  model: string;
  provider: string;
  execution?: import('../../settings/types/ai').AiExecutionType;
  serverVersion?: string;
  errorMessage?: string;
}

export interface AiSuggestedAction {
  type: string;
  payload?: Record<string, unknown>;
  description: string;
  safetyLevel: 'ADVISORY' | 'CRITICAL';
}
