import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { VideoStatus } from '../../video/VideoTypes';

export function VideoStatusOverlay({ status, playerPageLoaded }: { status: VideoStatus; playerPageLoaded: boolean }) {
  if (status === 'LIVE') {
    return <View style={styles.badge}><View style={[styles.dot, styles.live]} /><Text style={styles.text}>LIVE</Text><Text style={styles.secondary}>WebRTC</Text></View>;
  }
  if (status === 'CONNECTING' || status === 'RECONNECTING') {
    return <View style={styles.badge}><ActivityIndicator size="small" color="#f59e0b"/><Text style={styles.text}>{playerPageLoaded ? 'PLAYER READY' : status}</Text><Text style={styles.secondary}>WebRTC</Text></View>;
  }
  return null;
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: 10, left: 10, zIndex: 4, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: 'rgba(15,23,42,.82)' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  live: { backgroundColor: '#22c55e' },
  text: { color: '#fff', fontSize: 9, fontWeight: '900' },
  secondary: { color: '#94a3b8', fontSize: 8, fontWeight: '800' },
});
