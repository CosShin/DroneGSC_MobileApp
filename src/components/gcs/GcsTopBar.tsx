import React from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { selectDroneMode } from '../../store/drone/droneSlice';
import { selectActiveType } from '../../store/connection/connectionSlice';
import { colors, glassShadow, radius } from '../../theme/gcsTheme';
import { GlassSurface } from './GlassSurface';
import { StatusChip } from './Primitives';
import { useTruthfulTelemetry } from '../../hooks/useTruthfulTelemetry';
import { selectGps, selectBattery } from '../../store/telemetry/telemetrySlice';
import { useGcsLayout } from '../../hooks/useGcsLayout';

export function GcsTopBar({ title }: { title?: string }) {
  const layout = useGcsLayout();
  const truth = useTruthfulTelemetry();
  const network = useAppSelector(selectActiveType);
  const mode = useAppSelector(selectDroneMode);
  const gps = useAppSelector(selectGps);
  const battery = useAppSelector(selectBattery);
  
  const waiting = truth.connectionStatus === 'CONNECTING' || truth.mavlinkState === 'WAITING_HEARTBEAT';
  const lost = truth.vehicleState === 'STALE' || truth.mavlinkState === 'HEARTBEAT_LOST';
  const compact = layout.isCompactLandscape;
  const showBrand = layout.contentWidth >= 760;
  const showTransport = layout.contentWidth >= 990;
  const showGps = layout.contentWidth >= 620;
  const linkText = truth.connected ? (compact ? 'Live' : 'Connected') : lost ? 'Link lost' : waiting ? (compact ? 'Waiting' : 'Waiting vehicle') : (compact ? 'Offline' : 'Disconnected');
  const flightMode = truth.connected ? (compact ? compactMode(mode) : mode) : '--';
  const gpsText = gps ? (gps.value.gpsFix ?? 0) >= 3 ? (compact ? String(gps.value.satellites ?? '--') : `${gps.value.satellites ?? '--'} sat`) : (compact ? 'GPS --' : 'No fix') : 'GPS --';

  return <GlassSurface variant="medium" style={[styles.bar, { height: layout.headerHeight }]} contentStyle={[styles.barContent, { paddingHorizontal: layout.contentPadding * 2, gap: layout.cardGap }]}> 
    <View style={styles.brand}>
      {showBrand ? <><Image source={require('../../../assets/logo.png')} style={{ width: compact ? 24 : 30, height: compact ? 24 : 30, resizeMode: 'contain' }} /><Text numberOfLines={1} style={[styles.brandText, compact && styles.brandTextCompact]}>ANITECH <Text style={styles.gcs}>GCS</Text></Text></> : null}
      {title ? <Text numberOfLines={1} style={[styles.title, showBrand && styles.titleDivider, compact && styles.titleCompact]}>{title}</Text> : null}
    </View>
    <View style={[styles.statuses, { gap: layout.cardGap }]}>
      <StatusChip icon="access-point" value={linkText} tone={truth.connected ? 'success' : lost ? 'danger' : waiting ? 'warning' : 'neutral'} pulse={truth.connected} compact={compact} />
      {showTransport ? <StatusChip icon={network === 'UDP' ? 'wifi' : 'lan-connect'} value={network === 'WEBSOCKET' ? 'Pi Gateway' : network} compact={compact} /> : null}
      {showGps ? <StatusChip icon="crosshairs-gps" value={gpsText} tone={gps && (gps.value.gpsFix ?? 0) >= 3 ? 'success' : 'neutral'} compact={compact} /> : null}
      <StatusChip icon="navigation-variant" value={flightMode} tone={truth.connected ? 'primary' : 'neutral'} compact={compact} />
      <StatusChip icon="battery-medium" value={battery ? `${Math.round(battery.value.percentage)}%` : '--'} tone={battery && battery.value.percentage < 20 ? 'danger' : battery ? 'success' : 'neutral'} compact={compact} />
    </View>
  </GlassSurface>;
}

function compactMode(mode: string) {
  if (mode === 'STABILIZE') return 'STAB';
  if (mode === 'ALT_HOLD') return 'ALT';
  return mode.length > 7 ? mode.slice(0, 6) : mode;
}

const styles = StyleSheet.create({
  bar: { flexShrink: 0, borderRadius: radius.pill, ...glassShadow },
  barContent: { height: '100%', flexDirection: 'row', alignItems: 'center' },
  brand: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandText: { color: colors.text, fontSize: 15, fontWeight: '900', letterSpacing: .8 },
  brandTextCompact: { fontSize: 12 },
  gcs: { color: colors.primary },
  title: { color: colors.text, fontSize: 17, fontWeight: '900' },
  titleCompact: { fontSize: 13 },
  titleDivider: { marginLeft: 7, paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: colors.borderStrong },
  statuses: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
});
