import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '../../theme/gcsTheme';
import { VideoUnavailableBackdrop } from './VideoUnavailableBackdrop';

export function VideoErrorState({
  message,
  onRetry,
  connecting = false,
}: {
  message: string;
  onRetry?: () => void;
  connecting?: boolean;
}) {
  return <VideoUnavailableBackdrop absolute>
    {connecting
      ? <ActivityIndicator size="small" color="#E2E8F0" />
      : <MaterialCommunityIcons name="video-off-outline" size={34} color="#E2E8F0"/>}
    <Text style={styles.title}>{connecting ? 'Video connecting' : 'Video disconnected'}</Text>
    <Text style={styles.message}>{message}</Text>
    {onRetry ? <TouchableOpacity style={styles.button} onPress={onRetry}><MaterialCommunityIcons name="refresh" size={15} color="#fff"/><Text style={styles.buttonText}>Retry</Text></TouchableOpacity> : null}
  </VideoUnavailableBackdrop>;
}

const styles = StyleSheet.create({
  title: { marginTop: 7, color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  message: { maxWidth: 440, marginTop: 5, color: '#CBD5E1', fontSize: 9, lineHeight: 14, textAlign: 'center' },
  button: { marginTop: 10, height: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.primary },
  buttonText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});
