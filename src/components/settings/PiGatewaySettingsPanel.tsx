import React from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectPiGatewaySettings, updatePiGatewaySettings } from '../../store/settings/settingsSlice';
import { selectConnectionStatus } from '../../store/connection/connectionSlice';

export function PiGatewaySettingsPanel() {
  const dispatch = useAppDispatch();
  const piGateway = useAppSelector(selectPiGatewaySettings);
  const status = useAppSelector(selectConnectionStatus);

  // In a real app, this data would come from the gateway telemetry
  const mockDiagnostics = {
    version: '1.2.0',
    cpu: 25,
    ram: 45,
    temp: 52,
    disk: 30,
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>RASPBERRY PI GATEWAY</Text>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>GATEWAY STATUS</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: status === 'CONNECTED' ? '#0f0' : '#f00' }]} />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>
        <Text style={styles.infoText}>Connection status to the onboard Pi Gateway service.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gateway Address</Text>
        
        <View style={styles.inputRow}>
          <Text style={styles.label}>Gateway IP Address</Text>
          <TextInput 
            style={styles.input}
            value={piGateway.gatewayIp}
            onChangeText={(text) => dispatch(updatePiGatewaySettings({ gatewayIp: text }))}
            placeholder="192.168.1.100"
            placeholderTextColor="#555"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputRow, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>MAVLink Port</Text>
            <TextInput 
              style={styles.input}
              value={piGateway.mavlinkPort.toString()}
              onChangeText={(text) => dispatch(updatePiGatewaySettings({ mavlinkPort: parseInt(text) || 14550 }))}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputRow, { flex: 1 }]}>
            <Text style={styles.label}>Video Port</Text>
            <TextInput 
              style={styles.input}
              value={piGateway.videoPort.toString()}
              onChangeText={(text) => dispatch(updatePiGatewaySettings({ videoPort: parseInt(text) || 5600 }))}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Live Diagnostics</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>VERSION</Text>
            <Text style={styles.statValue}>{mockDiagnostics.version}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>CPU</Text>
            <Text style={styles.statValue}>{mockDiagnostics.cpu}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>RAM</Text>
            <Text style={styles.statValue}>{mockDiagnostics.ram}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TEMP</Text>
            <Text style={[styles.statValue, { color: mockDiagnostics.temp > 75 ? '#f00' : '#0f0' }]}>
              {mockDiagnostics.temp}°C
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>DISK</Text>
            <Text style={styles.statValue}>{mockDiagnostics.disk}%</Text>
          </View>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>REBOOT GATEWAY</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>SAVE SETTINGS</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  content: {
    padding: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 25,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  statusLabel: {
    color: '#888',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  infoText: {
    color: '#555',
    fontSize: 12,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00aaff',
    marginBottom: 15,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
  },
  inputRow: {
    marginBottom: 15,
  },
  label: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    color: '#fff',
    padding: 12,
    borderRadius: 6,
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  statBox: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 6,
    padding: 15,
    minWidth: 120,
    alignItems: 'center',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 15,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f00',
  },
  secondaryButtonText: {
    color: '#f00',
    fontWeight: 'bold',
  },
  primaryButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
