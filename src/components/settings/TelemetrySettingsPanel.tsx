import React from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectTelemetrySettings, updateTelemetrySettings } from '../../store/settings/settingsSlice';

export function TelemetrySettingsPanel() {
  const dispatch = useAppDispatch();
  const telemetry = useAppSelector(selectTelemetrySettings);

  const renderSlider = (label: string, value: number, field: keyof typeof telemetry, maxHz: number = 50) => {
    // A custom simple slider/button input for Update Rates
    return (
      <View style={styles.inputRow}>
        <Text style={styles.label}>{label} (Hz)</Text>
        <View style={styles.rateControl}>
          <TouchableOpacity 
            style={styles.rateBtn}
            onPress={() => dispatch(updateTelemetrySettings({ [field]: Math.max(1, value - 1) }))}
          >
            <Text style={styles.rateBtnText}>-</Text>
          </TouchableOpacity>
          <View style={styles.rateValueContainer}>
            <Text style={styles.rateValue}>{value} Hz</Text>
          </View>
          <TouchableOpacity 
            style={styles.rateBtn}
            onPress={() => dispatch(updateTelemetrySettings({ [field]: Math.min(maxHz, value + 1) }))}
          >
            <Text style={styles.rateBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>TELEMETRY SETTINGS</Text>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>DATA STREAM</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: '#0f0' }]} />
            <Text style={styles.statusText}>RECEIVING</Text>
          </View>
        </View>
        <Text style={styles.infoText}>Configure the update frequencies for different MAVLink data streams. Note: Higher rates consume more bandwidth.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stream Rates (MAVLink)</Text>
        
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            {renderSlider('Attitude (Roll/Pitch/Yaw)', telemetry.attitudeUpdateRateHz, 'attitudeUpdateRateHz')}
          </View>
          <View style={{ flex: 1 }}>
            {renderSlider('Position (GPS)', telemetry.positionUpdateRateHz, 'positionUpdateRateHz', 20)}
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            {renderSlider('Raw GPS Data', telemetry.gpsUpdateRateHz, 'gpsUpdateRateHz', 10)}
          </View>
          <View style={{ flex: 1 }}>
            {renderSlider('Battery Status', telemetry.batteryUpdateRateHz, 'batteryUpdateRateHz', 10)}
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            {renderSlider('System Status', telemetry.statusUpdateRateHz, 'statusUpdateRateHz', 10)}
          </View>
          <View style={{ flex: 1 }}>
            {/* Empty for layout balance */}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>UI Performance</Text>
        
        <View style={styles.inputRow}>
          <Text style={styles.label}>UI Refresh Rate (Max Hz)</Text>
          <Text style={styles.switchDesc}>Limit how fast the React Native UI updates to save battery and reduce stuttering.</Text>
          <View style={[styles.buttonGroup, { marginTop: 10 }]}>
            {[15, 30, 60].map((hz) => (
              <TouchableOpacity
                key={hz}
                style={[styles.groupButton, telemetry.uiRefreshRateHz === hz && styles.groupButtonActive]}
                onPress={() => dispatch(updateTelemetrySettings({ uiRefreshRateHz: hz }))}
              >
                <Text style={[styles.groupButtonText, telemetry.uiRefreshRateHz === hz && styles.groupButtonTextActive]}>
                  {hz} FPS
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>APPLY RATES</Text>
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
  buttonGroup: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  groupButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  groupButtonActive: {
    backgroundColor: '#0066cc',
  },
  groupButtonText: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
  },
  groupButtonTextActive: {
    color: '#fff',
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
    paddingBottom: 40,
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
