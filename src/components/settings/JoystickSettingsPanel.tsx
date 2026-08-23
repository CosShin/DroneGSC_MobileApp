import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectJoystickSettings, updateJoystickSettings, selectShowJoysticks, setShowJoysticks } from '../../store/settings/settingsSlice';

export function JoystickSettingsPanel() {
  const dispatch = useAppDispatch();
  const joystick = useAppSelector(selectJoystickSettings);
  const showJoysticks = useAppSelector(selectShowJoysticks);
  const [showWizard, setShowWizard] = useState(false);

  const renderSlider = (label: string, value: number, field: keyof typeof joystick, min: number, max: number, step: number) => {
    return (
      <View style={styles.inputRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.rateControl}>
          <TouchableOpacity 
            style={styles.rateBtn}
            onPress={() => dispatch(updateJoystickSettings({ [field]: Math.max(min, parseFloat((value - step).toFixed(2))) }))}
          >
            <Text style={styles.rateBtnText}>-</Text>
          </TouchableOpacity>
          <View style={styles.rateValueContainer}>
            <Text style={styles.rateValue}>{value.toFixed(2)}</Text>
          </View>
          <TouchableOpacity 
            style={styles.rateBtn}
            onPress={() => dispatch(updateJoystickSettings({ [field]: Math.min(max, parseFloat((value + step).toFixed(2))) }))}
          >
            <Text style={styles.rateBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (showWizard) {
    return (
      <View style={styles.wizardContainer}>
        <Text style={styles.title}>JOYSTICK CALIBRATION WIZARD</Text>
        <View style={styles.wizardCard}>
          <Text style={styles.wizardStep}>STEP 1: Release both sticks to neutral position.</Text>
          <View style={styles.wizardVisual}>
            <View style={styles.stickPlaceholder}><Text style={styles.stickText}>LEFT</Text></View>
            <View style={styles.stickPlaceholder}><Text style={styles.stickText}>RIGHT</Text></View>
          </View>
          <Text style={styles.liveData}>RAW: 0.00, 0.00 | OUTPUT: 0.00, 0.00</Text>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowWizard(false)}>
            <Text style={styles.secondaryButtonText}>CANCEL</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setShowWizard(false)}>
            <Text style={styles.primaryButtonText}>NEXT STEP</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>JOYSTICK SETTINGS</Text>

      {/* On-Screen Virtual Joysticks Display Toggle */}
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>On-Screen Virtual Joysticks</Text>
            <Text style={styles.toggleSubtitle}>
              Display touch joysticks (Throttle/Yaw on Left, Pitch/Roll on Right) on the flight screen.
            </Text>
          </View>
          <Switch 
            value={showJoysticks}
            onValueChange={(val) => { dispatch(setShowJoysticks(val)); }}
            trackColor={{ false: '#334155', true: '#0284c7' }}
            thumbColor={showJoysticks ? '#38bdf8' : '#94a3b8'}
          />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>JOYSTICK STATUS</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: showJoysticks ? '#0f0' : '#888' }]} />
            <Text style={styles.statusText}>{showJoysticks ? 'ENABLED' : 'DISABLED'}</Text>
          </View>
        </View>
        <Text style={styles.infoText}>LEFT: Throttle / Yaw | RIGHT: Pitch / Roll</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Input Response Curves</Text>
        
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            {renderSlider('Deadzone (0.0 - 0.5)', joystick.deadzone, 'deadzone', 0.0, 0.5, 0.05)}
            <Text style={styles.helperText}>Ignores small inputs near center.</Text>
          </View>
          <View style={{ flex: 1 }}>
            {renderSlider('Exponential Curve (0.0 - 1.0)', joystick.expo, 'expo', 0.0, 1.0, 0.1)}
            <Text style={styles.helperText}>Flattens center response for precision.</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            {renderSlider('Sensitivity (0.1 - 2.0)', joystick.sensitivity, 'sensitivity', 0.1, 2.0, 0.1)}
            <Text style={styles.helperText}>Multiplier for overall input.</Text>
          </View>
          <View style={{ flex: 1 }}>
            {renderSlider('Max Output (0.1 - 1.0)', joystick.maxOutput, 'maxOutput', 0.1, 1.0, 0.05)}
            <Text style={styles.helperText}>Caps the maximum control surface throw.</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Network Rate</Text>
        <View style={{ width: '50%' }}>
          {renderSlider('Command Update Rate (Hz)', joystick.updateRateHz, 'updateRateHz', 1, 50, 5)}
        </View>
        <Text style={[styles.helperText, { marginTop: 10 }]}>Rate at which joystick commands are sent to the drone. Warning: High rates increase MAVLink congestion.</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#f90' }]}>Safety Constraints</Text>
        <View style={styles.safetyBox}>
          <Text style={styles.safetyText}>• Auto Center: FORCED ENABLED</Text>
          <Text style={styles.safetyText}>• Disconnect Timeout: FORCED ENABLED</Text>
          <Text style={styles.safetyText}>• SafetyLayer Verification: FORCED ENABLED</Text>
          <Text style={styles.safetyDesc}>These critical settings cannot be disabled in the Mobile GCS to comply with safety regulations.</Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowWizard(true)}>
          <Text style={styles.secondaryButtonText}>CALIBRATE JOYSTICKS</Text>
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
  wizardContainer: {
    flex: 1,
    backgroundColor: '#050505',
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  card: {
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
  },
  toggleTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  toggleSubtitle: {
    color: '#888',
    fontSize: 12,
    lineHeight: 16,
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
    marginBottom: 10,
  },
  inputRow: {
    marginBottom: 5,
  },
  label: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  helperText: {
    color: '#555',
    fontSize: 11,
    marginTop: 2,
  },
  rateControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  rateBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#222',
  },
  rateBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  rateValueContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateValue: {
    color: '#00aaff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  safetyBox: {
    backgroundColor: '#1a1a00',
    borderWidth: 1,
    borderColor: '#664400',
    padding: 15,
    borderRadius: 6,
  },
  safetyText: {
    color: '#f90',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  safetyDesc: {
    color: '#aa8800',
    fontSize: 12,
    marginTop: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 15,
    paddingBottom: 40,
    width: '100%',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#444',
  },
  secondaryButtonText: {
    color: '#aaa',
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
  wizardCard: {
    width: 500,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    padding: 30,
    alignItems: 'center',
    marginBottom: 30,
  },
  wizardStep: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  wizardVisual: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 30,
  },
  stickPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#222',
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickText: {
    color: '#555',
    fontWeight: 'bold',
  },
  liveData: {
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: 14,
  }
});
