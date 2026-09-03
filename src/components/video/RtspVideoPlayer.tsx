import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { VLCPlayer } from 'react-native-vlc-media-player';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectVideoSettings } from '../../store/settings/settingsSlice';
import { setVideoSource, setVideoStatus, videoFailed, videoPlaying } from '../../store/videoSlice';
import { validateRtspUrl } from '../../video/VideoSourceResolver';
import { VideoErrorState } from './VideoErrorState';

export const RtspVideoPlayer = React.memo(function RtspVideoPlayer({
  enabled = true,
  publishGlobalRuntime = false,
  onOpenFullscreen,
}: {
  enabled?: boolean;
  publishGlobalRuntime?: boolean;
  onOpenFullscreen?: () => void;
}) {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectVideoSettings);
  const resolved = React.useMemo(() => {
    try {
      return { url: validateRtspUrl(settings.rtspUrl), error: null };
    } catch (error) {
      return { url: null, error: error instanceof Error ? error.message : 'Invalid RTSP URL.' };
    }
  }, [settings.rtspUrl]);

  React.useEffect(() => {
    if (!publishGlobalRuntime) return;
    dispatch(setVideoSource(resolved.url));
    dispatch(setVideoStatus(enabled && resolved.url ? 'CONNECTING' : 'OFFLINE'));
    return () => { dispatch(setVideoStatus('OFFLINE')); };
  }, [dispatch, enabled, publishGlobalRuntime, resolved.url]);

  if (!enabled) return null;
  if (resolved.error || !resolved.url) {
    return <VideoErrorState
      message={resolved.error ?? 'RTSP URL is unavailable.'}
      onRetry={() => publishGlobalRuntime && dispatch(setVideoStatus('CONNECTING'))}
    />;
  }

  return <View style={styles.container}>
    <VLCPlayer
      style={styles.player}
      source={{ uri: resolved.url }}
      autoplay
      muted={settings.muted}
      onPlaying={() => { if (publishGlobalRuntime) dispatch(videoPlaying()); }}
      onBuffering={() => { if (publishGlobalRuntime) dispatch(setVideoStatus('CONNECTING')); }}
      onError={() => { if (publishGlobalRuntime) dispatch(videoFailed('RTSP playback failed. Check the camera URL, codec, network route, and native VLC build.')); }}
    />
    {onOpenFullscreen ? <TouchableOpacity accessibilityLabel="Open fullscreen video" style={styles.fullscreen} onPress={onOpenFullscreen}><MaterialCommunityIcons name="fullscreen" size={22} color="#fff"/></TouchableOpacity> : null}
  </View>;
});

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: '#07111f' },
  player: { flex: 1 },
  fullscreen: { position: 'absolute', right: 10, bottom: 10, zIndex: 5, width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,.78)' },
});
