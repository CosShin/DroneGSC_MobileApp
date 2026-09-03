import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { selectConnectionStatus } from '../../store/connection/connectionSlice';
import { selectBattery, selectGps, selectStatusTexts, selectTelemetryStale } from '../../store/telemetry/telemetrySlice';
import { selectHomeTransaction } from '../../store/home/homeSlice';
import { isTelemetryStale } from '../../utils/telemetry';
import { AppConfig } from '../../config';
import { glassShadow, layers, radius } from '../../theme/gcsTheme';

export function WarningBanner() {
  const homeTransaction = useAppSelector(selectHomeTransaction);
  const status = useAppSelector(selectConnectionStatus);
  const gps = useAppSelector(selectGps);
  const stale = useAppSelector(selectTelemetryStale);
  const messages = useAppSelector(selectStatusTexts);
  const battery = useAppSelector(selectBattery);
  
  if (homeTransaction.status === 'CONFIRMING') return null;
  
  const warnings: string[] = [];
  if (status === 'ERROR') warnings.push('PreArm: Link error - check gateway');
  else if (status === 'CONNECTED' && stale) warnings.push('PreArm: Heartbeat lost - vehicle unreachable');
  else if (status === 'CONNECTED' && !gps) warnings.push('PreArm: Need 3D GPS Fix');
  else if (gps && isTelemetryStale(gps.timestamp)) warnings.push('PreArm: GPS telemetry stale');
  
  const autopilot = messages.find(message => message.severity <= 4 && Date.now() - message.timestamp < 15_000);
  if (autopilot) warnings.push(autopilot.text);
  
  if (battery && battery.value.percentage < AppConfig.LOW_BATTERY_THRESHOLD) {
    warnings.push('PreArm: Battery 1 below minimum arming voltage');
  }

  if (!warnings.length) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.card}>
        <MaterialCommunityIcons name="alert-outline" size={13} color="#DC2626" />
        <Text numberOfLines={1} style={styles.text}>
          {warnings[0]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    zIndex: layers.critical,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    maxWidth: 420,
    minHeight: 30,
    paddingHorizontal: 14,
    paddingVertical: 4.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(254, 242, 242, 0.94)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.40)',
    borderRadius: radius.pill,
    gap: 6,
    ...glassShadow,
  },
  text: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 9.5,
    letterSpacing: 0.2,
  },
});
