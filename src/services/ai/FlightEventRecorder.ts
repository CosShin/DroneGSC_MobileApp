import type { AniToolSnapshot } from './AniToolbox';

export type FlightEventType =
  | 'SESSION_START'
  | 'FLIGHT_START'
  | 'FLIGHT_END'
  | 'ARMED'
  | 'DISARMED'
  | 'TAKEOFF'
  | 'LANDING'
  | 'MODE_CHANGE'
  | 'BATTERY_WARNING'
  | 'GPS_DEGRADED'
  | 'GPS_RECOVERED'
  | 'EKF_WARNING'
  | 'CONNECTION_DEGRADED'
  | 'CONNECTION_LOST'
  | 'CONNECTION_RECOVERED'
  | 'VIDEO_LOST'
  | 'VIDEO_RECOVERED';

export interface FlightEvent {
  type: FlightEventType;
  timestamp: number;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  data?: Record<string, string | number | boolean | null>;
}

export interface FlightSummary {
  sessionId: string | null;
  startedAt: number | null;
  lastUpdatedAt: number | null;
  flightTimeMs: number | null;
  distanceMeters: number | null;
  maxAltitudeMeters: number | null;
  minBatteryPercent: number | null;
  minGpsSatellites: number | null;
  minGpsFixType: number | null;
  modeChanges: FlightEvent[];
  warnings: FlightEvent[];
  connectionEvents: FlightEvent[];
  events: FlightEvent[];
}

const DEFAULT_MAX_EVENTS = 200;
const LOW_BATTERY_PERCENT = 30;
const GPS_MIN_SATS = 6;

export class FlightEventRecorder {
  private readonly maxEvents: number;
  private events: FlightEvent[] = [];
  private sessionId: string | null = null;
  private startedAt: number | null = null;
  private flightStartedAt: number | null = null;
  private accumulatedFlightTimeMs = 0;
  private armed = false;
  private airborne = false;
  private vehicleConnected = false;
  private lastMode: string | null = null;
  private lastVideoLive = false;
  private batteryWarningActive = false;
  private gpsWarningActive = false;
  private ekfWarningActive = false;
  private maxAltitudeMeters: number | null = null;
  private minBatteryPercent: number | null = null;
  private minGpsSatellites: number | null = null;
  private minGpsFixType: number | null = null;
  private distanceMeters: number | null = null;
  private lastUpdatedAt: number | null = null;

  constructor(maxEvents = DEFAULT_MAX_EVENTS) {
    this.maxEvents = Math.max(20, maxEvents);
  }

  reset(sessionId: string | null = null, timestamp = Date.now()) {
    this.events = [];
    this.sessionId = sessionId;
    this.startedAt = timestamp;
    this.flightStartedAt = null;
    this.accumulatedFlightTimeMs = 0;
    this.armed = false;
    this.airborne = false;
    this.vehicleConnected = false;
    this.lastMode = null;
    this.lastVideoLive = false;
    this.batteryWarningActive = false;
    this.gpsWarningActive = false;
    this.ekfWarningActive = false;
    this.maxAltitudeMeters = null;
    this.minBatteryPercent = null;
    this.minGpsSatellites = null;
    this.minGpsFixType = null;
    this.distanceMeters = null;
    this.lastUpdatedAt = timestamp;
    this.push({
      type: 'SESSION_START',
      timestamp,
      message: sessionId ? `Vehicle session ${sessionId} started.` : 'Flight event session started.',
      severity: 'INFO',
    });
  }

  recordEvent(event: FlightEvent) {
    if (!this.startedAt) {
      this.reset(this.sessionId, event.timestamp);
    }
    this.push(event);
    this.lastUpdatedAt = event.timestamp;
  }

  recordSnapshot(snapshot: AniToolSnapshot) {
    const ctx = snapshot.flightContext;
    const timestamp = snapshot.capturedAt;
    const nextSession = ctx.connection.sessionId ?? null;
    if (!this.startedAt || nextSession !== this.sessionId) {
      this.reset(nextSession, timestamp);
    }

    this.lastUpdatedAt = timestamp;
    this.observeConnection(snapshot);
    this.observeVehicle(snapshot);
    this.observeTelemetry(snapshot);
    this.observeVideo(snapshot);
  }

