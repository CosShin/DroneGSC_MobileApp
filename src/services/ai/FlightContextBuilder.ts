import type { RootState } from '../../store';
import type { MavlinkInspectorSnapshot } from '../mavlink/MavlinkInspectorService';
import { calculateBearingDegrees, calculateDistanceMeters, isValidCoordinate } from '../../utils/geographic';
import { isGpsStale, isTelemetryStale } from '../../utils/telemetry';
import { AppConfig } from '../../config';
import { MAV_CMD, getCommandDefinition } from '../mission/MissionCommandRegistry';
import type { FlightContextSnapshot, NormalizedMissionSummary } from './AiTypes';
import { precisionLandingAdvisor } from '../vision/PrecisionLandingAdvisor';

let lazyStore: { getState: () => RootState } | null = null;
let lazyInspector: { getSnapshot: () => MavlinkInspectorSnapshot } | null = null;

function getStoreState(): RootState | null {
  if (!lazyStore) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../store');
      lazyStore = mod.store || mod.default?.store || mod;
    } catch {
      lazyStore = null;
    }
  }
  return lazyStore ? lazyStore.getState() : null;
}

function getInspectorSnapshot(): MavlinkInspectorSnapshot | null {
  if (!lazyInspector) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      lazyInspector = require('../mavlink/MavlinkInspectorService').mavlinkInspectorService;
    } catch {
      lazyInspector = null;
    }
  }
  return lazyInspector ? lazyInspector.getSnapshot() : null;
}

