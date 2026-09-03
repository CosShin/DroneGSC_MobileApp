/** Development-build-only legacy UDP/H.264 player. This module is intentionally absent from the Expo Go import path. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';
import { colors } from '../../theme/gcsTheme';

export function NativeUdpVideoPlayer({ port, lowLatency = true }: { port: number; lowLatency?: boolean }) {
  const playerRef = React.useRef<any>(null);
  const [status, setStatus] = React.useState('Waiting for RTP/H.264 packets');
  const source = React.useMemo(() => ({
    uri: `rtp://@:${port}`,
    initType: 2,
    initOptions: [
      `--network-caching=${lowLatency ? 0 : 300}`,
      `--live-caching=${lowLatency ? 0 : 300}`,
      '--clock-jitter=0', '--clock-synchro=0', '--drop-late-frames', '--skip-frames', '--no-audio',
    ],
    mediaOptions: [':demux=h264', ':no-audio', ':no-video-title-show'],
  }), [lowLatency, port]);

  React.useEffect(() => () => {
    try { playerRef.current?.stopPlayer?.(); } catch { /* native teardown is best-effort */ }
  }, []);

  return <View style={styles.container}>
    <VLCPlayer ref={playerRef} style={StyleSheet.absoluteFill} source={source as any} autoplay paused={false} muted autoAspectRatio resizeMode="cover" playInBackground={false} onPlaying={() => setStatus('LIVE · UDP H.264')} onBuffering={() => setStatus('Buffering RTP/H.264')} onError={() => setStatus(`Cannot decode RTP/H.264 on UDP ${port}`)}/>
    <Text style={styles.status}>{status}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  status: { position: 'absolute', top: 10, left: 10, color: colors.surface, fontSize: 9, fontWeight: '900', backgroundColor: 'rgba(15,23,42,.8)', padding: 7, borderRadius: 6 },
});