  getSummary(now = Date.now()): FlightSummary {
    const activeFlightMs = this.flightStartedAt ? Math.max(0, now - this.flightStartedAt) : 0;
    const flightTimeMs = this.accumulatedFlightTimeMs + activeFlightMs;
    return {
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      lastUpdatedAt: this.lastUpdatedAt,
      flightTimeMs: flightTimeMs > 0 ? flightTimeMs : null,
      distanceMeters: this.distanceMeters,
      maxAltitudeMeters: this.maxAltitudeMeters,
      minBatteryPercent: this.minBatteryPercent,
      minGpsSatellites: this.minGpsSatellites,
      minGpsFixType: this.minGpsFixType,
      modeChanges: this.events.filter(e => e.type === 'MODE_CHANGE'),
      warnings: this.events.filter(e => e.severity !== 'INFO'),
      connectionEvents: this.events.filter(e => e.type.startsWith('CONNECTION_')),
      events: [...this.events],
    };
  }

  private observeConnection(snapshot: AniToolSnapshot) {
    const ctx = snapshot.flightContext;
    const connected = ctx.vehicle.connected;
    const mavlinkLost = ctx.connection.mavlinkState === 'LOST' || ctx.connection.vehicleState === 'UNRESPONSIVE';
    const degraded = !connected && ctx.connection.mavlinkState === 'HEARTBEAT_STALE';

    if (this.vehicleConnected && mavlinkLost) {
      this.push({
        type: 'CONNECTION_LOST',
        timestamp: snapshot.capturedAt,
        message: 'Vehicle heartbeat/link lost.',
        severity: 'CRITICAL',
        data: { heartbeatAgeMs: ctx.connection.heartbeatAgeMs },
      });
    } else if (this.vehicleConnected && degraded) {
      this.push({
        type: 'CONNECTION_DEGRADED',
        timestamp: snapshot.capturedAt,
        message: 'MAVLink active but vehicle heartbeat is not confirmed.',
        severity: 'WARNING',
        data: { mavlinkState: ctx.connection.mavlinkState },
      });
    } else if (!this.vehicleConnected && connected) {
      this.push({
        type: 'CONNECTION_RECOVERED',
        timestamp: snapshot.capturedAt,
        message: 'Vehicle heartbeat recovered.',
        severity: 'INFO',
      });
    }

    this.vehicleConnected = connected;
  }

  private observeVehicle(snapshot: AniToolSnapshot) {
    const ctx = snapshot.flightContext;
    const timestamp = snapshot.capturedAt;
    const mode = ctx.vehicle.mode || 'UNKNOWN';

    if (ctx.vehicle.connected && mode !== 'UNKNOWN' && this.lastMode && mode !== this.lastMode) {
      this.push({
        type: 'MODE_CHANGE',
        timestamp,
        message: `Mode changed from ${this.lastMode} to ${mode}.`,
        severity: 'INFO',
        data: { from: this.lastMode, to: mode },
      });
    }
    if (ctx.vehicle.connected && mode !== 'UNKNOWN') this.lastMode = mode;

    if (!this.armed && ctx.vehicle.armed) {
      this.armed = true;
      this.flightStartedAt = timestamp;
      this.push({ type: 'ARMED', timestamp, message: 'Vehicle armed.', severity: 'INFO' });
      this.push({ type: 'FLIGHT_START', timestamp, message: 'Flight session started from arm event.', severity: 'INFO' });
    } else if (this.armed && !ctx.vehicle.armed) {
      this.armed = false;
      if (this.flightStartedAt) {
        this.accumulatedFlightTimeMs += Math.max(0, timestamp - this.flightStartedAt);
        this.flightStartedAt = null;
      }
      this.airborne = false;
      this.push({ type: 'DISARMED', timestamp, message: 'Vehicle disarmed.', severity: 'INFO' });
      this.push({ type: 'FLIGHT_END', timestamp, message: 'Flight session ended from disarm event.', severity: 'INFO' });
    }

    const altitude = ctx.flight.altitude;
    if (altitude != null) {
      this.maxAltitudeMeters = this.maxAltitudeMeters == null ? altitude : Math.max(this.maxAltitudeMeters, altitude);
      if (this.armed && !this.airborne && altitude > 1.5) {
        this.airborne = true;
        this.push({ type: 'TAKEOFF', timestamp, message: 'Takeoff inferred from armed altitude increase.', severity: 'INFO', data: { altitudeMeters: altitude } });
      } else if (this.armed && this.airborne && altitude <= 1) {
        this.airborne = false;
        this.push({ type: 'LANDING', timestamp, message: 'Landing inferred from low altitude while armed.', severity: 'INFO', data: { altitudeMeters: altitude } });
      }
    }
  }

