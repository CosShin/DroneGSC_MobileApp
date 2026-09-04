import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '../../theme/gcsTheme';
import { VideoUnavailableBackdrop } from './VideoUnavailableBackdrop';

export function VideoEmptyState({ title = 'Video not configured', message, actionLabel, onAction }: { title?: string; message: string; actionLabel?: string; onAction?: () => void }) {
  return <VideoUnavailableBackdrop>
    <MaterialCommunityIcons name="video-off-outline" size={34} color="#E2E8F0"/>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    {actionLabel && onAction ? <TouchableOpacity style={styles.button} onPress={onAction}><Text style={styles.buttonText}>{actionLabel}</Text></TouchableOpacity> : null}
  </VideoUnavailableBackdrop>;
}

const styles = StyleSheet.create({
  title: { marginTop: 7, color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  message: { maxWidth: 440, marginTop: 5, color: '#CBD5E1', fontSize: 9, lineHeight: 14, textAlign: 'center' },
  button: { marginTop: 10, height: 32, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.88)' },
  buttonText: { color: colors.primary, fontSize: 9, fontWeight: '900' },
});
