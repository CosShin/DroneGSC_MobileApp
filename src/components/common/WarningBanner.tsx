import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { selectConnectionStatus } from '../../store/connection/connectionSlice';
import { selectGps } from '../../store/telemetry/telemetrySlice';
import { isTelemetryStale } from '../../utils/telemetry';
import { AppConfig } from '../../config';

export function WarningBanner() {
  const connectionStatus = useAppSelector(selectConnectionStatus);
  const gps = useAppSelector(selectGps);

  const warnings: string[] = [];

  if (connectionStatus === 'ERROR' || connectionStatus === 'DISCONNECTED') {
    warnings.push('CONNECTION LOST');
  } else if (connectionStatus === 'CONNECTED') {
    if (isTelemetryStale(gps?.timestamp || null)) {
      warnings.push('TELEMETRY STALE');
    }
  }

  const battery = useAppSelector((state: any) => state.telemetry.battery);
  if (battery && battery.value.percentage < AppConfig.LOW_BATTERY_THRESHOLD) {
    warnings.push('LOW BATTERY');
  }

  if (warnings.length === 0) return null;

  return (
    <View style={styles.container}>
      {warnings.map((warning, index) => (
        <Text key={index} style={styles.text}>
          ⚠️ {warning}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    padding: 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginVertical: 2,
  },
});