export function buildFlightContext(
  stateOverride?: RootState,
  inspectorOverride?: MavlinkInspectorSnapshot | null
): FlightContextSnapshot {
  const state = stateOverride ?? getStoreState();
  if (!state) {
    throw new Error('No Redux state available for FlightContextBuilder');
  }
  const now = Date.now();

  const connection = state.connection;
  const drone = state.drone;
  const telemetry = state.telemetry;
  const home = state.home;
  const mission = state.mission;

  const isVehicleConnected = connection.status === 'CONNECTED'
    && connection.vehicleStatus === 'AVAILABLE'
    && connection.mavlinkStatus === 'HEARTBEAT_OK';
  const isHeartbeatLost = connection.mavlinkStatus === 'LOST' || connection.vehicleStatus === 'UNRESPONSIVE';

  // 1. Vehicle State
  const vehicle = {
    connected: isVehicleConnected,
    name: connection.vehicleName || 'NO VEHICLE',
    vehicleType: connection.vehicleType,
    autopilot: connection.autopilot,
    armed: drone.armed,
    mode: drone.flightMode || 'UNKNOWN',
    systemStatus: drone.systemStatus || 'UNKNOWN',
    stale: drone.stale || telemetry.stale || isHeartbeatLost,
  };

  // 2. Connection State
  const connectionState = {
    transport: connection.activeType,
    portInfo: connection.activePortInfo,
    networkState: connection.networkStatus,
    mavlinkState: connection.mavlinkStatus,
    vehicleState: connection.vehicleStatus,
    heartbeatAgeMs: connection.heartbeatAgeMs,
    latencyMs: connection.rttMs,
    rxPps: connection.packetsPerSec,
    txPps: connection.txPacketsPerSec,
    bytesReceived: connection.bytesReceived,
    bytesSent: connection.bytesSent,
    packetsLost: connection.packetsLost,
    mavlinkVersion: connection.mavlinkVersion,
    sessionId: connection.sessionId ?? null,
  };

  // 3. Battery State (Truthful: null if not received)
  const batteryData = telemetry.battery?.value;
  const battery = batteryData ? {
    available: true,
    voltage: batteryData.voltage != null ? Number(batteryData.voltage.toFixed(2)) : null,
    current: batteryData.current != null ? Number(batteryData.current.toFixed(2)) : null,
    percentage: batteryData.percentage != null ? Math.round(batteryData.percentage) : null,
    remainingPercent: batteryData.percentage != null ? Math.round(batteryData.percentage) : null,
  } : null;

  // 4. GPS State (Truthful: null if not received)
  const gpsData = telemetry.gps?.value;
  const isGpsValid = gpsData && isValidCoordinate(gpsData.latitude, gpsData.longitude);
  const fixType = gpsData?.gpsFix ?? null;
  const satellites = gpsData?.satellites ?? null;
  const fix = fixType != null && fixType >= 3;
  const fixDescription = fixType == null ? 'UNKNOWN' : fixType >= 3 ? '3D FIX' : fixType === 2 ? '2D FIX' : 'NO FIX';
  const gps = gpsData ? {
    available: true,
    fix,
    fixType,
    fixDescription,
    satellites,
    hdop: gpsData.hdop != null ? Number(gpsData.hdop.toFixed(2)) : null,
    vdop: null,
    latitude: isGpsValid ? Number(gpsData.latitude.toFixed(7)) : null,
    longitude: isGpsValid ? Number(gpsData.longitude.toFixed(7)) : null,
    altitude: gpsData.altitude != null ? Number(gpsData.altitude.toFixed(1)) : null,
  } : null;

  // 5. Flight Dynamics
  const attitude = telemetry.attitude?.value;
  const velocity = telemetry.velocity?.value;
  const heading = attitude?.yaw != null 
    ? ((Math.round(attitude.yaw) % 360) + 360) % 360 
    : null;

  const flight = {
    altitude: gpsData?.altitude != null ? Number(gpsData.altitude.toFixed(1)) : null,
    groundSpeed: velocity?.groundSpeed != null ? Number(velocity.groundSpeed.toFixed(1)) : null,
    verticalSpeed: velocity?.verticalSpeed != null ? Number(velocity.verticalSpeed.toFixed(1)) : null,
    heading,
    roll: attitude?.roll != null ? Number(attitude.roll.toFixed(1)) : null,
    pitch: attitude?.pitch != null ? Number(attitude.pitch.toFixed(1)) : null,
    yaw: attitude?.yaw != null ? Number(attitude.yaw.toFixed(1)) : null,
  };

  // 6. Home Position & Distances
  const isHomeSet = home.status === 'SET' && home.position != null;
  const homePos = home.position;
  let homeDistance: number | null = null;
  let homeBearing: number | null = null;

  if (isHomeSet && homePos && isGpsValid && gpsData) {
    homeDistance = Number(calculateDistanceMeters(gpsData.latitude, gpsData.longitude, homePos.latitude, homePos.longitude).toFixed(1));
    homeBearing = Math.round(calculateBearingDegrees(gpsData.latitude, gpsData.longitude, homePos.latitude, homePos.longitude));
  }

  const homeState = {
    isSet: isHomeSet,
    latitude: homePos ? Number(homePos.latitude.toFixed(7)) : null,
    longitude: homePos ? Number(homePos.longitude.toFixed(7)) : null,
    altitude: homePos ? Number(homePos.altitude.toFixed(1)) : null,
    distanceMeters: homeDistance,
    bearingDegrees: homeBearing,
  };

  // 7. MAVLink Inspector Diagnostics Snapshot
  const inspectorSnapshot = inspectorOverride !== undefined ? inspectorOverride : getInspectorSnapshot();

  const mavlinkDiag = {
    rxPps: inspectorSnapshot?.traffic.rxPacketsPerSec ?? connection.packetsPerSec,
    txPps: inspectorSnapshot?.traffic.txPacketsPerSec ?? connection.txPacketsPerSec,
    crcErrors: inspectorSnapshot?.traffic.parser.crcErrors ?? 0,
    dropped: inspectorSnapshot?.traffic.packetsLost ?? connection.packetsLost,
    reconnectCount: inspectorSnapshot?.reconnectCount ?? 0,
    topRates: (inspectorSnapshot?.rates ?? []).slice(0, 8).map(r => ({
      name: r.messageName,
      rateHz: Number(r.rateHz.toFixed(1)),
      rxCount: r.rxCount,
      txCount: r.txCount,
    })),
  };

  // 8. Sensors
  const rawSensors = telemetry.sensors?.value ?? [];
  const sensors = rawSensors.map(s => ({
    name: s.name,
    health: s.health,
    value: s.value,
    message: s.message,
  }));

  const ekfSensor = rawSensors.find(s => /ekf|estimator/i.test(s.name));
  const ekf = {
    available: Boolean(ekfSensor),
    healthy: ekfSensor ? ekfSensor.health === 'GOOD' : null,
    message: ekfSensor?.message ?? ekfSensor?.value,
  };

  const flowSensor = rawSensors.find(s => /flow|optical/i.test(s.name));
  const opticalFlow = {
    available: Boolean(flowSensor),
    quality: flowSensor?.value ? parseFloat(flowSensor.value) : null,
  };

  const targetState = precisionLandingAdvisor.getTargetState();
  const rangeSensor = rawSensors.find(s => /range|distance|lidar|sonar/i.test(s.name));
  const rangefinder = {
    available: Boolean(rangeSensor) || targetState.altitudeMeters != null,
    distance: rangeSensor?.value ? parseFloat(rangeSensor.value) : targetState.altitudeMeters ?? null,
  };

  // 9. Warnings & PreArm Checks
  const warnings: string[] = [];

  if (connection.status === 'ERROR') {
    warnings.push('PreArm: Link error - check gateway');
  } else if (connection.status === 'CONNECTED' && (drone.stale || isHeartbeatLost)) {
    warnings.push('PreArm: Heartbeat lost - vehicle unreachable');
  } else if (connection.status === 'CONNECTED' && (!gpsData || (gpsData.gpsFix ?? 0) < 3)) {
    warnings.push('PreArm: Need 3D GPS Fix');
  }

  if (telemetry.gps && isGpsStale(telemetry.gps.timestamp)) {
    warnings.push('PreArm: GPS telemetry stale');
  }

  if (batteryData && batteryData.percentage < AppConfig.LOW_BATTERY_THRESHOLD) {
    warnings.push(`PreArm: Battery 1 low (${Math.round(batteryData.percentage)}%)`);
  }

  // Active status texts with severity <= 4 (Emergency, Alert, Critical, Error, Warning)
  const recentTexts = (telemetry.statusTexts ?? [])
    .filter(msg => msg.severity <= 4 && now - msg.timestamp < 30_000)
    .map(msg => msg.text);
  
  for (const text of recentTexts) {
    if (!warnings.includes(text)) {
      warnings.push(text);
    }
  }

  // 10. Mission Summary
  let missionSummary: NormalizedMissionSummary | null = null;
  if (mission?.items && mission.items.length > 0) {
    let totalDist = 0;
    let maxAlt = 0;
    let hasRtl = false;
    let hasLand = false;
    let hasTakeoff = false;
    const speedChanges: Array<{ index: number; speedMps: number }> = [];
    const commands: string[] = [];

    const locItems = mission.items.filter(it => it.lat != null && it.lng != null);
    for (let i = 0; i < locItems.length - 1; i++) {
      const p1 = locItems[i];
      const p2 = locItems[i + 1];
      if (p1.lat != null && p1.lng != null && p2.lat != null && p2.lng != null) {
        totalDist += calculateDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
      }
    }

    mission.items.forEach((item, index) => {
      const def = getCommandDefinition(item.command);
      if (item.alt != null && item.alt > maxAlt) maxAlt = item.alt;
      if (item.command === MAV_CMD.NAV_RETURN_TO_LAUNCH) hasRtl = true;
      if (item.command === MAV_CMD.NAV_LAND) hasLand = true;
      if (item.command === MAV_CMD.NAV_TAKEOFF) hasTakeoff = true;
      if (item.speed != null) speedChanges.push({ index: index + 1, speedMps: item.speed });

      const detail = item.alt != null ? ` (${item.alt}m)` : '';
      commands.push(`#${index + 1} ${def.label}${detail}`);
    });

    missionSummary = {
      count: mission.items.length,
      totalDistanceMeters: Number(totalDist.toFixed(1)),
      maxAltitudeMeters: Number(maxAlt.toFixed(1)),
      commands,
      hasRtl,
      hasLand,
      hasTakeoff,
      speedChanges,
    };
  }

  const snapshot: FlightContextSnapshot = {
    timestamp: now,
    vehicle,
    connection: connectionState,
    battery,
    gps,
    flight,
    home: homeState,
    mavlink: mavlinkDiag,
    sensors,
    warnings,
    mission: missionSummary,
    precisionLanding: precisionLandingAdvisor.getTargetState(),
    ekf,
    opticalFlow,
    rangefinder,
  };

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[ANI CONTEXT SNAPSHOT]', {
      vehicleConnected: isVehicleConnected,
      mode: drone.flightMode || 'UNKNOWN',
      armed: drone.armed,
      battery: battery?.percentage ?? null,
      gpsFix: gps?.fix ?? false,
      satellites: gps?.satellites ?? null,
    });
  }

  return snapshot;
}
