import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { selectGps, selectVelocity } from '../../store/telemetry/telemetrySlice';
import { isTelemetryStale } from '../../utils/telemetry';

export function FlightStatusCard() {
  const gps = useAppSelector(selectGps);
  const velocity = useAppSelector(selectVelocity);

  const isStale = isTelemetryStale(gps?.timestamp || null);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerDot} />
        <Text style={styles.sectionTitle}>FLIGHT DYNAMICS</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>ALTITUDE</Text>
          <Text style={isStale ? styles.valueStale : styles.value}>
            {isStale || !gps ? '--' : gps.value.altitude.toFixed(2)} <Text style={styles.unit}>m</Text>
          </Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>GROUND SPEED</Text>
          <Text style={isStale ? styles.valueStale : styles.value}>
            {isStale || !velocity ? '--' : velocity.value.groundSpeed.toFixed(1)} <Text style={styles.unit}>m/s</Text>
          </Text>
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
    gap: 8,
  },
  col: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  label: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  value: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: 'normal',
  },
  valueStale: {
    color: '#f87171',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
