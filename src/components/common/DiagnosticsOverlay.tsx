import React, { useEffect, useState } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAppSelector } from '../../store/hooks';
import { selectPacketsPerSec, selectBytesReceived, selectMavlinkState, selectConnectionStatus } from '../../store/connection/connectionSlice';
import { universalConnectionService } from '../../services/connection/UniversalConnectionService';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { glassShadow, layers, radius } from '../../theme/gcsTheme';

export function DiagnosticsOverlay() {
  const [visible, setVisible] = useState(false);
  const [lagMs, setLagMs] = useState(0);
  const [renderCount, setRenderCount] = useState(0);

  const pps = useAppSelector(selectPacketsPerSec);
  const bytesRx = useAppSelector(selectBytesReceived);
  const mavlinkState = useAppSelector(selectMavlinkState);
  const connectionStatus = useAppSelector(selectConnectionStatus);

  useEffect(() => {
    if (!visible) return;
    let last = typeof global.performance?.now === 'function' ? global.performance.now() : Date.now();
    const interval = setInterval(() => {
      const now = typeof global.performance?.now === 'function' ? global.performance.now() : Date.now();
      setLagMs(Math.max(0, Math.round(now - last - 500)));
      last = now;
      setRenderCount(c => c + 1);
    }, 500);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) {
    return (
      <TouchableOpacity 
        accessibilityLabel="Open diagnostics" 
        style={styles.miniBtn} 
        onPress={() => setVisible(true)}
      >
        <BlurView pointerEvents="none" tint="extraLight" intensity={64} experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
        <MaterialCommunityIcons name="bug-outline" size={15} color="#475569" />
      </TouchableOpacity>
    );
  }

  const diag = universalConnectionService.getDiagnostics();

  return (
    <View style={styles.container}>
      <BlurView pointerEvents="none" tint="extraLight" intensity={72} experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
      <View style={styles.headerRow}>
        <Text style={styles.title}>MAVLink Diagnostics</Text>
        <TouchableOpacity 
          accessibilityLabel="Close diagnostics" 
          style={styles.closeBtn} 
          onPress={() => setVisible(false)}
        >
          <MaterialCommunityIcons name="close" size={14} color="#64748B" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.row}><Text style={styles.label}>Transport:</Text><Text style={styles.val}>{connectionStatus}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Vehicle:</Text><Text style={styles.val}>{mavlinkState}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Traffic:</Text><Text style={styles.val}>{pps} pps | {(bytesRx / 1024).toFixed(1)} KB</Text></View>
      <View style={styles.row}><Text style={styles.label}>Event Loop Lag:</Text><Text style={[styles.val, lagMs > 100 && styles.warn]}>{lagMs} ms</Text></View>
      <View style={styles.row}><Text style={styles.label}>Parser CRC Err:</Text><Text style={styles.val}>{diag.parser.crcErrors}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Link:</Text><Text style={styles.val}>{diag.transport ? `${diag.transport.kind} ${diag.transport.status}` : '--'}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Reconnects:</Text><Text style={styles.val}>{diag.reconnectCount}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Signatures:</Text><Text style={styles.val}>{diag.parser.signaturesValid} valid / {diag.parser.signaturesInvalid} invalid</Text></View>
      <View style={styles.row}><Text style={styles.label}>Unsigned/Replay:</Text><Text style={styles.val}>{diag.parser.unsignedFramesRejected} / {diag.parser.signatureReplaysRejected}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Unsupported:</Text><Text style={styles.val}>{diag.parser.unsupportedFrames}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Discarded:</Text><Text style={styles.val}>{diag.parser.discardedBytes} B</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  miniBtn: {
    position: 'absolute',
    top: 152,
    left: 32,
    padding: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 999,
    overflow: 'hidden',
    zIndex: layers.panel,
    ...glassShadow,
  },
  container: {
    position: 'absolute',
    top: 152,
    left: 12,
    width: 215,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderColor: 'rgba(255, 255, 255, 0.80)',
    borderWidth: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: layers.panel,
    ...glassShadow,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  closeBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#2586EA',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3.5,
  },
  label: {
    color: '#475569',
    fontSize: 9.5,
    fontWeight: '700',
  },
  val: {
    color: '#0F172A',
    fontSize: 9.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  warn: {
    color: '#DC2626',
  },
});
