import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { ConnectionSettingsPanel } from '../../components/settings/ConnectionSettingsPanel';
import { MavlinkSettingsPanel } from '../../components/settings/MavlinkSettingsPanel';
import { PiGatewaySettingsPanel } from '../../components/settings/PiGatewaySettingsPanel';
import { VideoSettingsPanel } from '../../components/settings/VideoSettingsPanel';
import { CameraSettingsPanel } from '../../components/settings/CameraSettingsPanel';
import { TelemetrySettingsPanel } from '../../components/settings/TelemetrySettingsPanel';
import { JoystickSettingsPanel } from '../../components/settings/JoystickSettingsPanel';

type SettingsTab = 'CONNECTION' | 'MAVLINK' | 'PI_GATEWAY' | 'VIDEO' | 'CAMERA' | 'TELEMETRY' | 'JOYSTICK' | 'MAP' | 'MISSION' | 'SAFETY' | 'LOGGING' | 'DIAGNOSTICS' | 'SYSTEM';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'CONNECTION', label: 'CONNECTION' },
  { id: 'MAVLINK', label: 'MAVLINK' },
  { id: 'PI_GATEWAY', label: 'PI GATEWAY' },
  { id: 'VIDEO', label: 'VIDEO' },
  { id: 'CAMERA', label: 'CAMERA' },
  { id: 'TELEMETRY', label: 'TELEMETRY' },
  { id: 'JOYSTICK', label: 'JOYSTICK' },
  { id: 'MAP', label: 'MAP' },
  { id: 'MISSION', label: 'MISSION' },
  { id: 'SAFETY', label: 'SAFETY' },
  { id: 'LOGGING', label: 'LOGGING' },
  { id: 'DIAGNOSTICS', label: 'DIAGNOSTICS' },
  { id: 'SYSTEM', label: 'SYSTEM' },
];

export function SettingsScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('CONNECTION');

  const renderContent = () => {
    switch (activeTab) {
      case 'CONNECTION':
        return <ConnectionSettingsPanel />;
      case 'MAVLINK':
        return <MavlinkSettingsPanel />;
      case 'PI_GATEWAY':
        return <PiGatewaySettingsPanel />;
      case 'VIDEO':
        return <VideoSettingsPanel />;
      case 'CAMERA':
        return <CameraSettingsPanel />;
      case 'TELEMETRY':
        return <TelemetrySettingsPanel />;
      case 'JOYSTICK':
        return <JoystickSettingsPanel />;
      default:
        return (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>{activeTab} SETTINGS</Text>
            <Text style={styles.placeholderSub}>This module is currently under construction.</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar hidden />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ANITECH GCS SETTINGS</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
          {TABS.map((tab) => (
            <TouchableOpacity 
              key={tab.id}
              style={[styles.sidebarItem, activeTab === tab.id && styles.sidebarItemActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[styles.sidebarItemText, activeTab === tab.id && styles.sidebarItemTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {renderContent()}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#222',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 220,
    backgroundColor: '#0a0a0a',
    borderRightWidth: 1,
    borderRightColor: '#222',
    paddingTop: 10,
  },
  sidebarItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  sidebarItemActive: {
    backgroundColor: '#1a1a1a',
    borderLeftColor: '#00aaff',
  },
  sidebarItemText: {
    color: '#888',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sidebarItemTextActive: {
    color: '#00aaff',
  },
  content: {
    flex: 1,
    backgroundColor: '#050505',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#444',
    fontSize: 24,
    fontWeight: 'bold',
  },
  placeholderSub: {
    color: '#333',
    marginTop: 10,
  },
});
