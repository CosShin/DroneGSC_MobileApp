import type { FlightMode } from '../../../types/command';

export type AiIntentType =
  // Flight commands (safety critical)
  | 'ARM'
  | 'DISARM'
  | 'TAKEOFF'
  | 'LAND'
  | 'RTL'
  | 'SET_MODE'
  | 'SET_HOME'
  | 'GOTO'
  // Mission lifecycle
  | 'CREATE_MISSION'
  | 'UPLOAD_MISSION'
  | 'START_MISSION'
  | 'PAUSE_MISSION'
  | 'RESUME_MISSION'
  // Diagnostics & advisory
  | 'PREFLIGHT_CHECK'
  | 'VEHICLE_STATUS'
  | 'MAVLINK_CHECK'
  | 'MISSION_REVIEW'
  // Vision analysis
  | 'DESCRIBE_VIDEO'
  | 'ANALYZE_LANDING_AREA'
  // Fallback
  | 'UNKNOWN';

export type AiActionLifecycle =
  | 'PROPOSED'
  | 'WAITING_CONFIRMATION'
  | 'VALIDATING'
  | 'SENDING'
  | 'WAITING_ACK'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export interface TakeoffParams {
  altitudeMeters: number;
}

export interface SetModeParams {
  mode: FlightMode;
}

export interface SetHomeParams {
  useCurrent: boolean;
  latitude?: number;
  longitude?: number;
  altitude?: number;
}

export interface GotoParams {
  latitude: number;
  longitude: number;
  altitudeMeters: number;
}

export interface MissionWaypointProposal {
  latitude: number;
  longitude: number;
  altitudeMeters: number;
  speedMetersPerSecond?: number;
  delaySeconds?: number;
}

export interface MissionProposalParams {
  takeoffAltitudeMeters: number;
  speedMetersPerSecond?: number;
  waypoints: MissionWaypointProposal[];
  endAction?: 'RTL' | 'LAND' | 'HOLD';
}

export type AiIntentParameters =
  | { type: 'ARM' }
  | { type: 'DISARM' }
  | { type: 'TAKEOFF'; altitudeMeters: number }
  | { type: 'LAND' }
  | { type: 'RTL' }
  | { type: 'SET_MODE'; mode: FlightMode }
  | { type: 'SET_HOME'; useCurrent: boolean; latitude?: number; longitude?: number; altitude?: number }
  | { type: 'GOTO'; latitude: number; longitude: number; altitudeMeters: number }
  | { type: 'CREATE_MISSION'; proposal: MissionProposalParams }
  | { type: 'UPLOAD_MISSION' }
  | { type: 'START_MISSION' }
  | { type: 'PAUSE_MISSION' }
  | { type: 'RESUME_MISSION' }
  | { type: 'PREFLIGHT_CHECK' }
  | { type: 'VEHICLE_STATUS' }
  | { type: 'MAVLINK_CHECK' }
  | { type: 'MISSION_REVIEW' }
  | { type: 'DESCRIBE_VIDEO'; prompt?: string }
  | { type: 'ANALYZE_LANDING_AREA' }
  | { type: 'UNKNOWN'; rawText?: string };

export interface AiActionProposal {
  id: string;
  intent: AiIntentParameters;
  requiresConfirmation: boolean;
  requiresHoldConfirmation?: boolean; // For ARM, DISARM, TAKEOFF, START_MISSION
  title: string;
  description: string;
  reason?: string;
  state: AiActionLifecycle;
  proposedAt: number;
  vehicleSessionId?: string | null;
  error?: string | null;
  ackResult?: number | null;
}

export interface AiStructuredResponse {
  message: string;
  proposal?: AiActionProposal | null;
  requiresConfirmation: boolean;
}
