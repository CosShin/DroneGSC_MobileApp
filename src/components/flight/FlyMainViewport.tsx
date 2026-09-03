import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FlyInstrumentView } from './FlyInstrumentView';
import { FlyVideoView } from './FlyVideoView';
import { FlyMapView } from './FlyMapView';
import { layers } from '../../theme/gcsTheme';
import { useAppSelector } from '../../store/hooks';
import { selectVideoSettings } from '../../store/settings/settingsSlice';
import { selectVideoRuntime } from '../../store/videoSlice';
import type { FlightDisplayMode } from '../../video/FlightDisplayState';

interface Props {
  primaryView: 'FLIGHT' | 'MAP';
  displayMode?: FlightDisplayMode;
}

/**
 * Adaptive Flight View:
 * - If in FLIGHT view:
 *   - Video is live -> displays live video!
 *   - No video or video offline -> displays flight instruments / HUD!
 * - If in MAP view: displays the full interactive map.
 */
export const FlyMainViewport = React.memo(function FlyMainViewport({
  primaryView,
  displayMode,
}: Props) {
  const video = useAppSelector(selectVideoSettings);
  const runtime = useAppSelector(selectVideoRuntime);
  const videoConfigured = video.transport === 'WEBRTC' && video.host.trim().length > 0;

  // Adaptive switching: video if available & live, otherwise HUD
  const isVideoLive = videoConfigured && runtime.status === 'LIVE';
  const showVideo = primaryView === 'FLIGHT' && isVideoLive;
  const showHud = primaryView === 'FLIGHT' && !isVideoLive;

  return (
    <View style={styles.container}>
      {/* MAP LAYER */}
      <View
        style={[styles.layer, styles.mapLayer, primaryView !== 'MAP' && styles.hiddenNativeLayer]}
        pointerEvents={primaryView === 'MAP' ? 'auto' : 'none'}
      >
        <FlyMapView />
      </View>

      {/* VIDEO LAYER */}
      {videoConfigured ? (
        <View
          style={[styles.layer, styles.videoLayer, !showVideo && styles.hiddenVideoLayer]}
          pointerEvents={showVideo ? 'auto' : 'none'}
        >
          <FlyVideoView />
        </View>
      ) : null}

      {/* HUD / INSTRUMENT LAYER */}
      <View
        style={[styles.layer, styles.instrumentLayer, !showHud && styles.hiddenNativeLayer]}
        pointerEvents={showHud ? 'box-none' : 'none'}
      >
        <FlyInstrumentView />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050A11',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLayer: {
    zIndex: layers.background,
  },
  videoLayer: {
    zIndex: layers.background + 1,
  },
  instrumentLayer: {
    zIndex: layers.background + 2,
  },
  hiddenNativeLayer: {
    opacity: 0,
    transform: [{ translateX: -9999 }],
  },
  hiddenVideoLayer: {
    opacity: 0,
    transform: [{ translateX: -9999 }],
  },
});
