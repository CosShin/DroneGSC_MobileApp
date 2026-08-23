import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  selectConnectionConfig, 
  setConnectionType,
  setVehicleType,
  setAutopilotType,
  updateUdpSettings,
  updateTcpSettings,
  updateSerialSettings,
  updateBluetoothSettings
} from '../../store/settings/settingsSlice';
import { 
  selectConnectionStatus, 
  selectActivePortInfo,
  selectVehicleName,
  selectLatencyMs,
  selectPacketsPerSec,
  selectBytesReceived,
  setActiveConnectionInfo 
} from '../../store/connection/connectionSlice';
import { universalConnectionService } from '../../services/connection/UniversalConnectionService';
import { ConnectionType, VehicleType, AutopilotType } from '../../settings/types/connection';

export function ConnectionSettingsPanel() {
  const dispatch = useAppDispatch();
  const config = useAppSelector(selectConnectionConfig);
  const status = useAppSelector(selectConnectionStatus);
  const portInfo = useAppSelector(selectActivePortInfo);
  const vehicleName = useAppSelector(selectVehicleName);
  const latencyMs = useAppSelector(selectLatencyMs);
  const packetsPerSec = useAppSelector(selectPacketsPerSec);
  const bytesReceived = useAppSelector(selectBytesReceived);

  const isConnected = status === 'CONNECTED';
  const isConnecting = status === 'CONNECTING';

  const connectionTabs: { id: ConnectionType; label: string; icon: string }[] = [
    { id: 'UDP', label: 'UDP', icon: '📶' },
    { id: 'TCP', label: 'TCP', icon: '🌐' },
    { id: 'USB_SERIAL', label: 'USB OTG', icon: '🔌' },
    { id: 'BLUETOOTH', label: 'BLUETOOTH', icon: '📡' },
    { id: 'MOCK', label: 'SITL MOCK', icon: '🎮' },
  ];

  const vehicleTypes: { id: VehicleType; label: string; icon: string }[] = [
    { id: 'COPTER', label: 'Multirotor (Copter)', icon: '🚁' },
    { id: 'PLANE', label: 'Fixed Wing (Plane)', icon: '✈️' },
    { id: 'VTOL', label: 'VTOL QuadPlane', icon: '🛩️' },
    { id: 'ROVER', label: 'UGV / Boat (Rover)', icon: '🚜' },
    { id: 'SUB', label: 'Underwater Sub', icon: '🤿' },
  ];

  const autopilots: { id: AutopilotType; label: string }[] = [
    { id: 'ARDUPILOT', label: 'ArduPilot' },
    { id: 'PX4', label: 'PX4 Pro' },
    { id: 'INAV', label: 'INAV / MSP' },
  ];

  const baudRates = [9600, 19200, 38400, 57600, 115200, 500000, 921600];

  const handleConnect = () => {
    let portString = 'UDP: 14550';
    if (config.type === 'UDP') portString = `UDP: ${config.udp.remotePort}`;
    else if (config.type === 'TCP') portString = `TCP: ${config.tcp.host}:${config.tcp.port}`;
    else if (config.type === 'USB_SERIAL') portString = `USB: ${config.serial.baudRate} baud`;
    else if (config.type === 'BLUETOOTH') portString = `BLE: ${config.bluetooth.deviceName}`;
    else if (config.type === 'MOCK') portString = 'SITL VIRTUAL';

    dispatch(setActiveConnectionInfo({ type: config.type, portInfo: portString }));
    universalConnectionService.connect(config);
  };

  const handleDisconnect = () => {
    universalConnectionService.disconnect();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>UNIVERSAL DRONE CONNECTION</Text>

      {/* Real-time Status Card */}
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={styles.statusBadge}>
            <View style={[
              styles.statusDot, 
              { backgroundColor: isConnected ? '#22c55e' : isConnecting ? '#f59e0b' : '#ef4444' }
            ]} />
            <Text style={styles.statusText}>{status}</Text>
          </View>
          <Text style={styles.portInfo}>{portInfo}</Text>
          <Text style={styles.vehicleBadge}>{vehicleName}</Text>
        </View>
        <View style={styles.metricsRow}>
          <Text style={styles.metricText}>Latency: <Text style={styles.metricVal}>{latencyMs ?? '--'} ms</Text></Text>
          <Text style={styles.metricText}>Traffic: <Text style={styles.metricVal}>{packetsPerSec} pkt/s</Text></Text>
          <Text style={styles.metricText}>Data RX: <Text style={styles.metricVal}>{(bytesReceived / 1024).toFixed(1)} KB</Text></Text>
        </View>
      </View>

      {/* Protocol Tabs */}
      <View style={styles.tabsContainer}>
        {connectionTabs.map((tab) => {
          const isActive = config.type === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => dispatch(setConnectionType(tab.id))}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Protocol Config Body */}
      {config.type === 'UDP' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>UDP Network Parameters</Text>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Remote Host (Companion Computer / WiFi Telemetry IP)</Text>
            <TextInput 
              style={styles.input}
              value={config.udp.remoteHost}
              onChangeText={(text) => dispatch(updateUdpSettings({ remoteHost: text }))}
              placeholder="0.0.0.0 or 192.168.1.100"
              placeholderTextColor="#555"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputRow, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Remote Port</Text>
              <TextInput 
                style={styles.input}
                value={config.udp.remotePort.toString()}
                onChangeText={(text) => dispatch(updateUdpSettings({ remotePort: parseInt(text) || 14550 }))}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputRow, { flex: 1 }]}>
              <Text style={styles.label}>Local Listen Port</Text>
              <TextInput 
                style={styles.input}
                value={config.udp.localPort.toString()}
                onChangeText={(text) => dispatch(updateUdpSettings({ localPort: parseInt(text) || 14550 }))}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>
      )}

      {config.type === 'TCP' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TCP Client Parameters</Text>
          <View style={styles.inputRow}>
            <Text style={styles.label}>TCP Server Host (IP or Domain)</Text>
            <TextInput 
              style={styles.input}
              value={config.tcp.host}
              onChangeText={(text) => dispatch(updateTcpSettings({ host: text }))}
              placeholder="192.168.1.100"
              placeholderTextColor="#555"
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.label}>TCP Port</Text>
            <TextInput 
              style={styles.input}
              value={config.tcp.port.toString()}
              onChangeText={(text) => dispatch(updateTcpSettings({ port: parseInt(text) || 5760 }))}
              keyboardType="numeric"
            />
          </View>
        </View>
      )}

      {config.type === 'USB_SERIAL' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>USB OTG & Serial Telemetry</Text>
          <Text style={styles.label}>Baudrate</Text>
          <View style={styles.baudRow}>
            {baudRates.map((b) => (
              <TouchableOpacity
                key={b}
                style={[styles.baudBtn, config.serial.baudRate === b && styles.baudBtnActive]}
                onPress={() => dispatch(updateSerialSettings({ baudRate: b }))}
              >
                <Text style={[styles.baudBtnText, config.serial.baudRate === b && styles.baudBtnTextActive]}>
                  {b}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Device Port Path</Text>
            <TextInput 
              style={styles.input}
              value={config.serial.port}
              onChangeText={(text) => dispatch(updateSerialSettings({ port: text }))}
              placeholder="COM_USB_1 or /dev/ttyUSB0"
              placeholderTextColor="#555"
            />
          </View>
        </View>
      )}

      {config.type === 'BLUETOOTH' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bluetooth Wireless Telemetry</Text>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Device Name</Text>
            <TextInput 
              style={styles.input}
              value={config.bluetooth.deviceName}
              onChangeText={(text) => dispatch(updateBluetoothSettings({ deviceName: text }))}
              placeholder="HC-05-DRONE"
              placeholderTextColor="#555"
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.label}>MAC Address</Text>
            <TextInput 
              style={styles.input}
              value={config.bluetooth.deviceId}
              onChangeText={(text) => dispatch(updateBluetoothSettings({ deviceId: text }))}
              placeholder="00:14:03:05:5A:B1"
              placeholderTextColor="#555"
            />
          </View>
        </View>
      )}

      {config.type === 'MOCK' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SITL Virtual Flight Simulation</Text>
          <Text style={styles.mockInfo}>
            Chế độ mô phỏng bay ảo SITL (Software In The Loop) cung cấp đầy đủ thông số động học, GPS 3D Fix, EKF3, và cảm biến phụ trợ để thử nghiệm đầy đủ tính năng bay mà không cần thiết bị thật.
          </Text>
        </View>
      )}

      {/* Target Vehicle Profile */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Target Drone Type & Autopilot</Text>
        <View style={styles.vehicleGrid}>
          {vehicleTypes.map((v) => {
            const isActive = config.vehicleType === v.id;
            return (
              <TouchableOpacity
                key={v.id}
                style={[styles.vehicleCard, isActive && styles.vehicleCardActive]}
                onPress={() => dispatch(setVehicleType(v.id))}
              >
                <Text style={styles.vehicleCardIcon}>{v.icon}</Text>
                <Text style={[styles.vehicleCardLabel, isActive && styles.vehicleCardLabelActive]}>{v.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.autopilotGrid}>
          {autopilots.map((a) => {
            const isActive = config.autopilot === a.id;
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.autopilotCard, isActive && styles.autopilotCardActive]}
                onPress={() => dispatch(setAutopilotType(a.id))}
              >
                <Text style={[styles.autopilotCardLabel, isActive && styles.autopilotCardLabelActive]}>{a.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Connect / Disconnect Action Buttons */}
      <View style={styles.buttonRow}>
        {isConnected ? (
          <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
            <Text style={styles.actionButtonText}>🔴 DISCONNECT CURRENT DRONE</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryButton} onPress={handleConnect}>
            <Text style={styles.actionButtonText}>
              {isConnecting ? '⏳ CONNECTING...' : '🔌 CONNECT TO DRONE'}
            </Text>
          </TouchableOpacity>
        )}
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
    padding: 24,
    paddingBottom: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 1,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#0c121e',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginBottom: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  portInfo: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  vehicleBadge: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 8,
  },
  metricText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  metricVal: {
    color: '#fff',
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 10,
    borderRadius: 6,
  },
  tabBtnActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  tabIcon: {
    fontSize: 13,
  },
  tabLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tabLabelActive: {
    color: '#38bdf8',
  },
  section: {
    backgroundColor: '#0c121e',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#38bdf8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
  },
  inputRow: {
    marginBottom: 12,
  },
  label: {
    color: '#aaa',
    fontSize: 11,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#161d2b',
    borderWidth: 1,
    borderColor: '#333',
    color: '#fff',
    padding: 10,
    borderRadius: 6,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  baudRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  baudBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    backgroundColor: '#161d2b',
    borderWidth: 1,
    borderColor: '#333',
  },
  baudBtnActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
  },
  baudBtnText: {
    color: '#888',
    fontSize: 11,
    fontWeight: 'bold',
  },
  baudBtnTextActive: {
    color: '#38bdf8',
  },
  mockInfo: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  vehicleCard: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161d2b',
    borderWidth: 1,
    borderColor: '#333',
    padding: 10,
    borderRadius: 6,
  },
  vehicleCardActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  vehicleCardIcon: {
    fontSize: 16,
  },
  vehicleCardLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: 'bold',
  },
  vehicleCardLabelActive: {
    color: '#38bdf8',
  },
  autopilotGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  autopilotCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#161d2b',
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 8,
    borderRadius: 6,
  },
  autopilotCardActive: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  autopilotCardLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: 'bold',
  },
  autopilotCardLabelActive: {
    color: '#fbbf24',
  },
  buttonRow: {
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  disconnectButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.8,
  },
});
