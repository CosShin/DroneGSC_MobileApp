import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import {
  selectConnectionHealth,
} from '../../store/connection/connectionSlice';
import { glassShadow, layers } from '../../theme/gcsTheme';
import { GlassSurface } from '../gcs/GlassSurface';

const COLORS = {
  EXCELLENT: '#10B981',
  GOOD: '#10B981',
  DEGRADED: '#EAB308',
  POOR: '#F97316',
  CRITICAL: '#DC2626',
} as const;

function metric(value: number | null, suffix: string, digits = 0) {
  return value === null ? '--' : `${value.toFixed(digits)}${suffix}`;
}

export const LinkQualityIndicator = React.memo(function LinkQualityIndicator({ compact }: { compact: boolean }) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const health = useAppSelector(selectConnectionHealth);
  const color = COLORS[health.linkQuality];
  const hasHeartbeat = health.lastHeartbeatAt !== null;
  const label = hasHeartbeat ? `LINK ${health.linkQualityScore}` : 'LINK --';

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open link quality details"
        activeOpacity={0.82}
        onPress={() => setDetailsOpen(open => !open)}
      >
        <GlassSurface
          variant="strong"
          style={[styles.pill, compact && styles.pillCompact]}
          contentStyle={styles.pillContent}
        >
          <MaterialCommunityIcons name="signal" size={compact ? 13 : 15} color={color} />
          <Text numberOfLines={1} style={[styles.pillText, compact && styles.pillTextCompact, { color }]}>{label}</Text>
        </GlassSurface>
      </TouchableOpacity>

      {detailsOpen ? (
        <GlassSurface variant="strong" style={styles.details} contentStyle={styles.detailsContent}>
          <Text style={styles.title}>LINK DETAILS</Text>
          <Detail label="Network" value={`${health.networkStatus}${health.networkType ? ` · ${health.networkType.toUpperCase()}` : ''}`} />
          <Detail label="MAVLink" value={health.mavlinkStatus} />
          <Detail label="Control" value={health.controlStatus} />
          <Detail label="Heartbeat" value={metric(health.heartbeatAgeMs, ' ms')} />
          <Detail label="RTT" value={metric(health.rttMs, ' ms')} />
          <Detail label="Jitter" value={metric(health.jitterMs, ' ms')} />
          <Detail label="Loss" value={metric(health.packetLossPct, '%', 1)} />
          <Detail label="ACK" value={metric(health.lastAckLatencyMs, ' ms')} />
          <Detail label="Reconnects" value={`${health.reconnectCount}`} />
          <Detail label="Transport" value={health.transport ?? '--'} />
        </GlassSurface>
      ) : null}
    </View>
  );
});

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: layers.panel },
  pill: {
    height: 34,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.64)',
    ...glassShadow,
  },
  pillCompact: { height: 30 },
  pillContent: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
  },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0 },
  pillTextCompact: { fontSize: 8.5 },
  details: {
    ...glassShadow,
    position: 'absolute',
    top: 38,
    right: 0,
    width: 220,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    zIndex: layers.critical,
    elevation: layers.critical,
  },
  detailsContent: { padding: 12, gap: 6 },
  title: { color: '#172B4D', fontSize: 10, fontWeight: '900', letterSpacing: 0 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  detailLabel: { color: '#64748B', fontSize: 9, fontWeight: '700', letterSpacing: 0 },
  detailValue: { flexShrink: 1, color: '#172B4D', fontSize: 9, fontWeight: '800', textAlign: 'right', letterSpacing: 0 },
});
