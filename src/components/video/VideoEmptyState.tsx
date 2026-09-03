import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '../../theme/gcsTheme';

export function VideoEmptyState({ title = 'Video not configured', message, actionLabel, onAction }: { title?: string; message: string; actionLabel?: string; onAction?: () => void }) {
  return <View style={styles.container}>
    <MaterialCommunityIcons name="video-off-outline" size={34} color={colors.textDim}/>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    {actionLabel && onAction ? <TouchableOpacity style={styles.button} onPress={onAction}><Text style={styles.buttonText}>{actionLabel}</Text></TouchableOpacity> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 100, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: colors.background },
  title: { marginTop: 7, color: colors.text, fontSize: 12, fontWeight: '900' },
  message: { maxWidth: 440, marginTop: 5, color: colors.textMuted, fontSize: 9, lineHeight: 14, textAlign: 'center' },
  button: { marginTop: 10, height: 32, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.primaryMuted },
  buttonText: { color: colors.primary, fontSize: 9, fontWeight: '900' },
});