  private observeTelemetry(snapshot: AniToolSnapshot) {
    const ctx = snapshot.flightContext;
    const timestamp = snapshot.capturedAt;
    const battery = ctx.battery?.percentage ?? null;
    const sats = ctx.gps?.satellites ?? null;
    const fix = ctx.gps?.fixType ?? null;
    const ekf = ctx.sensors.find(s => /ekf|estimator/i.test(s.name));

    if (ctx.home.distanceMeters != null) this.distanceMeters = ctx.home.distanceMeters;
    if (battery != null) {
      this.minBatteryPercent = this.minBatteryPercent == null ? battery : Math.min(this.minBatteryPercent, battery);
      const active = battery < LOW_BATTERY_PERCENT;
      if (active && !this.batteryWarningActive) {
        this.push({ type: 'BATTERY_WARNING', timestamp, message: `Battery low at ${battery}%.`, severity: battery < 20 ? 'CRITICAL' : 'WARNING', data: { batteryPercent: battery } });
      }
      this.batteryWarningActive = active;
    }

    if (sats != null) this.minGpsSatellites = this.minGpsSatellites == null ? sats : Math.min(this.minGpsSatellites, sats);
    if (fix != null) this.minGpsFixType = this.minGpsFixType == null ? fix : Math.min(this.minGpsFixType, fix);
    const gpsBad = fix != null && (fix < 3 || (sats ?? GPS_MIN_SATS) < GPS_MIN_SATS);
    if (gpsBad && !this.gpsWarningActive) {
      this.push({ type: 'GPS_DEGRADED', timestamp, message: `GPS degraded: fix ${fix ?? '--'}, sats ${sats ?? '--'}.`, severity: 'WARNING', data: { fixType: fix, satellites: sats } });
    } else if (!gpsBad && this.gpsWarningActive) {
      this.push({ type: 'GPS_RECOVERED', timestamp, message: 'GPS quality recovered.', severity: 'INFO', data: { fixType: fix, satellites: sats } });
    }
    this.gpsWarningActive = gpsBad;

    const ekfBad = !!ekf && ekf.health !== 'GOOD';
    if (ekfBad && !this.ekfWarningActive) {
      this.push({ type: 'EKF_WARNING', timestamp, message: ekf.message || ekf.value || 'EKF warning.', severity: ekf.health === 'CRITICAL' ? 'CRITICAL' : 'WARNING' });
    }
    this.ekfWarningActive = ekfBad;
  }

  private observeVideo(snapshot: AniToolSnapshot) {
    const live = snapshot.video.status === 'LIVE';
    if (this.lastVideoLive && !live) {
      this.push({ type: 'VIDEO_LOST', timestamp: snapshot.capturedAt, message: 'Video stream lost.', severity: 'WARNING', data: { status: snapshot.video.status } });
    } else if (!this.lastVideoLive && live) {
      this.push({ type: 'VIDEO_RECOVERED', timestamp: snapshot.capturedAt, message: 'Video stream live.', severity: 'INFO' });
    }
    this.lastVideoLive = live;
  }

  private push(event: FlightEvent) {
    this.events.push(event);
    while (this.events.length > this.maxEvents) this.events.shift();
  }
}

export const flightEventRecorder = new FlightEventRecorder();
