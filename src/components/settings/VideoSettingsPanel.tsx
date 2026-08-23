import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectVideoSettings, updateVideoSettings } from '../../store/settings/settingsSlice';

export function VideoSettingsPanel() {
  const dispatch = useAppDispatch();
  const video = useAppSelector(selectVideoSettings);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>VIDEO SETTINGS</Text>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>VIDEO STREAM</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: '#888' }]} />
            <Text style={styles.statusText}>OFFLINE</Text>
          </View>
        </View>
        <Text style={styles.infoText}>Current state of the video feed. Switch to Flight screen to connect.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Video Source</Text>
        
        <View style={styles.inputRow}>
          <Text style={styles.label}>Source Type</Text>
          <View style={styles.buttonGroup}>
            {[
              { id: 'Disabled', label: 'Disabled (HUD Horizon)' },
              { id: 'MPEG-TS', label: 'FPV Demo Stream' },
              { id: 'RTSP', label: 'RTSP Stream' },
              { id: 'UDP H.264', label: 'UDP H.264' }
            ].map((src) => (
              <TouchableOpacity
                key={src.id}
                style={[styles.groupButton, video.source === src.id && styles.groupButtonActive]}
                onPress={() => dispatch(updateVideoSettings({ source: src.id as any }))}
              >
                <Text numberOfLines={1} style={[styles.groupButtonText, video.source === src.id && styles.groupButtonTextActive]}>
                  {src.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {video.source === 'MPEG-TS' && (
          <View style={styles.card}>
            <Text style={styles.infoText}>
              🎥 Chế độ FPV Demo Stream: Tự động phát luồng video FPV máy bay mẫu Full HD trực tiếp làm nền cho màn hình HUD để bạn kiểm tra khả năng hiển thị đồng hồ đo độ cao, la bàn và chân trời trên nền video thực tế.
            </Text>
          </View>
        )}

        {video.source === 'UDP H.264' && (
          <View style={styles.row}>
            <View style={[styles.inputRow, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Listen Address</Text>
              <TextInput 
                style={styles.input}
                value={video.udpListenAddress}
                onChangeText={(text) => dispatch(updateVideoSettings({ udpListenAddress: text }))}
              />
            </View>
            <View style={[styles.inputRow, { flex: 1 }]}>
              <Text style={styles.label}>UDP Port</Text>
              <TextInput 
                style={styles.input}
                value={video.udpPort.toString()}
                onChangeText={(text) => dispatch(updateVideoSettings({ udpPort: parseInt(text) || 5600 }))}
                keyboardType="numeric"
              />
            </View>
          </View>
        )}

        {video.source === 'RTSP' && (
          <View style={styles.inputRow}>
            <Text style={styles.label}>RTSP Stream URL (Camera IP / Companion Pi / VLC)</Text>
            <TextInput 
              style={styles.input}
              value={video.rtspUrl}
              onChangeText={(text) => dispatch(updateVideoSettings({ rtspUrl: text }))}
              placeholder="rtsp://192.168.1.100:8554/live"
              placeholderTextColor="#555"
            />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quality & Performance</Text>
        
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Low Latency Mode</Text>
            <Text style={styles.switchDesc}>Reduce buffering to minimize glass-to-glass delay</Text>
          </View>
          <Switch 
            value={video.lowLatencyMode}
            onValueChange={(val) => { dispatch(updateVideoSettings({ lowLatencyMode: val })); }}
            trackColor={{ false: '#333', true: '#0066cc' }}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputRow, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>Resolution</Text>
            <View style={styles.buttonGroup}>
              {['Auto', '720p', '1080p'].map((res) => (
                <TouchableOpacity
                  key={res}
                  style={[styles.groupButton, video.resolution === res && styles.groupButtonActive]}
                  onPress={() => dispatch(updateVideoSettings({ resolution: res as any }))}
                >
                  <Text style={[styles.groupButtonText, video.resolution === res && styles.groupButtonTextActive]}>
                    {res}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputRow, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>Target FPS</Text>
            <View style={styles.buttonGroup}>
              {[15, 24, 30, 60].map((fps) => (
                <TouchableOpacity
                  key={fps}
                  style={[styles.groupButton, video.fps === fps && styles.groupButtonActive]}
                  onPress={() => dispatch(updateVideoSettings({ fps: fps as any }))}
                >
                  <Text style={[styles.groupButtonText, video.fps === fps && styles.groupButtonTextActive]}>
                    {fps}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recording (DVR)</Text>

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Enable Local Recording</Text>
            <Text style={styles.switchDesc}>Save video stream to device storage</Text>
          </View>
          <Switch 
            value={video.recordingEnabled}
            onValueChange={(val) => { dispatch(updateVideoSettings({ recordingEnabled: val })); }}
            trackColor={{ false: '#333', true: '#0066cc' }}
          />
        </View>

        {video.recordingEnabled && (
          <>
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Record When Armed</Text>
                <Text style={styles.switchDesc}>Auto-start recording when drone is ARMED</Text>
              </View>
              <Switch 
                value={video.recordWhenArmed}
                onValueChange={(val) => { dispatch(updateVideoSettings({ recordWhenArmed: val })); }}
                trackColor={{ false: '#333', true: '#0066cc' }}
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.inputRow, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>Max Storage Limit (GB)</Text>
                <TextInput 
                  style={styles.input}
                  value={video.maxStorageGb.toString()}
                  onChangeText={(text) => dispatch(updateVideoSettings({ maxStorageGb: parseFloat(text) || 10 }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputRow, { flex: 1 }]}>
                <Text style={styles.label}>Format</Text>
                <View style={styles.buttonGroup}>
                  {['MP4', 'MKV'].map((fmt) => (
                    <TouchableOpacity
                      key={fmt}
                      style={[styles.groupButton, video.format === fmt && styles.groupButtonActive]}
                      onPress={() => dispatch(updateVideoSettings({ format: fmt as any }))}
                    >
                      <Text style={[styles.groupButtonText, video.format === fmt && styles.groupButtonTextActive]}>
                        {fmt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
          <Text style={styles.primaryButtonText}>
            {saved ? '✓ SETTINGS SAVED' : 'SAVE SETTINGS'}
          </Text>
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
