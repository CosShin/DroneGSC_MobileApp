import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { selectConnectionStatus } from '../../store/connection/connectionSlice';

export function ConnectionCard() {
  const status = useAppSelector(selectConnectionStatus);

  const getStatusColor = () => {
    switch (status) {
      case 'CONNECTED': return '#00ff00';
      case 'CONNECTING': return '#ffaa00';
      case 'DISCONNECTED':
      case 'ERROR':
      default:
        return '#ff4444';
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>CONNECTION</Text>
      <View style={styles.row}>
        <View style={[styles.indicator, { backgroundColor: getStatusColor() }]} />
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e1e1e',
    padding: 15,
    borderRadius: 8,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#888',
    fontSize: 14,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
