import { useEffect, useRef } from 'react';
import { universalConnectionService, UniversalTelemetryData } from '../services/connection/UniversalConnectionService';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  selectConnectionConfig,
  selectMavlinkSettings,
  selectSettingsHydrated,
} from '../store/settings/settingsSlice';
import {
  setStatus, setHeartbeat, setLatency, updateTrafficStats, setDetectedVehicle,
  setLinkState, setPacketsLost, setActiveConnectionInfo,
} from '../store/connection/connectionSlice';
import {
  updateBattery, clearBattery, updateSensors, updateTelemetrySnapshot,
  clearTelemetry, setTelemetryStale, addStatusText,
} from '../store/telemetry/telemetrySlice';
import { setArmed, setDroneStale, setFlightMode } from '../store/drone/droneSlice';
import { clearCommandState, setCommandAck } from '../store/command/commandSlice';
import { setHomePosition, clearHomePosition } from '../store/home/homeSlice';
import { isValidCoordinate } from '../utils/geographic';
import { aiFlightSupervisor } from '../services/ai/supervisor/AiFlightSupervisor';
import { store } from '../store';

export function ConnectionManager() {
  const dispatch = useAppDispatch();
  const connectionConfig = useAppSelector(selectConnectionConfig);
  const mavlinkSettings = useAppSelector(selectMavlinkSettings);
  const settingsHydrated = useAppSelector(selectSettingsHydrated);
  const autoConnectStarted = useRef(false);

  useEffect(() => {
    // Start continuous AI Flight Supervisor monitoring
    aiFlightSupervisor.start(15_000, () => store.getState());

    let lastHomeUpdatedAt = 0;
    const unsubscribeStatus = universalConnectionService.onStatusChange(status => {
      dispatch(setStatus(status));
      if (status === 'CONNECTED') {
        dispatch(setTelemetryStale(false));
        dispatch(setDroneStale(false));
      } else if (status === 'ERROR') {
        dispatch(setTelemetryStale(true));
        dispatch(setDroneStale(true));
      } else if (status === 'DISCONNECTED') {
        lastHomeUpdatedAt = 0;
        dispatch(clearTelemetry());
        dispatch(clearCommandState());
        dispatch(clearHomePosition());
        dispatch(setArmed(false));
        dispatch(setFlightMode('UNKNOWN'));
        dispatch(setDroneStale(false));
        dispatch(updateTrafficStats({
          bytesRx: 0,
          bytesTx: 0,
          pps: 0,
          txPps: 0,
          rxBytesPerSec: 0,
          txBytesPerSec: 0,
          mavlinkVersion: null,
        }));
      }
    });

    const unsubscribeLink = universalConnectionService.onLinkState(link => {
      dispatch(setLinkState(link));
    });

    let lastSlowTick = 0;
    let lastUiTick = 0;
    let lastArmed: boolean | null = null;
    let lastFlightMode: string | null = null;
    let lastStale: boolean | null = null;
    const unsubscribeTelemetry = universalConnectionService.onTelemetry((data: UniversalTelemetryData) => {
      const timestamp = data.timestamp;
      const now = Date.now();
      if (!timestamp) return;

      if (lastStale !== data.stale) {
        lastStale = data.stale;
        dispatch(setDroneStale(data.stale));
      }

      // The parser stays lossless and continuous, while Redux/UI receives one
      // coherent snapshot at no more than 10 Hz. This keeps touch/navigation
      // responsive even when the Pi delivers many MAVLink frames per WS batch.
      if (now - lastUiTick >= 100) {
        lastUiTick = now;
        dispatch(updateTelemetrySnapshot({
          timestamp,
          gpsTimestamp: data.gpsTimestamp,
          attitudeTimestamp: data.attitudeTimestamp,
          velocityTimestamp: data.velocityTimestamp,
          stale: data.stale,
          attitude: data.roll !== null && data.pitch !== null && data.yaw !== null
            ? { roll: data.roll, pitch: data.pitch, yaw: data.yaw }
            : null,
          gps: data.latitude !== null && data.longitude !== null && data.altitude !== null
            ? {
                latitude: data.latitude,
                longitude: data.longitude,
                altitude: data.altitude,
                altitudeMsl: data.altitudeMsl,
                relativeAltitude: data.relativeAltitude,
                satellites: data.satellites,
                hdop: data.hdop,
                gpsFix: data.gpsFix,
              }
            : null,
          velocity: data.speed !== null
            ? { groundSpeed: data.speed, verticalSpeed: data.climb, velocityX: null, velocityY: null, velocityZ: null }
            : null,
        }));
      }

      if (!data.stale && lastArmed !== data.armed) {
        lastArmed = data.armed;
        dispatch(setArmed(data.armed));
      }
      if (!data.stale && lastFlightMode !== data.mode) {
        lastFlightMode = data.mode;
        dispatch(setFlightMode(data.mode));
      }

      if (now - lastSlowTick > 1000) {
        lastSlowTick = now;
        if (data.lastHeartbeatAt) dispatch(setHeartbeat(data.lastHeartbeatAt));
        dispatch(setLatency(data.latencyMs));
        dispatch(updateTrafficStats({
          bytesRx: data.bytesRx,
          bytesTx: data.bytesTx,
          pps: data.rxPacketsPerSec,
          txPps: data.txPacketsPerSec,
          rxBytesPerSec: data.rxBytesPerSec,
          txBytesPerSec: data.txBytesPerSec,
          mavlinkVersion: data.mavlinkVersion,
        }));
        dispatch(setPacketsLost(data.packetsLost));
        dispatch(setDetectedVehicle({ name: data.vehicleName, vehicleType: data.vehicleType, autopilot: data.autopilot }));
        if (data.battery !== null) {
          dispatch(updateBattery({
            value: { voltage: data.voltage, current: data.current, percentage: data.battery },
            timestamp: data.batteryTimestamp || timestamp,
          }));
        } else dispatch(clearBattery());
        if (data.sensors.length > 0) dispatch(updateSensors({ value: data.sensors, timestamp }));
        if (data.homeUpdatedAt !== null
          && data.homeUpdatedAt > lastHomeUpdatedAt
          && isValidCoordinate(data.homeLatitude, data.homeLongitude)
          && data.homeAltitude !== null
          && Number.isFinite(data.homeAltitude)) {
          lastHomeUpdatedAt = data.homeUpdatedAt;
          dispatch(setHomePosition({
            latitude: data.homeLatitude!,
            longitude: data.homeLongitude!,
            altitude: data.homeAltitude,
            updatedAt: data.homeUpdatedAt,
          }));
        }
      }
    });

    const unsubscribeHeartbeat = universalConnectionService.onHeartbeat(timestamp => dispatch(setHeartbeat(timestamp)));
    const unsubscribeAck = universalConnectionService.onCommandAck(ack => {
      dispatch(setCommandAck({
        mavCommand: ack.command,
        result: ack.result,
        progress: ack.progress,
        ackAt: ack.receivedAt,
      }));
    });
    const unsubscribeStatusText = universalConnectionService.onStatusText(message => {
      dispatch(addStatusText({ severity: message.severity, text: message.text, timestamp: message.receivedAt }));
    });

    return () => {
      aiFlightSupervisor.stop();
      unsubscribeStatus();
      unsubscribeLink();
      unsubscribeTelemetry();
      unsubscribeHeartbeat();
      unsubscribeAck();
      unsubscribeStatusText();
      universalConnectionService.disconnect();
    };
  }, [dispatch]);

  useEffect(() => {
    if (!settingsHydrated || autoConnectStarted.current) return;
    autoConnectStarted.current = true;
    let cancelled = false;

    const shouldAutoConnect = connectionConfig.type === 'WEBSOCKET'
      ? connectionConfig.websocket.autoConnect
      : connectionConfig.type === 'UDP'
        ? connectionConfig.udp.autoConnect
        : connectionConfig.type === 'TCP' && connectionConfig.tcp.autoConnect;
    if (!shouldAutoConnect) return;

    dispatch(setActiveConnectionInfo({
      type: connectionConfig.type,
      portInfo: connectionConfig.type === 'WEBSOCKET'
        ? connectionConfig.websocket.url
        : connectionConfig.type === 'TCP'
          ? `TCP: ${connectionConfig.tcp.host}:${connectionConfig.tcp.port}`
          : `UDP: ${connectionConfig.udp.localPort}`,
    }));
    void universalConnectionService.configureMavlinkSigning(
      mavlinkSettings.signingPolicy,
      mavlinkSettings.signingLinkId,
    ).then(() => {
      if (!cancelled) return universalConnectionService.connect(connectionConfig);
      return undefined;
    }).catch(error => {
      if (!cancelled) console.warn('[MAVLink auto-connect]', error instanceof Error ? error.message : 'Unable to connect');
    });
    return () => { cancelled = true; };
  }, [connectionConfig, dispatch, mavlinkSettings, settingsHydrated]);

  return null;
}
