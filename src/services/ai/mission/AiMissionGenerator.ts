import { MAV_CMD, MAV_FRAME } from '../../mission/MissionCommandRegistry';
import type { MissionEditorItem, MissionItemInt } from '../../mission/MissionTypes';
import { compileMission } from '../../mission/MissionCompiler';
import { calculateDistanceMeters } from '../../../utils/geographic';
import type { MissionProposalParams } from '../intents/AiIntentTypes';

export interface CompiledAiMissionResult {
  editorItems: MissionEditorItem[];
  wireItems: MissionItemInt[];
  totalDistanceMeters: number;
  estimatedDurationSeconds: number;
  maxAltitudeMeters: number;
  warnings: string[];
}

export class AiMissionGenerator {
  /**
   * Compiles an AI natural-language proposal into high-level MissionEditorItem array
   * and wire MissionItemInt array using the existing deterministic compiler.
   */
  generateMission(proposal: MissionProposalParams): CompiledAiMissionResult {
    const editorItems: MissionEditorItem[] = [];
    const warnings: string[] = [];

    const defaultSpeed = proposal.speedMetersPerSecond && proposal.speedMetersPerSecond > 0
      ? proposal.speedMetersPerSecond
      : 5.0;

    // 1. Takeoff command
    const takeoffAlt = proposal.takeoffAltitudeMeters || 20;
    if (takeoffAlt < 1 || takeoffAlt > 120) {
      throw new Error(`Độ cao cất cánh (${takeoffAlt}m) vượt quá giới hạn an toàn cho phép (1m - 120m).`);
    }
    if (takeoffAlt > 100) {
      warnings.push(`Độ cao cất cánh (${takeoffAlt}m) khá lớn. Hãy chú ý trần bay an toàn.`);
    }

    editorItems.push({
      id: `wp-${Date.now()}-0`,
      command: MAV_CMD.NAV_TAKEOFF,
      frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
      alt: takeoffAlt,
      speed: defaultSpeed,
      autocontinue: true,
    });

    let maxAlt = takeoffAlt;

    // 2. Waypoints
    let seq = 1;
    for (const wp of proposal.waypoints) {
      const alt = wp.altitudeMeters || takeoffAlt;
      if (alt < 1 || alt > 120) {
        throw new Error(`Độ cao waypoint (${alt}m) vượt quá giới hạn trần bay an toàn (1m - 120m).`);
      }
      if (alt > maxAlt) maxAlt = alt;

      editorItems.push({
        id: `wp-${Date.now()}-${seq++}`,
        command: MAV_CMD.NAV_WAYPOINT,
        frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
        lat: wp.latitude,
        lng: wp.longitude,
        alt,
        speed: wp.speedMetersPerSecond || defaultSpeed,
        delay: wp.delaySeconds || 0,
        autocontinue: true,
      });
    }

    // 3. Final action
    const endAction = proposal.endAction || 'RTL';
    if (endAction === 'RTL') {
      editorItems.push({
        id: `wp-${Date.now()}-${seq++}`,
        command: MAV_CMD.NAV_RETURN_TO_LAUNCH,
        frame: MAV_FRAME.MISSION,
        autocontinue: true,
      });
    } else if (endAction === 'LAND') {
      const lastWp = proposal.waypoints[proposal.waypoints.length - 1];
      editorItems.push({
        id: `wp-${Date.now()}-${seq++}`,
        command: MAV_CMD.NAV_LAND,
        frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
        lat: lastWp?.latitude,
        lng: lastWp?.longitude,
        alt: 0,
        autocontinue: true,
      });
    }

    // 4. Compile to MAVLink wire protocol using existing MissionCompiler
    const wireItems = compileMission(editorItems, {
      autoEmitSpeedChanges: true,
      defaultSpeed: 5,
    });

    // 5. Compute distance and estimated duration
    let totalDist = 0;
    for (let i = 0; i < proposal.waypoints.length - 1; i++) {
      const p1 = proposal.waypoints[i];
      const p2 = proposal.waypoints[i + 1];
      totalDist += calculateDistanceMeters(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    }

    const estimatedDuration = defaultSpeed > 0 ? Math.round(totalDist / defaultSpeed) : 0;

    return {
      editorItems,
      wireItems,
      totalDistanceMeters: Math.round(totalDist),
      estimatedDurationSeconds: estimatedDuration,
      maxAltitudeMeters: maxAlt,
      warnings,
    };
  }
}

export const aiMissionGenerator = new AiMissionGenerator();
