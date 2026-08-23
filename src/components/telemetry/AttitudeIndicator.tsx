import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { selectAttitude } from '../../store/telemetry/telemetrySlice';
import { isTelemetryStale } from '../../utils/telemetry';

export function AttitudeIndicator() {
  const attitude = useAppSelector(selectAttitude);
  const isStale = isTelemetryStale(attitude?.timestamp || null);

  if (isStale || !attitude) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={[styles.headerDot, { backgroundColor: '#f87171' }]} />
          <Text style={styles.sectionTitle}>ATTITUDE</Text>
        </View>
        <Text style={styles.valueStale}>NO DATA</Text>
      </View>
    );
  }

  const { roll, pitch, yaw } = attitude.value;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerDot} />
        <Text style={styles.sectionTitle}>ORIENTATION</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>ROLL</Text>
          <Text style={styles.value}>{roll.toFixed(1)}°</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>PITCH</Text>
          <Text style={styles.value}>{pitch.toFixed(1)}°</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>YAW</Text>
          <Text style={styles.value}>{yaw.toFixed(1)}°</Text>
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
    backgroundColor: '#38bdf8',
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
