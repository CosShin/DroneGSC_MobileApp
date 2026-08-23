import { useEffect } from 'react';
import { universalConnectionService, UniversalTelemetryData } from '../services/connection/UniversalConnectionService';
import { heartbeatService } from '../services/connection/HeartbeatService';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  setStatus, 
  setHeartbeat, 
  setLatency, 
  updateTrafficStats, 
  setDetectedVehicle 
} from '../store/connection/connectionSlice';
import { 
  updateGps, 
  updateBattery, 
  updateAttitude, 
  updateVelocity, 
  updateSensors,
  clearTelemetry 
} from '../store/telemetry/telemetrySlice';
import { setArmed, setFlightMode } from '../store/drone/droneSlice';

export function ConnectionManager() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // 1. Subscribe to status changes
    const unsubscribeStatus = universalConnectionService.onStatusChange((status) => {
      dispatch(setStatus(status));
      if (status === 'CONNECTED') {
        heartbeatService.start();
      } else {
        heartbeatService.stop();
        dispatch(clearTelemetry());
        dispatch(setArmed(false));
        dispatch(setFlightMode('DISCONNECTED'));
        dispatch(updateTrafficStats({ bytesRx: 0, bytesTx: 0, pps: 0 }));
      }
    });

    let lastSlowTick = 0;
    let lastArmed: boolean | null = null;
    let lastFlightMode: string | null = null;

    // 2. Subscribe to telemetry (strictly real packet updates)
    const unsubscribeTelemetry = universalConnectionService.onTelemetry((data: UniversalTelemetryData) => {
      const timestamp = data.timestamp;
      const now = Date.now();
      
      if (!timestamp) return;

      heartbeatService.receiveHeartbeat();

      // High-Frequency Flight Dynamics (Attitude, GPS, Velocity)
      dispatch(updateAttitude({
        value: {
          roll: data.roll || 0,
          pitch: data.pitch || 0,
          yaw: data.yaw || 0,
        },
        timestamp,
      }));

      dispatch(updateGps({
        value: {
          latitude: data.latitude,
          longitude: data.longitude,
          altitude: data.altitude,
          satellites: data.satellites || 0,
          hdop: data.hdop || 0,
          gpsFix: (data.satellites && data.satellites >= 6) ? 3 : 0,
        },
        timestamp,
      }));

      dispatch(updateVelocity({
        value: {
          groundSpeed: data.speed,
          verticalSpeed: 0,
          velocityX: 0,
          velocityY: 0,
          velocityZ: 0,
        },
        timestamp,
      }));

      // State changes (only dispatch when changed)
      if (lastArmed !== data.armed) {
        lastArmed = data.armed;
        dispatch(setArmed(data.armed));
      }
      if (lastFlightMode !== data.mode) {
        lastFlightMode = data.mode;
        dispatch(setFlightMode(data.mode));
      }

      // Low-Frequency Stats (Throttled to 1 Hz to maximize CPU performance & 60 FPS)
      if (now - lastSlowTick > 1000) {
        lastSlowTick = now;
        dispatch(setHeartbeat(timestamp));
        dispatch(setLatency(data.latencyMs));
        dispatch(updateTrafficStats({
          bytesRx: data.bytesRx,
          bytesTx: data.bytesTx,
          pps: data.packetsPerSec,
        }));
        dispatch(setDetectedVehicle({
          name: data.vehicleName,
          vehicleType: data.vehicleType,
          autopilot: data.autopilot,
        }));
        dispatch(updateBattery({
          value: {
            voltage: data.voltage || 0.0,
            current: data.current || 0.0,
            percentage: data.battery,
          },
          timestamp,
        }));

        if (data.sensors && data.sensors.length > 0) {
          dispatch(updateSensors({
            value: data.sensors,
            timestamp,
          }));
        }
      }
    });

    // 3. Subscribe to Heartbeat failures
    const unsubscribeHeartbeat = heartbeatService.onHeartbeat((isAlive) => {
      if (!isAlive) {
        dispatch(setStatus('ERROR'));
        universalConnectionService.disconnect();
      }
    });

    // Cleanup
    return () => {
      unsubscribeStatus();
      unsubscribeTelemetry();
      unsubscribeHeartbeat();
      universalConnectionService.disconnect();
    };
  }, [dispatch]);

  // Headless component
  return null;
}
