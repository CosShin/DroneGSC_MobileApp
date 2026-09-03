import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassSurface } from '../gcs/GlassSurface';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectPrimaryFlyView,
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
  const layout = useGcsLayout();
  const isCompact = compact ?? layout.isCompactLandscape;

  return (
    <View style={[styles.wrapper, style]} pointerEvents="box-none">
      <GlassSurface variant="strong" intensity={68} style={styles.surface} contentStyle={styles.content}>
        {/* FLIGHT TAB */}
        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityState={{ selected: primaryView === 'FLIGHT' }}
          accessibilityLabel="Switch to Flight view"
          activeOpacity={0.8}
          style={[
            styles.tab,
            isCompact && styles.tabCompact,
            primaryView === 'FLIGHT' && styles.tabActive,
          ]}
          onPress={() => dispatch(setPrimaryFlyView('FLIGHT'))}
        >
          <MaterialCommunityIcons
            name="airplane"
            size={isCompact ? 13 : 15}
            color={primaryView === 'FLIGHT' ? '#2586EA' : glass.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              isCompact && styles.tabLabelCompact,
              primaryView === 'FLIGHT' && styles.tabLabelActive,
            ]}
          >
            FLIGHT
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
