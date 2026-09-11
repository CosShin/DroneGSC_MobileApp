import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import {
  selectConnectionStatus,
  selectControlStatus,
  selectMavlinkStatus,
  selectVehicleStatus,
} from '../../store/connection/connectionSlice';
import { selectBattery, selectGps, selectTelemetryStale } from '../../store/telemetry/telemetrySlice';
import { glassShadow, layers } from '../../theme/gcsTheme';
import { useGcsLayout } from '../../hooks/useGcsLayout';
import { GlassSurface } from '../gcs/GlassSurface';
import { FlyViewModeSwitcher } from '../flight/FlyViewModeSwitcher';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectHomePosition, selectHomeStatus } from '../../store/home/homeSlice';
import { calculateBearingDegrees, calculateDistanceMeters, formatDistance, isValidCoordinate } from '../../utils/geographic';
import { useFreshnessClock } from '../../hooks/useFreshnessClock';
import { LinkQualityIndicator } from './LinkQualityIndicator';
import { FRESHNESS_THRESHOLDS } from '../../config/TelemetryFreshness';

type Tone = 'neutral' | 'success' | 'primary' | 'danger' | 'warning';

const toneColors = { 
  neutral: '#64748B', 
  success: '#10B981', 
  primary: '#2586EA', 
  danger: '#DC2626',
  warning: '#F59E0B'
} as const;

interface StatusPillProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  value: string;
  tone?: Tone;
  compact: boolean;
}

const StatusPill = React.memo(function StatusPill({ icon, value, tone = 'neutral', compact }: StatusPillProps) {
  const color = toneColors[tone];
  return (
    <GlassSurface
      variant="strong"
      style={[styles.pill, compact && styles.pillCompact]}
      contentStyle={[styles.pillContent, compact && styles.pillContentCompact]}
    >
        <MaterialCommunityIcons name={icon} size={compact ? 13 : 15} color={color} />
        <Text numberOfLines={1} style={[styles.pillText, compact && styles.pillTextCompact, { color }]}> 
          {value}
        </Text>
    </GlassSurface>
  );
});

