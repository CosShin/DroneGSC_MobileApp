import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAppSelector } from '../../store/hooks';
import { selectVideoSettings } from '../../store/settings/settingsSlice';

export function VideoStream() {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoSettings = useAppSelector(selectVideoSettings);

  // Determine video URL source
  const videoSource = useMemo(() => {
    if (videoSettings.source === 'Disabled') return null;
    if (videoSettings.source === 'RTSP' && videoSettings.rtspUrl) {
      return videoSettings.rtspUrl;
    }
    if (videoSettings.source === 'UDP H.264') {
      return `udp://${videoSettings.udpListenAddress}:${videoSettings.udpPort}`;
    }
    if (videoSettings.source === 'MPEG-TS') {
      return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    }
    return null;
  }, [videoSettings]);

  const player = useVideoPlayer(videoSource || '', (p) => {
    if (!videoSource) return;
    p.loop = true;
    p.muted = true;
    try {
      p.play();
    } catch (e: any) {
      setHasError(true);
      setErrorMessage(e.message || 'Stream playback error');
    }
  });

  useEffect(() => {
    if (!player) return;
    const subPlaying = player.addListener('playingChange', (event) => {
      setIsPlaying(event.isPlaying);
      if (event.isPlaying) {
        setHasError(false);
        setErrorMessage(null);
      }
    });

    const subStatus = player.addListener('statusChange', (event) => {
      if (event.status === 'error') {
        setHasError(true);
        setErrorMessage(event.error?.message || 'Cannot connect to stream');
      }
    });

    return () => {
      subPlaying.remove();
      subStatus.remove();
    };
  }, [player]);

  if (videoSettings.source === 'Disabled' || !videoSource) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      <VideoView
        style={styles.video}
        player={player}
        nativeControls={false}
        contentFit="cover"
      />
      {/* Non-intrusive stream status pill when connecting or waiting for stream */}
      {!isPlaying && (
        <View style={styles.connectingPill}>
          <View style={[styles.statusDot, { backgroundColor: hasError ? '#ef4444' : '#f59e0b' }]} />
          <Text numberOfLines={1} style={styles.connectingText}>
            {hasError 
              ? `STREAM OFFLINE: ${videoSettings.source} (${errorMessage || 'Waiting for stream'})`
              : `CONNECTING ${videoSettings.source}...`
            }
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  connectingPill: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectingText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
