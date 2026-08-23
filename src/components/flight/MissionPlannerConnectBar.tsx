import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  selectConnectionConfig, 
  setConnectionType,
  updateSerialSettings,
  updateUdpSettings,
  updateTcpSettings
} from '../../store/settings/settingsSlice';
import { 
  selectConnectionStatus, 
  setActiveConnectionInfo 
} from '../../store/connection/connectionSlice';
import { universalConnectionService } from '../../services/connection/UniversalConnectionService';
import { ConnectionType } from '../../settings/types/connection';

interface DropdownItem {
  id: string;
  label: string;
  type: ConnectionType;
  defaultBaudOrPort?: number;
}

export function MissionPlannerConnectBar() {
  const dispatch = useAppDispatch();
  const config = useAppSelector(selectConnectionConfig);
  const status = useAppSelector(selectConnectionStatus);

  const [showPortMenu, setShowPortMenu] = useState(false);
  const [showBaudMenu, setShowBaudMenu] = useState(false);

  const isConnected = status === 'CONNECTED';
  const isConnecting = status === 'CONNECTING';

  // Mission Planner Protocol / Port List
  const portOptions: DropdownItem[] = [
    { id: 'AUTO', label: 'AUTO', type: 'UDP', defaultBaudOrPort: 14550 },
    { id: 'COM_PIXHAWK', label: 'COM5 Pixhawk USB (OTG)', type: 'USB_SERIAL', defaultBaudOrPort: 115200 },
    { id: 'COM_RADIO', label: 'COM9 SiK Radio 433/915MHz', type: 'USB_SERIAL', defaultBaudOrPort: 57600 },
    { id: 'COM_BLE', label: 'COM4 Bluetooth Serial Link (BLE)', type: 'BLUETOOTH', defaultBaudOrPort: 57600 },
    { id: 'TCP', label: 'TCP (192.168.1.100:5760)', type: 'TCP', defaultBaudOrPort: 5760 },
    { id: 'UDP', label: 'UDP (14550 Broadcast)', type: 'UDP', defaultBaudOrPort: 14550 },
    { id: 'UDPCI', label: 'UDPCI (14551 Client)', type: 'UDP', defaultBaudOrPort: 14551 },
    { id: 'WS', label: 'WS (MAVLink WebSocket)', type: 'TCP', defaultBaudOrPort: 8080 },
    { id: 'SITL', label: 'SITL (Virtual Flight Simulation)', type: 'MOCK', defaultBaudOrPort: 5760 },
  ];

  // Baudrate & Port Options
  const baudOptions = [
    { label: '115200', value: 115200 },
    { label: '57600', value: 57600 },
    { label: '921600', value: 921600 },
    { label: '38400', value: 38400 },
    { label: '19200', value: 19200 },
    { label: '9600', value: 9600 },
    { label: '14550 (UDP)', value: 14550 },
    { label: '14551 (UDP)', value: 14551 },
    { label: '5760 (TCP)', value: 5760 },
  ];

  // Determine current active display labels
  const getCurrentPortLabel = () => {
    if (config.type === 'UDP') return config.udp.remotePort === 14551 ? 'UDPCI' : 'UDP';
    if (config.type === 'TCP') return 'TCP';
    if (config.type === 'USB_SERIAL') return config.serial.baudRate === 57600 ? 'COM9' : 'COM5';
    if (config.type === 'BLUETOOTH') return 'COM4 BLE';
    if (config.type === 'MOCK') return 'SITL';
    return 'UDP';
  };

  const getCurrentBaudLabel = () => {
    if (config.type === 'UDP') return `${config.udp.remotePort}`;
    if (config.type === 'TCP') return `${config.tcp.port}`;
    if (config.type === 'USB_SERIAL') return `${config.serial.baudRate}`;
    if (config.type === 'BLUETOOTH') return `${config.bluetooth.baudRate}`;
    return '115200';
  };

  const handleSelectPort = (item: DropdownItem) => {
    dispatch(setConnectionType(item.type));
    if (item.defaultBaudOrPort) {
      if (item.type === 'USB_SERIAL') dispatch(updateSerialSettings({ baudRate: item.defaultBaudOrPort }));
      if (item.type === 'UDP') dispatch(updateUdpSettings({ remotePort: item.defaultBaudOrPort, localPort: item.defaultBaudOrPort }));
      if (item.type === 'TCP') dispatch(updateTcpSettings({ port: item.defaultBaudOrPort }));
    }
    setShowPortMenu(false);
  };

  const handleSelectBaud = (value: number) => {
    if (config.type === 'USB_SERIAL') dispatch(updateSerialSettings({ baudRate: value }));
    else if (config.type === 'UDP') dispatch(updateUdpSettings({ remotePort: value, localPort: value }));
    else if (config.type === 'TCP') dispatch(updateTcpSettings({ port: value }));
    setShowBaudMenu(false);
  };

  const handleToggleConnect = () => {
    if (isConnected || isConnecting) {
      universalConnectionService.disconnect();
    } else {
      let portString = `${getCurrentPortLabel()}:${getCurrentBaudLabel()}`;
      dispatch(setActiveConnectionInfo({ type: config.type, portInfo: portString }));
      universalConnectionService.connect(config);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Port / Protocol Dropdown Trigger */}
      <TouchableOpacity 
        style={styles.dropdownBtn}
        onPress={() => {
          setShowBaudMenu(false);
          setShowPortMenu(!showPortMenu);
        }}
        activeOpacity={0.7}
      >
        <Text numberOfLines={1} style={styles.dropdownBtnText}>
          {getCurrentPortLabel()}
        </Text>
        <Text style={styles.arrowIcon}>▼</Text>
      </TouchableOpacity>

      {/* 2. Baud / Port Dropdown Trigger */}
      <TouchableOpacity 
        style={[styles.dropdownBtn, styles.baudBtn]}
        onPress={() => {
          setShowPortMenu(false);
          setShowBaudMenu(!showBaudMenu);
        }}
        activeOpacity={0.7}
      >
        <Text numberOfLines={1} style={styles.dropdownBtnText}>
          {getCurrentBaudLabel()}
        </Text>
        <Text style={styles.arrowIcon}>▼</Text>
      </TouchableOpacity>

      {/* 3. Mission Planner Connect / Disconnect Action Button */}
      <TouchableOpacity 
        style={[
          styles.connectBtn, 
          isConnected ? styles.connectBtnActive : styles.connectBtnIdle
        ]}
        onPress={handleToggleConnect}
        activeOpacity={0.7}
      >
        <View style={[
          styles.statusDot, 
          { backgroundColor: isConnected ? '#22c55e' : isConnecting ? '#f59e0b' : '#ef4444' }
        ]} />
        <Text style={[styles.connectText, isConnected ? styles.connectTextActive : styles.connectTextIdle]}>
          {isConnected ? 'DISCONNECT' : isConnecting ? 'CONNECTING...' : 'CONNECT'}
        </Text>
      </TouchableOpacity>

      {/* Pure JS Port Dropdown Menu Overlay (No Native iOS Modal) */}
      {showPortMenu && (
        <>
          <TouchableOpacity 
            style={styles.pureBackdrop}
            activeOpacity={1}
            onPress={() => setShowPortMenu(false)}
          />
          <View style={[styles.menuContainer, styles.portMenuPosition]}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuHeaderTitle}>SELECT MAVLINK PORT / PROTOCOL</Text>
            </View>
            <ScrollView style={styles.menuScroll} bounces={false}>
              {portOptions.map((opt) => {
                const isSelected = opt.type === config.type && (opt.id === 'UDP' || opt.id === 'AUTO' || opt.id === 'TCP' || opt.id === 'COM_PIXHAWK');
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.menuItem, isSelected && styles.menuItemActive]}
                    onPress={() => handleSelectPort(opt)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.menuItemText, isSelected && styles.menuItemTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}

      {/* Pure JS Baudrate Dropdown Menu Overlay (No Native iOS Modal) */}
      {showBaudMenu && (
        <>
          <TouchableOpacity 
            style={styles.pureBackdrop}
            activeOpacity={1}
            onPress={() => setShowBaudMenu(false)}
          />
          <View style={[styles.menuContainer, styles.baudMenuPosition]}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuHeaderTitle}>BAUDRATE / PORT</Text>
            </View>
            <ScrollView style={styles.menuScroll} bounces={false}>
              {baudOptions.map((b) => (
                <TouchableOpacity
                  key={b.label}
                  style={styles.menuItem}
                  onPress={() => handleSelectBaud(b.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuItemText}>{b.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 1000,
  },
  dropdownBtn: {
    height: 24,
    minWidth: 54,
    maxWidth: 72,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    borderRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  baudBtn: {
    minWidth: 58,
    maxWidth: 68,
  },
  dropdownBtnText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  arrowIcon: {
    color: '#94a3b8',
    fontSize: 7.5,
    marginLeft: 3,
  },
  connectBtn: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    borderRadius: 3,
    borderWidth: 1,
    gap: 3.5,
  },
  connectBtnIdle: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderColor: '#ef4444',
  },
  connectBtnActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: '#22c55e',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 2,
  },
  connectText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  connectTextIdle: {
    color: '#fca5a5',
  },
  connectTextActive: {
    color: '#4ade80',
  },
  pureBackdrop: {
    position: 'absolute',
    top: 0,
    left: -1000,
    right: -1000,
    height: 1200,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 900,
  },
  menuContainer: {
    position: 'absolute',
    top: 36,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 25,
    zIndex: 1000,
    overflow: 'hidden',
  },
  portMenuPosition: {
    right: 80,
    width: 260,
  },
  baudMenuPosition: {
    right: 40,
    width: 140,
  },
  menuHeader: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  menuHeaderTitle: {
    color: '#e2e8f0',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  menuScroll: {
    maxHeight: 220,
  },
  menuItem: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  menuItemActive: {
    backgroundColor: 'rgba(203, 213, 225, 0.18)',
  },
  menuItemText: {
    color: '#cbd5e1',
    fontSize: 10.5,
    fontWeight: '600',
  },
  menuItemTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
