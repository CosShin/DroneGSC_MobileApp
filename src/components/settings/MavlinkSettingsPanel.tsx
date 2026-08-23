import React from 'react';
import { View, Text, StyleSheet, TextInput, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectMavlinkSettings, updateMavlinkSettings } from '../../store/settings/settingsSlice';
import { selectConnectionStatus } from '../../store/connection/connectionSlice';

export function MavlinkSettingsPanel() {
  const dispatch = useAppDispatch();
  const mavlink = useAppSelector(selectMavlinkSettings);
  const status = useAppSelector(selectConnectionStatus);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>MAVLINK SETTINGS</Text>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>MAVLINK LINK</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: status === 'CONNECTED' ? '#0f0' : '#f00' }]} />
            <Text style={styles.statusText}>{status === 'CONNECTED' ? 'HEARTBEAT OK' : 'TIMEOUT'}</Text>
          </View>
        </View>
        <Text style={styles.infoText}>Current state of the MAVLink protocol communication.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Protocol Configuration</Text>
        
        <View style={styles.row}>
          <View style={[styles.inputRow, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>System ID</Text>
            <TextInput 
              style={styles.input}
              value={mavlink.systemId.toString()}
              onChangeText={(text) => dispatch(updateMavlinkSettings({ systemId: parseInt(text) || 255 }))}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputRow, { flex: 1 }]}>
            <Text style={styles.label}>Component ID</Text>
            <TextInput 
              style={styles.input}
              value={mavlink.componentId.toString()}
              onChangeText={(text) => dispatch(updateMavlinkSettings({ componentId: parseInt(text) || 1 }))}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputRow, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>Target System</Text>
            <TextInput 
              style={styles.input}
              value={mavlink.targetSystem.toString()}
              onChangeText={(text) => dispatch(updateMavlinkSettings({ targetSystem: text === 'AUTO' ? 'AUTO' : parseInt(text) || 1 }))}
            />
          </View>
          <View style={[styles.inputRow, { flex: 1 }]}>
            <Text style={styles.label}>Target Component</Text>
            <TextInput 
              style={styles.input}
              value={mavlink.targetComponent.toString()}
              onChangeText={(text) => dispatch(updateMavlinkSettings({ targetComponent: text === 'AUTO' ? 'AUTO' : parseInt(text) || 1 }))}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>
        
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Send Heartbeat</Text>
            <Text style={styles.switchDesc}>Emit MAVLink HEARTBEAT periodically</Text>
          </View>
          <Switch 
            value={mavlink.heartbeatEnabled}
            onValueChange={(val) => { dispatch(updateMavlinkSettings({ heartbeatEnabled: val })); }}
            trackColor={{ false: '#333', true: '#0066cc' }}
          />
        </View>

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Accept MAVLink 1</Text>
            <Text style={styles.switchDesc}>Allow legacy MAVLink 1 packets</Text>
          </View>
          <Switch 
            value={mavlink.acceptMavlink1}
            onValueChange={(val) => { dispatch(updateMavlinkSettings({ acceptMavlink1: val })); }}
            trackColor={{ false: '#333', true: '#0066cc' }}
          />
        </View>

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Accept MAVLink 2</Text>
            <Text style={styles.switchDesc}>Allow modern MAVLink 2 packets (Signed)</Text>
          </View>
          <Switch 
            value={mavlink.acceptMavlink2}
            onValueChange={(val) => { dispatch(updateMavlinkSettings({ acceptMavlink2: val })); }}
            trackColor={{ false: '#333', true: '#0066cc' }}
          />
        </View>

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>MAVLink Forwarding</Text>
            <Text style={styles.switchDesc}>Forward packets to other GCS connected to this device</Text>
          </View>
          <Switch 
            value={mavlink.forwardingEnabled}
            onValueChange={(val) => { dispatch(updateMavlinkSettings({ forwardingEnabled: val })); }}
            trackColor={{ false: '#333', true: '#0066cc' }}
          />
        </View>
      </View>

      <View style={styles.buttonRow}>
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 10,
  },
  switchLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchDesc: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 15,
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
