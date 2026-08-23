import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { selectGps } from '../../store/telemetry/telemetrySlice';
import { isTelemetryStale } from '../../utils/telemetry';

export function GpsCard() {
  const gps = useAppSelector(selectGps);
  const isStale = isTelemetryStale(gps?.timestamp || null);

  if (isStale || !gps) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={[styles.headerDot, { backgroundColor: '#f87171' }]} />
          <Text style={styles.sectionTitle}>GPS NAVIGATION</Text>
        </View>
        <Text style={styles.valueStale}>NO DATA</Text>
      </View>
    );
  }

  const { satellites, hdop, gpsFix } = gps.value;
  const isFixed = gpsFix > 2;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.headerDot, { backgroundColor: isFixed ? '#22c55e' : '#f59e0b' }]} />
        <Text style={styles.sectionTitle}>GPS NAVIGATION</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>LOCK</Text>
          <Text style={[styles.value, { color: isFixed ? '#4ade80' : '#f59e0b' }]}>
            {isFixed ? '3D FIX' : 'NO FIX'}
          </Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>SATELLITES</Text>
          <Text style={styles.value}>{satellites}</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>HDOP</Text>
          <Text style={styles.value}>{hdop.toFixed(1)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 8,
    borderRadius: 8,
    marginVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  col: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
  },
  label: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  value: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  valueStale: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: 'bold',
    padding: 4,
  },
});
