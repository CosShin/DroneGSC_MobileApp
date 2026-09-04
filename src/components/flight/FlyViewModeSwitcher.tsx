import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassSurface } from '../gcs/GlassSurface';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectFlightDisplayMode,
  selectPrimaryFlyView,
  selectVideoSettings,
  setFlightDisplayMode,
  setPrimaryFlyView,
} from '../../store/settings/settingsSlice';
import { glass, glassShadow, radius } from '../../theme/gcsTheme';
import { useGcsLayout } from '../../hooks/useGcsLayout';

interface Props {
  style?: ViewStyle;
  compact?: boolean;
}

export const FlyViewModeSwitcher = React.memo(function FlyViewModeSwitcher({
  style,
  compact,
}: Props) {
  const dispatch = useAppDispatch();
  const primaryView = useAppSelector(selectPrimaryFlyView);
  const displayMode = useAppSelector(selectFlightDisplayMode);
  const video = useAppSelector(selectVideoSettings);
  const layout = useGcsLayout();
  const isCompact = compact ?? layout.isCompactLandscape;
  const videoConfigured = video.transport === 'WEBRTC' && video.host.trim().length > 0;
  const flightMode = primaryView === 'FLIGHT' ? displayMode : null;

  return (
    <View style={[styles.wrapper, style]} pointerEvents="box-none">
      <GlassSurface variant="strong" intensity={68} style={styles.surface} contentStyle={styles.content}>
        {/* HUD TAB */}
        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityState={{ selected: flightMode === 'HUD' }}
          accessibilityLabel="Switch to flight HUD"
          activeOpacity={0.8}
          style={[
            styles.tab,
            isCompact && styles.tabCompact,
            flightMode === 'HUD' && styles.tabActive,
          ]}
          onPress={() => dispatch(setFlightDisplayMode('HUD'))}
        >
          <MaterialCommunityIcons
            name="airplane"
            size={isCompact ? 13 : 15}
            color={flightMode === 'HUD' ? '#2586EA' : glass.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              isCompact && styles.tabLabelCompact,
              flightMode === 'HUD' && styles.tabLabelActive,
            ]}
          >
            HUD
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* VIDEO TAB */}
        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityState={{ selected: flightMode === 'VIDEO', disabled: !videoConfigured }}
          accessibilityLabel={videoConfigured ? 'Switch to live video' : 'Video is not configured'}
          activeOpacity={0.8}
          disabled={!videoConfigured}
          style={[
            styles.tab,
            isCompact && styles.tabCompact,
            flightMode === 'VIDEO' && styles.tabActive,
            !videoConfigured && styles.tabDisabled,
          ]}
          onPress={() => dispatch(setFlightDisplayMode('VIDEO'))}
        >
          <MaterialCommunityIcons
            name="video-outline"
            size={isCompact ? 13 : 15}
            color={flightMode === 'VIDEO' ? '#2586EA' : glass.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              isCompact && styles.tabLabelCompact,
              flightMode === 'VIDEO' && styles.tabLabelActive,
            ]}
          >
            VIDEO
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* MAP TAB */}
        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityState={{ selected: primaryView === 'MAP' }}
          accessibilityLabel="Switch to Map view"
          activeOpacity={0.8}
          style={[
            styles.tab,
            isCompact && styles.tabCompact,
            primaryView === 'MAP' && styles.tabActive,
          ]}
          onPress={() => dispatch(setPrimaryFlyView('MAP'))}
        >
          <MaterialCommunityIcons
            name="map-outline"
            size={isCompact ? 13 : 15}
            color={primaryView === 'MAP' ? '#2586EA' : glass.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              isCompact && styles.tabLabelCompact,
              primaryView === 'MAP' && styles.tabLabelActive,
            ]}
          >
            MAP
          </Text>
        </TouchableOpacity>
      </GlassSurface>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 35,
  },
  surface: {
    height: 30,
    borderRadius: radius.pill,
    ...glassShadow,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    padding: 2,
    gap: 1,
  },
  tab: {
    minWidth: 64,
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabCompact: {
    minWidth: 54,
    paddingHorizontal: 7,
    gap: 3,
  },
  tabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderColor: 'rgba(37, 134, 234, 0.35)',
  },
  tabDisabled: {
    opacity: 0.45,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(180, 195, 220, 0.40)',
  },
  tabLabel: {
    color: glass.textMuted,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  tabLabelCompact: {
    fontSize: 8,
  },
  tabLabelActive: {
    color: '#2586EA',
    fontWeight: '900',
  },
});
