import React from 'react';
import { View, StyleSheet, Text, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppSelector } from '../../store/hooks';
import { selectSensors, SensorState } from '../../store/telemetry/telemetrySlice';

const getHealthColor = (health: string) => {
  switch (health) {
    case 'GOOD': return '#00ff88'; // Green
    case 'WARNING': return '#ffaa00'; // Yellow/Orange
    case 'CRITICAL': return '#ff4444'; // Red
    default: return '#888888'; // Gray
  }
};

const SensorCard = ({ sensor }: { sensor: SensorState }) => {
  const color = getHealthColor(sensor.health);

  // Simple flashing effect for critical errors
  const [opacity] = React.useState(new Animated.Value(1));

  React.useEffect(() => {
    if (sensor.health === 'CRITICAL') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true })
        ])
      ).start();
    } else {
      opacity.setValue(1);
    }
  }, [sensor.health, opacity]);

  return (
    <Animated.View style={[styles.card, { borderColor: color, opacity }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.sensorName}>{sensor.name}</Text>
        <View style={[styles.healthDot, { backgroundColor: color }]} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.sensorStatus, { color }]}>{sensor.health}</Text>
        {sensor.value && <Text style={styles.sensorValue}>{sensor.value}</Text>}
        {sensor.message && <Text style={styles.sensorMessage}>{sensor.message}</Text>}
      </View>
    </Animated.View>
  );
};

export function SensorsScreen() {
  const sensorsWrapper = useAppSelector(selectSensors);
  const sensors = sensorsWrapper?.value || [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom']}>
      <StatusBar hidden />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SYSTEM SENSORS DIAGNOSTICS</Text>
        <Text style={styles.headerSubtitle}>Monitor real-time health and calibration status of flight controller sensors.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {sensors.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Waiting for sensor data...</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {sensors.map((sensor, idx) => (
              <SensorCard key={idx} sensor={sensor} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: '#111',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 5,
  },
  scrollContent: {
    padding: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  card: {
    width: 250,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 2,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 10,
  },
  sensorName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  healthDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  cardBody: {
    gap: 5,
  },
  sensorStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  sensorValue: {
    color: '#ccc',
    fontSize: 16,
    marginTop: 5,
  },
  sensorMessage: {
    color: '#aaa',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 50,
  },
  emptyStateText: {
    color: '#555',
    fontSize: 18,
  },
});
