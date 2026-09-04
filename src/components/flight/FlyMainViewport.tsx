import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FlyInstrumentView } from './FlyInstrumentView';
import { FlyVideoView } from './FlyVideoView';
import { FlyMapView } from './FlyMapView';
import { layers } from '../../theme/gcsTheme';
import { useAppSelector } from '../../store/hooks';
import { selectVideoSettings } from '../../store/settings/settingsSlice';
import { resolveFlightLayerVisibility, type FlightDisplayMode } from '../../video/FlightDisplayState';
import { useIsFocused } from '@react-navigation/native';

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
  displayMode = 'HUD',
}: Props) {
  const video = useAppSelector(selectVideoSettings);
  const isFocused = useIsFocused();
  const videoConfigured = video.transport === 'WEBRTC' && video.host.trim().length > 0;
  const visible = resolveFlightLayerVisibility(primaryView, displayMode, videoConfigured);

  return (
    <View style={styles.container}>
      {/* MAP LAYER */}
      <View
        style={[styles.layer, styles.mapLayer, !visible.map && styles.hiddenNativeLayer]}
        pointerEvents={visible.map ? 'auto' : 'none'}
      >
        <FlyMapView active={isFocused && visible.map} />
      </View>

      {/* VIDEO LAYER */}
      {videoConfigured ? (
        <View
          style={[styles.layer, styles.videoLayer, !visible.video && styles.hiddenVideoLayer]}
          pointerEvents={visible.video ? 'auto' : 'none'}
        >
          <FlyVideoView enabled={isFocused} />
        </View>
      ) : null}

      {/* HUD / INSTRUMENT LAYER */}
      <View
        style={[styles.layer, styles.instrumentLayer, !visible.hud && styles.hiddenNativeLayer]}
        pointerEvents={visible.hud ? 'box-none' : 'none'}
      >
        <FlyInstrumentView />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: '#050A11',
  },
  layer: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
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