export const TopTelemetryHUD = React.memo(function TopTelemetryHUD({
  showFlightViewSwitcher = false,
  onOpenSettings,
}: {
  showFlightViewSwitcher?: boolean;
  onOpenAi?: () => void;
  onOpenSettings?: () => void;
}) {
  const layout = useGcsLayout();
  const insets = useSafeAreaInsets();
  const now = useFreshnessClock();
  const compact = showFlightViewSwitcher || layout.isCompactLandscape || layout.contentWidth < 900;
  const topOffset = insets.top + (layout.isCompactLandscape ? 8 : 10);
  const leftGroupEnd = insets.left + (layout.isCompactLandscape ? 314 : 330);
  const statusMaxWidth = Math.max(300, layout.screenWidth - leftGroupEnd - insets.right - 20);

  const connection = useAppSelector(selectConnectionStatus);
  const vehicle = useAppSelector(selectVehicleStatus);
  const mavlink = useAppSelector(selectMavlinkStatus);
  const control = useAppSelector(selectControlStatus);
  const connected = connection === 'CONNECTED' && vehicle === 'AVAILABLE' && mavlink === 'HEARTBEAT_OK';
  const telemetryStale = useAppSelector(selectTelemetryStale);
  const telemetryLive = connected && !telemetryStale;
  const waiting = connection === 'CONNECTING' || mavlink === 'WAITING';
  const lost = vehicle === 'UNRESPONSIVE' || mavlink === 'LOST';
  const degraded = control === 'DEGRADED' || mavlink === 'HEARTBEAT_STALE';

  const gps = useAppSelector(selectGps);
  const gpsFresh = telemetryLive && !!gps && now - gps.timestamp <= FRESHNESS_THRESHOLDS.GPS_MS;
  const fixed = gpsFresh && (gps.value.gpsFix ?? 0) >= 3;

  const battery = useAppSelector(selectBattery);
  const batteryPct = telemetryLive && battery && now - battery.timestamp <= FRESHNESS_THRESHOLDS.BATTERY_MS
    ? Math.round(battery.value.percentage)
    : null;

  const home = useAppSelector(selectHomePosition);
  const homeStatus = useAppSelector(selectHomeStatus);
  const isHomeSet = homeStatus === 'SET' && home != null;
  const hasValidVehiclePosition = fixed && isValidCoordinate(gps?.value.latitude, gps?.value.longitude);
  const homeDistance = isHomeSet && hasValidVehiclePosition
    ? calculateDistanceMeters(gps.value.latitude, gps.value.longitude, home.latitude, home.longitude)
    : null;
  const homeBearing = isHomeSet && hasValidVehiclePosition
    ? calculateBearingDegrees(gps.value.latitude, gps.value.longitude, home.latitude, home.longitude)
    : null;

  const homeDisplay = isHomeSet
    ? homeDistance != null
      ? `${formatDistance(homeDistance)} ${homeBearing != null ? `${Math.round(homeBearing)}°` : ''}`.trim()
      : 'Home Set'
    : 'Home --';

  return (
    <View pointerEvents="box-none" style={styles.topHudWrapper}>
      {showFlightViewSwitcher ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.flightSwitcherSlot,
            layout.isCompactLandscape && styles.flightSwitcherSlotCompact,
            { top: topOffset, left: insets.left + (layout.isCompactLandscape ? 148 : 158) },
          ]}
        >
          <FlyViewModeSwitcher compact />
        </View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[
          styles.pillsRow,
          compact && styles.pillsRowCompact,
          { top: topOffset, right: insets.right - 16, maxWidth: statusMaxWidth },
        ]}
      >
        {/* Connection Pill */}
        <StatusPill
          icon="access-point"
          compact={compact}
          tone={connected ? 'success' : lost ? 'danger' : degraded || waiting ? 'warning' : 'neutral'}
          value={connected ? 'Connected' : lost ? 'Link Lost' : degraded ? 'Degraded' : waiting ? 'Waiting' : 'Offline'}
        />

        <LinkQualityIndicator compact={compact} />

        {/* GPS Pill */}
        <StatusPill
          icon="crosshairs-gps"
          compact={compact}
          tone={fixed ? 'primary' : 'neutral'}
          value={!gpsFresh ? 'GPS --' : fixed ? `${gps?.value.satellites ?? '--'} SAT` : 'GPS No fix'}
        />

        {/* Home Pill */}
        <StatusPill
          icon={isHomeSet ? 'home' : 'home-outline'}
          compact={compact}
          tone={isHomeSet ? 'primary' : 'neutral'}
          value={homeDisplay}
        />

        {/* Battery Pill */}
        <StatusPill
          icon="battery-medium"
          compact={compact}
          tone={batteryPct == null ? 'neutral' : batteryPct < 20 ? 'danger' : 'success'}
          value={batteryPct == null ? '--' : `${batteryPct}%`}
        />

        {onOpenSettings ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            activeOpacity={0.82}
            onPress={onOpenSettings}
          >
            <GlassSurface
              variant="strong"
              style={[styles.settingsButton, compact && styles.settingsButtonCompact]}
              contentStyle={styles.settingsButtonContent}
            >
              <MaterialCommunityIcons name="cog" size={compact ? 18 : 20} color="#64748B" />
            </GlassSurface>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  topHudWrapper: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    zIndex: layers.hud,
  },
  pillsRow: {
    position: 'absolute',
    top: 10,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pillsRowCompact: {
    top: 8,
    right: 10,
    gap: 10,
  },
  flightSwitcherSlot: {
    position: 'absolute',
    top: 10,
    left: 158,
  },
  flightSwitcherSlotCompact: {
    top: 8,
    left: 148,
  },
  pill: {
    height: 34,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.64)',
    ...glassShadow,
  },
  pillContent: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5.5,
    paddingHorizontal: 11,
  },
  pillContentCompact: {
    gap: 4,
    paddingHorizontal: 8,
  },
  pillCompact: {
    height: 30,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pillTextCompact: {
    fontSize: 9,
  },
  settingsButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.64)',
    ...glassShadow,
  },
  settingsButtonCompact: {
    width: 30,
    height: 30,
  },
  settingsButtonContent: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
