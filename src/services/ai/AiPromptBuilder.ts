import type { AiChatMessage, FlightContextSnapshot, AiQuickActionType } from './AiTypes';

export const SYSTEM_PROMPT = `You are ANITECH Flight Assistant, an expert AI copilot for ANITECH Ground Control Station operating ArduPilot/Pixhawk UAV aircraft.

CORE RULES:
1. TRUTHFUL TELEMETRY: Use ONLY the provided FlightContext JSON data.
   - 'null', 'UNKNOWN', or '--' strictly means data is NOT available from the vehicle.
   - NEVER invent or assume missing telemetry (battery, GPS coordinates, satellites, mode, heading, etc.).
2. FLIGHT SAFETY & ROLES:
   - You are an advisory AI Copilot. You CANNOT directly arm, disarm, takeoff, land, switch modes, or upload missions.
   - When the pilot asks you to execute a flight command or create a mission, you MUST propose it as a structured JSON block so the GCS can deterministically validate and present a confirmation card to the pilot.
   - Example structured JSON output:
     \`\`\`json
     {
       "message": "Tôi đã tạo yêu cầu cất cánh lên 20 mét. Hãy xác nhận trên màn hình.",
       "intent": {
         "type": "TAKEOFF",
         "parameters": { "altitudeMeters": 20 }
       }
     }
     \`\`\`
    - Supported intent types: ARM, DISARM, TAKEOFF, LAND, RTL, SET_MODE, SET_HOME, CREATE_MISSION.
    - For TAKEOFF: include "altitudeMeters": <number between 1 and 120>.
    - For SET_MODE: include "mode": "STABILIZE" | "ALT_HOLD" | "LOITER" | "POSHOLD" | "GUIDED" | "AUTO" | "RTL" | "LAND".
    - For CREATE_MISSION: When the pilot requests a flight plan, waypoint mission, or survey route:
      - Always structure as "CREATE_MISSION".
      - "proposal": {
          "takeoffAltitudeMeters": <number between 5 and 60, default 15>,
          "speedMetersPerSecond": <number between 2 and 15, default 5>,
          "waypoints": [
            { "latitude": <number>, "longitude": <number>, "altitudeMeters": <number>, "holdSeconds": <optional number> }
          ],
          "endAction": "RTL" | "LAND" | "LOITER"
        }
      - If relative coordinates are requested (e.g. "bay về phía bắc 50m"), use current vehicle or home latitude/longitude from FlightContext as the reference base.
      - Remind the pilot that the mission will be compiled into safe MAVLink items and requires separate verification on the map before uploading.
    - For questions, preflight check, diagnostics, or explanations: reply with natural text.
3. CLEAR EXPLANATIONS:
   - Distinguish Transport status (e.g. Wi-Fi / Tailscale / WebSocket) from Vehicle MAVLink Heartbeat.
   - Prioritize actual ArduPilot PreArm warning messages when troubleshooting arming or errors.
4. STYLE & LANGUAGE:
   - Keep responses concise, well-structured, and practical for pilots in the field.
   - Use checklist bullet points (e.g. '✓', '✕', '⚠') where helpful.
   - Always reply naturally in the language used by the user (Vietnamese or English).`;

export function formatFlightContextForPrompt(context: FlightContextSnapshot): string {
  return `### CURRENT FLIGHT CONTEXT SNAPSHOT (TRUTHFUL DATA):
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\``;
}

export function buildUserMessageWithContext(userPrompt: string, context: FlightContextSnapshot): string {
  return `${formatFlightContextForPrompt(context)}

### USER QUERY:
${userPrompt}`;
}

export function buildQuickActionPrompt(actionType: AiQuickActionType, context: FlightContextSnapshot): string {
  switch (actionType) {
    case 'PREFLIGHT':
      return `${formatFlightContextForPrompt(context)}

### PILOT REQUEST: PREFLIGHT CHECK
Perform a thorough preflight readiness evaluation of the aircraft based on the current FlightContext snapshot:
1. Transport & MAVLink Heartbeat status
2. Arming status & Flight Mode
3. Battery voltage and percentage
4. GPS fix type, satellite count, HDOP
5. Home position status
6. Sensor health & EKF status
7. PreArm warnings & active system alerts
Output a clean Preflight Checklist with status indicators (✓ PASS, ✕ FAIL, ⚠ WARN, -- NO DATA) and an overall GO / NO-GO assessment.`;

    case 'WHY_CANT_ARM':
      return `${formatFlightContextForPrompt(context)}

### PILOT REQUEST: WHY CAN'T I ARM?
Analyze why the aircraft cannot be armed based on the current FlightContext snapshot:
1. Review all active PreArm warnings and STATUSTEXT messages first.
2. Check GPS fix (need 3D fix for GPS modes), Battery thresholds, and Sensor health.
3. Check Heartbeat and connection staleness.
Explain the root cause clearly and provide actionable, step-by-step resolution steps for the pilot.`;

    case 'MAVLINK_CHECK':
      return `${formatFlightContextForPrompt(context)}

### PILOT REQUEST: MAVLINK & TRAFFIC DIAGNOSTICS
Analyze the MAVLink telemetry stream diagnostics from the current FlightContext snapshot:
1. Packet rate health (RX pps, TX pps)
2. CRC error count and dropped packets / packet loss
3. Heartbeat age and link latency
4. Message rate breakdown (top streaming messages)
Evaluate if traffic rates look normal, diagnose potential link bottleneck or duplicates, and give a link health rating.`;

    case 'MISSION_REVIEW':
      return `${formatFlightContextForPrompt(context)}

### PILOT REQUEST: MISSION PLAN REVIEW
Review the planned autonomous mission from the current FlightContext snapshot:
1. Number of items and total estimated distance
2. Max altitude and terrain safety considerations
3. Takeoff and Landing / RTL safety checks
4. Speed changes and waypoint transition safety
Highlight any missing failsafe items or suspicious altitudes. Remind the pilot that you cannot upload or start missions directly.`;

    case 'ANALYZE_CAMERA':
      return `${formatFlightContextForPrompt(context)}

### PILOT REQUEST: CAMERA SCENE ANALYSIS
Analyze the current camera view and evaluate visual flight conditions:
1. Identify any visible obstacles, structures, powerlines, trees, or terrain features.
2. Assess the landing zone directly underneath or ahead (flatness, clear area, ground texture).
3. Report lighting, visibility, or lens distortion/occlusion.
Provide an objective visual summary with an explicit reminder that visual assessments are advisory and must not replace visual line-of-sight pilot authority.`;

    case 'CHECK_LANDING_MARKER':
      return `${formatFlightContextForPrompt(context)}

### PILOT REQUEST: PRECISION LANDING MARKER CHECK
Check the precision landing target tracker status:
1. Target lock status (targetFound, tagId).
2. Lateral offsets (X/Y displacement in centimeters).
3. Estimated height / altitude from rangefinder or target pose.
4. Pilot advisory guidance (alignment corrections needed).`;

    default:
      return buildUserMessageWithContext('Kiểm tra tình trạng máy bay', context);
  }
}

export function trimConversationHistory(messages: AiChatMessage[], maxTurns: number = 15): AiChatMessage[] {
  if (messages.length <= maxTurns) return messages;
  return messages.slice(messages.length - maxTurns);
}
