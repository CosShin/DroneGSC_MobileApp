import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '../../theme/gcsTheme';

export function VideoErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.container}>
    <MaterialCommunityIcons name="video-off-outline" size={34} color={colors.danger}/>
    <Text style={styles.title}>Video connection failed</Text>
    <Text style={styles.message}>{message}</Text>
    <TouchableOpacity style={styles.button} onPress={onRetry}><MaterialCommunityIcons name="refresh" size={15} color="#fff"/><Text style={styles.buttonText}>Retry</Text></TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: 3, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: colors.background },
  title: { marginTop: 7, color: colors.text, fontSize: 12, fontWeight: '900' },
  message: { maxWidth: 440, marginTop: 5, color: colors.textMuted, fontSize: 9, lineHeight: 14, textAlign: 'center' },
  button: { marginTop: 10, height: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.primary },
  buttonText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});
