import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView } from 'react-native';
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
  selectLatencyMs,
  selectPacketsPerSec,
  selectBytesReceived,
  setActiveConnectionInfo 
} from '../../store/connection/connectionSlice';
import { universalConnectionService } from '../../services/connection/UniversalConnectionService';
import { ConnectionType, VehicleType, AutopilotType } from '../../settings/types/connection';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function QuickConnectModal({ visible, onClose }: Props) {
  const dispatch = useAppDispatch();
  const config = useAppSelector(selectConnectionConfig);
  const status = useAppSelector(selectConnectionStatus);
  const portInfo = useAppSelector(selectActivePortInfo);
  const latencyMs = useAppSelector(selectLatencyMs);
  const packetsPerSec = useAppSelector(selectPacketsPerSec);
  const bytesReceived = useAppSelector(selectBytesReceived);

  const isConnected = status === 'CONNECTED';
  const isConnecting = status === 'CONNECTING';

  const connectionTypes: { id: ConnectionType; label: string; icon: string; desc: string }[] = [
    { id: 'UDP', label: 'UDP', icon: '📶', desc: 'WiFi / Hotspot / Pi Gateway' },
    { id: 'TCP', label: 'TCP', icon: '🌐', desc: 'LAN / 4G VPN / Cloud Server' },
    { id: 'USB_SERIAL', label: 'USB SERIAL', icon: '🔌', desc: 'OTG Cable / SiK Radio Telemetry' },
    { id: 'BLUETOOTH', label: 'BLUETOOTH', icon: '📡', desc: 'HC-05 / HM-10 / ESP32 BLE' },
    { id: 'MOCK', label: 'SITL MOCK', icon: '🎮', desc: 'Virtual Simulated Drone' },
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
  const udpPorts = [14550, 14551, 14555, 14560];

  const handleToggleConnect = () => {
    if (isConnected || isConnecting) {
      universalConnectionService.disconnect();
      onClose();
    } else {
      let portString = 'UDP: 14550';
      if (config.type === 'UDP') portString = `UDP: ${config.udp.remotePort}`;
      else if (config.type === 'TCP') portString = `TCP: ${config.tcp.host}:${config.tcp.port}`;
      else if (config.type === 'USB_SERIAL') portString = `USB: ${config.serial.baudRate} baud`;
      else if (config.type === 'BLUETOOTH') portString = `BLE: ${config.bluetooth.deviceName}`;
      else if (config.type === 'MOCK') portString = `SITL: Virtual Simulation`;

      dispatch(setActiveConnectionInfo({ type: config.type, portInfo: portString }));
      universalConnectionService.connect(config);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.dialogContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerIcon}>🔌</Text>
              <View>
                <Text style={styles.title}>UNIVERSAL MAVLINK CONNECTION</Text>
                <Text style={styles.subtitle}>Mission Planner & QGC Multi-Vehicle Transport Manager</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Status Bar */}
            <View style={styles.statusCard}>
              <View style={styles.statusBadge}>
                <View style={[
                  styles.statusDot, 
                  { backgroundColor: isConnected ? '#22c55e' : isConnecting ? '#f59e0b' : '#ef4444' }
                ]} />
                <Text style={styles.statusText}>{status}</Text>
              </View>
              <Text style={styles.activePortText}>{portInfo}</Text>
              {isConnected && (
                <View style={styles.liveMetrics}>
                  <Text style={styles.metricItem}>⚡ {latencyMs ?? 12}ms</Text>
                  <Text style={styles.metricItem}>📦 {packetsPerSec} pkt/s</Text>
                  <Text style={styles.metricItem}>📥 {(bytesReceived / 1024).toFixed(1)} KB</Text>
                </View>
              )}
            </View>

            {/* 1. Transport Type Selector */}
            <Text style={styles.sectionTitle}>1. CONNECTION PROTOCOL</Text>
            <View style={styles.transportGrid}>
              {connectionTypes.map((t) => {
                const active = config.type === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.transportCard, active && styles.transportCardActive]}
                    onPress={() => dispatch(setConnectionType(t.id))}
                  >
                    <Text style={styles.transportIcon}>{t.icon}</Text>
                    <Text style={[styles.transportLabel, active && styles.transportLabelActive]}>{t.label}</Text>
                    <Text numberOfLines={1} style={styles.transportDesc}>{t.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 2. Parameters based on selected type */}
            <Text style={styles.sectionTitle}>2. PORT & HARDWARE PARAMETERS</Text>
            <View style={styles.paramsCard}>
              {config.type === 'UDP' && (
                <View>
                  <Text style={styles.fieldLabel}>Remote Host IP (Pi Gateway / Drone IP)</Text>
                  <TextInput
                    style={styles.input}
                    value={config.udp.remoteHost}
                    onChangeText={(text) => dispatch(updateUdpSettings({ remoteHost: text }))}
                    placeholder="0.0.0.0 or 192.168.1.100"
                    placeholderTextColor="#64748b"
                  />
                  <Text style={styles.fieldLabel}>Preset UDP Port (MAVLink Standard)</Text>
                  <View style={styles.presetRow}>
                    {udpPorts.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.presetBtn, config.udp.remotePort === p && styles.presetBtnActive]}
                        onPress={() => dispatch(updateUdpSettings({ remotePort: p, localPort: p }))}
                      >
                        <Text style={[styles.presetBtnText, config.udp.remotePort === p && styles.presetBtnTextActive]}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {config.type === 'TCP' && (
                <View>
                  <Text style={styles.fieldLabel}>TCP Target Host</Text>
                  <TextInput
                    style={styles.input}
                    value={config.tcp.host}
                    onChangeText={(text) => dispatch(updateTcpSettings({ host: text }))}
                    placeholder="192.168.1.100 or drone.local"
                    placeholderTextColor="#64748b"
                  />
                  <Text style={styles.fieldLabel}>TCP Port</Text>
                  <TextInput
                    style={styles.input}
                    value={config.tcp.port.toString()}
                    onChangeText={(text) => dispatch(updateTcpSettings({ port: parseInt(text) || 5760 }))}
                    keyboardType="numeric"
                    placeholder="5760"
                    placeholderTextColor="#64748b"
                  />
                </View>
              )}

              {config.type === 'USB_SERIAL' && (
                <View>
                  <Text style={styles.fieldLabel}>Select Serial Baudrate (bps)</Text>
                  <View style={styles.presetRow}>
                    {baudRates.map((b) => (
                      <TouchableOpacity
                        key={b}
                        style={[styles.presetBtn, config.serial.baudRate === b && styles.presetBtnActive]}
                        onPress={() => dispatch(updateSerialSettings({ baudRate: b }))}
                      >
                        <Text style={[styles.presetBtnText, config.serial.baudRate === b && styles.presetBtnTextActive]}>
                          {b}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.fieldLabel}>OTG Device Port</Text>
                  <TextInput
                    style={styles.input}
                    value={config.serial.port}
                    onChangeText={(text) => dispatch(updateSerialSettings({ port: text }))}
                    placeholder="COM_USB_1 / ttyUSB0"
                    placeholderTextColor="#64748b"
                  />
                </View>
              )}

              {config.type === 'BLUETOOTH' && (
                <View>
                  <Text style={styles.fieldLabel}>Bluetooth Telemetry Module Name</Text>
                  <TextInput
                    style={styles.input}
                    value={config.bluetooth.deviceName}
                    onChangeText={(text) => dispatch(updateBluetoothSettings({ deviceName: text }))}
                    placeholder="HC-05-DRONE"
                    placeholderTextColor="#64748b"
                  />
                  <Text style={styles.fieldLabel}>MAC Address / UUID</Text>
                  <TextInput
                    style={styles.input}
                    value={config.bluetooth.deviceId}
                    onChangeText={(text) => dispatch(updateBluetoothSettings({ deviceId: text }))}
                    placeholder="00:14:03:05:5A:B1"
                    placeholderTextColor="#64748b"
                  />
                </View>
              )}

              {config.type === 'MOCK' && (
                <View>
                  <Text style={styles.infoNote}>
                    💡 Chế độ bay ảo SITL (Software In The Loop) mô phỏng động cơ, cảm biến IMU/GPS và đường bay thực tế.
                  </Text>
                </View>
              )}
            </View>

            {/* 3. Vehicle & Autopilot Profile */}
            <Text style={styles.sectionTitle}>3. VEHICLE TYPE & AUTOPILOT STACK</Text>
            <View style={styles.profileRow}>
              {vehicleTypes.map((v) => {
                const active = config.vehicleType === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.vehicleBtn, active && styles.vehicleBtnActive]}
                    onPress={() => dispatch(setVehicleType(v.id))}
                  >
                    <Text style={styles.vehicleIcon}>{v.icon}</Text>
                    <Text style={[styles.vehicleText, active && styles.vehicleTextActive]}>{v.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.autopilotRow}>
              {autopilots.map((a) => {
                const active = config.autopilot === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.autopilotBtn, active && styles.autopilotBtnActive]}
                    onPress={() => dispatch(setAutopilotType(a.id))}
                  >
                    <Text style={[styles.autopilotText, active && styles.autopilotTextActive]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>CLOSE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionConnectBtn, isConnected && styles.actionDisconnectBtn]}
              onPress={handleToggleConnect}
            >
              <Text style={styles.actionBtnText}>
                {isConnected ? '🔴 DISCONNECT' : isConnecting ? '⏳ CONNECTING...' : '🔌 CONNECT NOW'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogContainer: {
    width: '94%',
    maxWidth: 680,
    maxHeight: '92%',
    backgroundColor: '#0c121e',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    overflow: 'hidden',
    shadowColor: '#00f0ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    fontSize: 22,
  },
  title: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
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
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: 'bold',
  },
  activePortText: {
    color: '#38bdf8',
    fontSize: 10.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  liveMetrics: {
    flexDirection: 'row',
    gap: 10,
  },
  metricItem: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  transportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  transportCard: {
    flex: 1,
    minWidth: 110,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  transportCardActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  transportIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  transportLabel: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  transportLabelActive: {
    color: '#38bdf8',
  },
  transportDesc: {
    color: '#64748b',
    fontSize: 7.5,
    marginTop: 2,
  },
  paramsCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#070a0f',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 6,
    color: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: '#070a0f',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderColor: '#38bdf8',
  },
  presetBtnText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  presetBtnTextActive: {
    color: '#38bdf8',
  },
  infoNote: {
    color: '#cbd5e1',
    fontSize: 10,
    lineHeight: 16,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  vehicleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    paddingVertical: 7,
  },
  vehicleBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
  vehicleIcon: {
    fontSize: 13,
  },
  vehicleText: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: 'bold',
  },
  vehicleTextActive: {
    color: '#38bdf8',
  },
  autopilotRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  autopilotBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    paddingVertical: 7,
  },
  autopilotBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#f59e0b',
  },
  autopilotText: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: 'bold',
  },
  autopilotTextActive: {
    color: '#fbbf24',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  actionConnectBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 6,
    shadowColor: '#38bdf8',
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  actionDisconnectBtn: {
    backgroundColor: '#dc2626',
    shadowColor: '#ef4444',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
