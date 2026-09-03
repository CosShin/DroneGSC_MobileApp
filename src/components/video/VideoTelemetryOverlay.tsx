import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { selectDroneMode, selectIsArmed } from '../../store/drone/droneSlice';
import { selectAltitude, selectBatteryPercentage, selectGps, selectGpsFix, selectGroundSpeed, selectSatellites } from '../../store/telemetry/telemetrySlice';
import { selectHomePosition } from '../../store/home/homeSlice';
import { calculateDistanceMeters, formatDistance, isValidCoordinate } from '../../utils/geographic';
import { glass, glassShadow, radius } from '../../theme/gcsTheme';

export const VideoTelemetryOverlay = React.memo(function VideoTelemetryOverlay() {
  const mode = useAppSelector(selectDroneMode);
  const armed = useAppSelector(selectIsArmed);
  const altitude = useAppSelector(selectAltitude);
  const speed = useAppSelector(selectGroundSpeed);
  const battery = useAppSelector(selectBatteryPercentage);
  const satellites = useAppSelector(selectSatellites);
  const gpsFix = useAppSelector(selectGpsFix);
  const gps = useAppSelector(selectGps);
  const home = useAppSelector(selectHomePosition);

  const homeDistance = home
    && (gpsFix ?? 0) >= 3
    && isValidCoordinate(gps?.value.latitude, gps?.value.longitude)
    ? calculateDistanceMeters(gps!.value.latitude, gps!.value.longitude, home.latitude, home.longitude)
    : null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Metric label="MODE" value={mode || '--'} />
      <Metric label="ARM" value={armed ? 'ARMED' : 'DISARMED'} tone={armed ? 'success' : 'danger'} />
      <Metric label="ALT" value={altitude == null ? '--' : `${altitude.toFixed(1)} m`} />
      <Metric label="GS" value={speed == null ? '--' : `${speed.toFixed(1)} m/s`} />
      <Metric label="HOME" value={formatDistance(homeDistance)} />
      <Metric label="GPS" value={satellites == null ? '--' : `${satellites} sats · ${gpsFix ?? '--'}`} />
      <Metric label="BAT" value={battery == null ? '--' : `${Math.round(battery)}%`} tone={battery != null && battery < 20 ? 'danger' : undefined} />
    </View>
  );
});

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  const color = tone === 'success' ? '#27AE60' : tone === 'danger' ? '#EB5757' : '#1E2A3A';
  return (
    <View style={styles.metric}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  metric: {
    minWidth: 66,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: glass.border,
    ...glassShadow,
  },
  label: {
    color: '#5D6B7E',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  value: {
    marginTop: 2,
    color: '#1E2A3A',
    fontSize: 9.5,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});
