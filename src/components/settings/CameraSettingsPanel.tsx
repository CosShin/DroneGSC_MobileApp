import React from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectCameraSettings, updateCameraSettings } from '../../store/settings/settingsSlice';

export function CameraSettingsPanel() {
  const dispatch = useAppDispatch();
  const camera = useAppSelector(selectCameraSettings);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>CAMERA SETTINGS</Text>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>CAMERA LINK</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: camera.cameraType === 'None' ? '#888' : '#0f0' }]} />
            <Text style={styles.statusText}>{camera.cameraType === 'None' ? 'DISCONNECTED' : 'ONLINE'}</Text>
          </View>
        </View>
        <Text style={styles.infoText}>Current state of the optical payload.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payload Configuration</Text>
        
        <View style={styles.inputRow}>
          <Text style={styles.label}>Camera Interface</Text>
          <View style={styles.buttonGroup}>
            {['None', 'MAVLink Camera', 'Pi Camera API'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.groupButton, camera.cameraType === type && styles.groupButtonActive]}
                onPress={() => dispatch(updateCameraSettings({ cameraType: type as any }))}
              >
                <Text style={[styles.groupButtonText, camera.cameraType === type && styles.groupButtonTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.label}>Payload Name</Text>
          <TextInput 
            style={styles.input}
            value={camera.cameraName}
            onChangeText={(text) => dispatch(updateCameraSettings({ cameraName: text }))}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shooting Modes</Text>
        
        <View style={styles.row}>
          <View style={[styles.inputRow, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>Video Format</Text>
            <View style={styles.buttonGroup}>
              {['1080p30', '1080p60', '4K30'].map((fmt) => (
                <TouchableOpacity
                  key={fmt}
                  style={[styles.groupButton, camera.videoMode === fmt && styles.groupButtonActive]}
                  onPress={() => dispatch(updateCameraSettings({ videoMode: fmt as any }))}
                >
                  <Text style={[styles.groupButtonText, camera.videoMode === fmt && styles.groupButtonTextActive]}>
                    {fmt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputRow, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>Photo Mode</Text>
            <View style={styles.buttonGroup}>
              {['Single', 'Time-lapse', 'Burst'].map((fmt) => (
                <TouchableOpacity
                  key={fmt}
                  style={[styles.groupButton, camera.photoMode === fmt && styles.groupButtonActive]}
                  onPress={() => dispatch(updateCameraSettings({ photoMode: fmt as any }))}
                >
                  <Text style={[styles.groupButtonText, camera.photoMode === fmt && styles.groupButtonTextActive]}>
                    {fmt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Optical & Exposure</Text>

        <View style={styles.row}>
          <View style={[styles.inputRow, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>Exposure Mode</Text>
            <View style={styles.buttonGroup}>
              {['Auto', 'Manual', 'Shutter Priority'].map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.groupButton, camera.exposureMode === mode && styles.groupButtonActive]}
                  onPress={() => dispatch(updateCameraSettings({ exposureMode: mode as any }))}
                >
                  <Text style={[styles.groupButtonText, camera.exposureMode === mode && styles.groupButtonTextActive]}>
                    {mode}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputRow, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>ISO</Text>
            <View style={styles.buttonGroup}>
              {['Auto', '100', '200', '400', '800'].map((iso) => (
                <TouchableOpacity
                  key={iso}
                  style={[styles.groupButton, camera.iso === iso && styles.groupButtonActive]}
                  onPress={() => dispatch(updateCameraSettings({ iso: iso as any }))}
                >
                  <Text style={[styles.groupButtonText, camera.iso === iso && styles.groupButtonTextActive]}>
                    {iso}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>SEND TO CAMERA</Text>
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
