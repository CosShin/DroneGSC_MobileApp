import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { selectDroneMode, selectIsArmed } from '../../store/drone/droneSlice';
import { selectMainViewMode, selectShowTelemetry, toggleMainViewMode, toggleTelemetry } from '../../store/settings/settingsSlice';
import { MissionPlannerConnectBar } from './MissionPlannerConnectBar';
import { safetyLayer } from '../../services/command/SafetyLayer';
import { FlightMode } from '../../types/command';

export function TopBar() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [showModeMenu, setShowModeMenu] = useState(false);

  const mode = useAppSelector(selectDroneMode);
  const isArmed = useAppSelector(selectIsArmed);
  const mainViewMode = useAppSelector(selectMainViewMode);
  const showTelemetry = useAppSelector(selectShowTelemetry);

  const availableModes: { id: FlightMode; label: string; desc: string }[] = [
    { id: FlightMode.LOITER, label: 'LOITER', desc: 'GPS Position & Altitude Hold' },
    { id: FlightMode.ALT_HOLD, label: 'ALT_HOLD', desc: 'Altitude Hold (Manual Pitch/Roll)' },
    { id: FlightMode.STABILIZE, label: 'STABILIZE', desc: 'Self-Leveling Manual Flight' },
    { id: FlightMode.POSHOLD, label: 'POSHOLD', desc: 'Position Hold with Stick Override' },
    { id: FlightMode.GUIDED, label: 'GUIDED', desc: 'Interactive Target Flight' },
    { id: FlightMode.AUTO, label: 'AUTO', desc: 'Waypoint Mission Autonomous' },
    { id: FlightMode.RTL, label: 'RTL', desc: 'Return To Launch & Land' },
    { id: FlightMode.LAND, label: 'LAND', desc: 'Vertical Auto Landing' },
  ];

  const handleSelectMode = (newMode: FlightMode) => {
    safetyLayer.executeCommand({
      type: 'SET_MODE',
      payload: { mode: newMode },
    });
    setShowModeMenu(false);
  };

  return (
    <View style={[
      styles.container,
      {
        paddingLeft: 28,
        paddingRight: 28,
      }
    ]}>
      {/* Left: Brand & Navigation/Tools */}
      <View style={styles.brandContainer}>
        <View style={styles.brandBadge}>
          <Text style={styles.brandPrefix}>ANITECH</Text>
          <Text style={styles.brandSuffix}>GCS</Text>
        </View>

        {/* View Mode Toggle Pill */}
        <TouchableOpacity 
          style={styles.viewToggleBtn} 
          onPress={() => dispatch(toggleMainViewMode())}
          activeOpacity={0.7}
        >
          <Text style={styles.viewToggleText}>
            {mainViewMode === 'MAP' ? 'HUD VIEW' : 'MAP VIEW'}
          </Text>
        </TouchableOpacity>

        {/* Telemetry/Commands Toggle Button */}
        <TouchableOpacity 
          style={[styles.toolBtn, showTelemetry && styles.toolBtnActive]} 
          onPress={() => dispatch(toggleTelemetry())}
          activeOpacity={0.7}
        >
          <Text style={[styles.toolBtnText, showTelemetry && styles.toolBtnTextActive]}>CMD</Text>
        </TouchableOpacity>
      </View>
      
      {/* Center: Flight Mode & Arm Status */}
      <View style={styles.statusGroup}>
        {/* Interactive Flight Mode Dropdown Pill */}
        <TouchableOpacity 
          style={[styles.pill, styles.pillMode]}
          onPress={() => setShowModeMenu(!showModeMenu)}
          activeOpacity={0.7}
        >
          <Text style={styles.pillLabel}>MODE</Text>
          <Text style={styles.modeText}>{mode || 'UNKNOWN'}</Text>
          <Text style={styles.dropdownArrow}>▾</Text>
        </TouchableOpacity>

        {/* Arm Status Pill */}
        <View style={[styles.pill, isArmed ? styles.pillArmed : styles.pillDisarmed]}>
          <Text style={[styles.armText, isArmed ? styles.armed : styles.disarmed]}>
            {isArmed ? 'ARMED' : 'DISARMED'}
          </Text>
        </View>
      </View>

      {/* Right: Mission Planner Quick Connect Dropdown Bar */}
      <View style={styles.rightGroup}>
        <MissionPlannerConnectBar />
      </View>

      {/* Pure JS Flight Mode Dropdown Menu (No Native iOS Modal = 0 Crashes) */}
      {showModeMenu && (
        <>
          <TouchableOpacity 
            style={styles.pureBackdrop}
            activeOpacity={1}
            onPress={() => setShowModeMenu(false)}
          />
          <View style={styles.modeMenuContainer}>
            <View style={styles.modeMenuHeader}>
              <Text style={styles.modeMenuHeaderTitle}>SELECT FLIGHT MODE</Text>
            </View>
            <ScrollView style={styles.modeMenuScroll} bounces={false}>
              {availableModes.map((item) => {
                const isActive = mode === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.modeMenuItem, isActive && styles.modeMenuItemActive]}
                    onPress={() => handleSelectMode(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modeItemLeft}>
                      <Text style={[styles.modeItemLabel, isActive && styles.modeItemLabelActive]}>
                        {item.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.modeItemDesc}>{item.desc}</Text>
                    </View>
                    {isActive && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 38,
    backgroundColor: 'rgba(10, 15, 26, 0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 1000,
    elevation: 1000,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  brandPrefix: {
    color: '#f59e0b',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.8,
    marginRight: 3,
  },
  brandSuffix: {
    color: '#38bdf8',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  viewToggleBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewToggleText: {
    color: '#38bdf8',
    fontWeight: '800',
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  toolBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: {
    borderColor: 'rgba(56, 189, 248, 0.5)',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  toolBtnText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94a3b8',
  },
  toolBtnTextActive: {
    color: '#38bdf8',
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pillMode: {
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  pillLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
    marginRight: 4,
  },
  modeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pillArmed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  pillDisarmed: {
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  armText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  armed: {
    color: '#f87171',
  },
  disarmed: {
    color: '#94a3b8',
  },
  dropdownArrow: {
    color: '#94a3b8',
    fontSize: 9,
    marginLeft: 3,
  },
  pureBackdrop: {
    position: 'absolute',
    top: 0,
    left: -500,
    right: -500,
    height: 1200,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 900,
  },
  modeMenuContainer: {
    position: 'absolute',
    top: 40,
    left: '40%',
    marginLeft: -110,
    width: 220,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 6,
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
  modeMenuHeader: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modeMenuHeaderTitle: {
    color: '#e2e8f0',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  modeMenuScroll: {
    maxHeight: 220,
  },
  modeMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modeMenuItemActive: {
    backgroundColor: 'rgba(203, 213, 225, 0.18)',
  },
  modeItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  modeItemLabel: {
    color: '#cbd5e1',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  modeItemLabelActive: {
    color: '#ffffff',
  },
  modeItemDesc: {
    color: '#94a3b8',
    fontSize: 8,
    marginTop: 1,
  },
  checkMark: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
