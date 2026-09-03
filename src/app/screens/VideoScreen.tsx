import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { VideoStream } from '../../components/video/VideoStream';
import { VideoTelemetryOverlay } from '../../components/video/VideoTelemetryOverlay';

export function VideoScreen() {
  const navigation = useNavigation<any>();
  const focused = useIsFocused();
  const [playerKey, setPlayerKey] = React.useState(0);
  return <View style={styles.screen}>
    <VideoStream key={playerKey} enabled={focused} fullscreenButton={false}/>
    <VideoTelemetryOverlay/>
    <View style={styles.actions}>
      <Action icon="arrow-left" label="Back" onPress={() => navigation.goBack()}/>
      <Action icon="refresh" label="Reconnect" onPress={() => setPlayerKey(value => value + 1)}/>
      <Action icon="cog-outline" label="Settings" onPress={() => navigation.navigate('Settings')}/>
    </View>
  </View>;
}
function Action({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.action} onPress={onPress}><MaterialCommunityIcons name={icon} size={17} color="#fff"/><Text style={styles.actionText}>{label}</Text></TouchableOpacity>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07111f' },
  actions: { position: 'absolute', zIndex: 6, top: 10, right: 10, flexDirection: 'row', gap: 6 },
  action: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 7, backgroundColor: 'rgba(15,23,42,.82)' },
  actionText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});
