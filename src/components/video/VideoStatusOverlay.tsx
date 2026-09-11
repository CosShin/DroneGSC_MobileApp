import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { VideoStatus } from '../../video/VideoTypes';
import { useVideoQualityPolicy } from '../../hooks/useVideoQualityPolicy';

export function VideoStatusOverlay({ status, playerPageLoaded }: { status: VideoStatus; playerPageLoaded: boolean }) {
  const { policy, isDegraded, isSuspended } = useVideoQualityPolicy();

  if (status === 'LIVE') {
    if (isSuspended) {
      return (
        <View style={styles.badge}>
          <View style={[styles.dot, styles.critical]} />
          <Text style={styles.text}>VIDEO SUSPENDED</Text>
          <Text style={styles.secondary}>LINK CRITICAL</Text>
        </View>
      );
    }
    const dotStyle = isDegraded ? styles.degraded : styles.live;
    const policyLabel = policy !== 'NORMAL' ? ` · ${policy}` : '';
    return (
      <View style={styles.badge}>
        <View style={[styles.dot, dotStyle]} />
        <Text style={styles.text}>LIVE{policyLabel}</Text>
        <Text style={styles.secondary}>WebRTC</Text>
      </View>
    );
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
  degraded: { backgroundColor: '#eab308' },
  critical: { backgroundColor: '#dc2626' },
  text: { color: '#fff', fontSize: 9, fontWeight: '900' },
  secondary: { color: '#94a3b8', fontSize: 8, fontWeight: '800' },
});
