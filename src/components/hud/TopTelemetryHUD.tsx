import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { selectConnectionStatus, selectMavlinkState, selectVehicleState } from '../../store/connection/connectionSlice';
import { selectBattery, selectGps } from '../../store/telemetry/telemetrySlice';
import { glassShadow, layers } from '../../theme/gcsTheme';
import { useGcsLayout } from '../../hooks/useGcsLayout';
import { GlassSurface } from '../gcs/GlassSurface';
import { FlyViewModeSwitcher } from '../flight/FlyViewModeSwitcher';

import { selectHomePosition, selectHomeStatus } from '../../store/home/homeSlice';
import { calculateBearingDegrees, calculateDistanceMeters, formatDistance, isValidCoordinate } from '../../utils/geographic';

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
}: {
  showFlightViewSwitcher?: boolean;
  onOpenAi?: () => void;
}) {
  const layout = useGcsLayout();
  const compact = showFlightViewSwitcher || layout.isCompactLandscape || layout.contentWidth < 900;

  const connection = useAppSelector(selectConnectionStatus);
  const vehicle = useAppSelector(selectVehicleState);
  const mavlink = useAppSelector(selectMavlinkState);
  const connected = connection === 'CONNECTED' && vehicle === 'CONNECTED';
  const waiting = connection === 'CONNECTING' || mavlink === 'WAITING_HEARTBEAT';
  const lost = vehicle === 'STALE' || mavlink === 'HEARTBEAT_LOST';

  const gps = useAppSelector(selectGps);
  const fixed = !!gps && (gps.value.gpsFix ?? 0) >= 3;

  const battery = useAppSelector(selectBattery);
  const batteryPct = battery ? Math.round(battery.value.percentage) : null;

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
          style={[styles.flightSwitcherSlot, layout.isCompactLandscape && styles.flightSwitcherSlotCompact]}
        >
          <FlyViewModeSwitcher compact />
        </View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[styles.pillsRow, compact && styles.pillsRowCompact]}
      >
        {/* Connection Pill */}
        <StatusPill
          icon="access-point"
          compact={compact}
          tone={connected ? 'success' : lost ? 'danger' : waiting ? 'warning' : 'neutral'}
          value={connected ? 'Connected' : lost ? 'Link Lost' : waiting ? 'Waiting' : 'Offline'}
        />

        {/* GPS Pill */}
        <StatusPill
          icon="crosshairs-gps"
          compact={compact}
          tone={fixed ? 'primary' : 'neutral'}
          value={fixed ? `${gps?.value.satellites ?? '--'} SAT` : 'GPS No fix'}
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
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  topHudWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: layers.hud,
  },
  pillsRow: {
    position: 'absolute',
    top: 10,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  pillsRowCompact: {
    top: 8,
    right: 10,
    gap: 5,
  },
  flightSwitcherSlot: {
    position: 'absolute',
    top: 10,
    left: 200,
  },
  flightSwitcherSlotCompact: {
    top: 8,
    left: 184,
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
});
