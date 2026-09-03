import { MAV_CMD, MAV_FRAME } from './MissionCommandRegistry';

/**
 * 1. MAVLink Wire Protocol Model
 * Corresponds exactly to MAVLink MISSION_ITEM_INT (Message ID #73)
 */
export interface MissionItemInt {
  seq: number;
  frame: number; // MAV_FRAME
  command: number; // MAV_CMD
  current: number; // 0 or 1
  autocontinue: number; // 0 or 1
  param1: number;
  param2: number;
  param3: number;
  param4: number;
  x: number; // Latitude in deg * 1e7 (or local x / int32 param)
  y: number; // Longitude in deg * 1e7 (or local y / int32 param)
  z: number; // Altitude in float (meters)
  missionType: number; // 0 = MAV_MISSION_TYPE_MISSION
}

/**
 * 2. Mission Editor Model
 * High-level, user-friendly representation used across UI, Redux, and Editor
 */
export interface MissionEditorItem {
  id: string;
  command: number; // MAV_CMD
  frame: number; // MAV_FRAME (default: 3 = GLOBAL_RELATIVE_ALT)
  lat?: number;
  lng?: number;
  alt?: number;
  
  // High-level speed attribute for the leg starting at this waypoint
  // When defined, compiler emits a DO_CHANGE_SPEED command to enforce actual ArduPilot flight speed
  speed?: number; 
  
  // High-level delay / hold time in seconds
  delay?: number;

  // Command-specific parameters (Param 1 to Param 4)
  param1?: number;
  param2?: number;
  param3?: number;
  param4?: number;

  autocontinue: boolean;
  
  // Custom label/name override (e.g. for custom or raw commands)
  customLabel?: string;

  // Set to true if item was de-compiled from an explicit standalone DO_CHANGE_SPEED command
  isSpeedCommand?: boolean;
}

/**
 * Result of mission validation
 */
export interface MissionValidationResult {
  valid: boolean;
  errors: Array<{
    itemIndex: number;
    itemId: string;
    field: string;
    message: string;
  }>;
}

/**
 * Result of round-trip verification
 */
export interface MissionVerificationResult {
  match: boolean;
  uploadedCount: number;
  downloadedCount: number;
  diffs: Array<{
    seq: number;
    field: string;
    uploadedValue: string | number;
    downloadedValue: string | number;
  }>;
}
