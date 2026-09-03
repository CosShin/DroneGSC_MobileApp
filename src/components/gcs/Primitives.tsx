import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, glass, radius, shadow, spacing } from '../../theme/gcsTheme';
import { useGcsLayout } from '../../hooks/useGcsLayout';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
const tones = {
  neutral: { 
    color: '#334155', 
    bg: 'rgba(255, 255, 255, 0.90)',
    border: 'rgba(203, 213, 225, 0.70)'
  },
  primary: { 
    color: '#2586EA', 
    bg: 'rgba(239, 246, 255, 0.95)',
    border: 'rgba(59, 130, 246, 0.40)'
  },
  success: { 
    color: '#10B981', 
    bg: 'rgba(236, 253, 245, 0.95)',
    border: 'rgba(16, 185, 129, 0.40)'
  },
  warning: { 
    color: '#D97706', 
    bg: 'rgba(254, 243, 199, 0.95)',
    border: 'rgba(245, 158, 11, 0.40)'
  },
  danger: { 
    color: '#DC2626', 
    bg: 'rgba(254, 242, 242, 0.95)',
    border: 'rgba(239, 68, 68, 0.40)'
  },
} as const;

export function StatusChip({ 
  label, 
  value, 
  tone = 'neutral', 
  icon, 
  pulse = false, 
  compact = false 
}: { 
  label?: string; 
  value: string; 
  tone?: Tone; 
  icon?: keyof typeof MaterialCommunityIcons.glyphMap; 
  pulse?: boolean; 
  compact?: boolean 
}) {
  const scheme = tones[tone];
  const scale = React.useRef(new Animated.Value(1)).current;
  const previousPulse = React.useRef(false);

  React.useEffect(() => { 
    if (pulse && !previousPulse.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.06, duration: 220, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 320, useNativeDriver: true })
      ]).start();
    }
    previousPulse.current = pulse; 
  }, [pulse, scale]);

  return (
    <Animated.View 
      style={[
        styles.chip,
        compact && styles.chipCompact,
        { backgroundColor: scheme.bg, borderColor: scheme.border, transform: [{ scale }] }
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons name={icon} size={compact ? 12 : 14} color={scheme.color} />
      ) : (
        <View style={[styles.dot, { backgroundColor: scheme.color }]} />
      )}
      {label && !compact ? (
        <Text numberOfLines={1} style={styles.chipLabel}>{label}</Text>
      ) : null}
      <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.chipValue, compact && styles.chipValueCompact, { color: scheme.color }]}>
        {value}
      </Text>
    </Animated.View>
  );
}

export function TelemetryCard({ 
  label, 
  value, 
  unit, 
  icon, 
  tone = 'neutral', 
  caption, 
  compact 
}: { 
  label: string; 
  value: string; 
  unit?: string; 
  icon: keyof typeof MaterialCommunityIcons.glyphMap; 
  tone?: Tone; 
  caption?: string; 
  compact?: boolean 
}) {
  const scheme = tones[tone];
  const layout = useGcsLayout();
  const isCompact = compact || layout.isCompactLandscape;

  return (
    <View style={[styles.telemetryCard, isCompact && styles.telemetryCardCompact]}>
      <View style={[styles.iconTile, isCompact && styles.iconTileCompact, { backgroundColor: scheme.bg }]}>
        <MaterialCommunityIcons name={icon} size={isCompact ? 14 : 17} color={scheme.color} />
      </View>
      <View style={styles.telemetryCopy}>
        <Text numberOfLines={1} style={styles.valueLabel}>{label}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.value, isCompact && styles.valueCompact]}>
          {value}
          <Text style={styles.unit}>{unit ? ` ${unit}` : ''}</Text>
        </Text>
        {caption && !isCompact ? (
          <Text numberOfLines={1} style={styles.caption}>{caption}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function TelemetryValue({ label, value, unit, tone = 'neutral' }: { label: string; value: string; unit?: string; tone?: Tone }) { 
  return (
    <View style={styles.valueWrap}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text style={[styles.value, { color: tones[tone].color }]}>
        {value}
        <Text style={styles.unit}>{unit ? ` ${unit}` : ''}</Text>
      </Text>
    </View>
  ); 
}

export function Panel({ children, style, glass: glassMode = false }: React.PropsWithChildren<{ style?: ViewStyle | ViewStyle[]; glass?: boolean }>) { 
  return (
    <View style={[styles.panel, glassMode && styles.panelGlass, style]}>
      {children}
    </View>
  ); 
}

export function SectionTitle({ children, glass: glassMode = false }: React.PropsWithChildren<{ glass?: boolean }>) { 
  return (
    <Text style={[styles.sectionTitle, glassMode && styles.sectionTitleGlass]}>
      {children}
    </Text>
  ); 
}

export function CommandButton({ 
  label, 
  icon, 
  tone = 'neutral', 
  disabled, 
  active, 
  filled = false, 
  style, 
  onPress 
}: { 
  label: string; 
  icon: keyof typeof MaterialCommunityIcons.glyphMap; 
  tone?: Tone; 
  disabled?: boolean; 
  active?: boolean; 
  filled?: boolean; 
  style?: ViewStyle | ViewStyle[]; 
  onPress: () => void 
}) { 
  const scheme = tones[tone];
  const foreground = scheme.color;
  const layout = useGcsLayout();
  const isCompact = layout.isCompactLandscape;

  return (
    <TouchableOpacity 
      accessibilityRole="button" 
      accessibilityState={{ disabled, selected: active }} 
      activeOpacity={0.78} 
      disabled={disabled} 
      onPress={onPress} 
      style={[
        styles.command,
        isCompact && styles.commandCompact,
        { backgroundColor: scheme.bg, borderColor: scheme.border },
        active && styles.commandActive,
        disabled && styles.disabled,
        style
      ]}
    >
      <MaterialCommunityIcons name={icon} size={isCompact ? 16 : 18} color={foreground} />
      <Text 
        numberOfLines={1} 
        adjustsFontSizeToFit 
        minimumFontScale={0.68} 
        style={[
          styles.commandLabel,
          isCompact && styles.commandLabelCompact,
          { color: foreground }
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  ); 
}

export function EmptyStateCard({ 
  icon = 'quadcopter', 
  title, 
  description, 
  actionLabel, 
  onAction, 
  compact = false, 
  dark = false 
}: { 
  icon?: keyof typeof MaterialCommunityIcons.glyphMap; 
  title: string; 
  description: string; 
  actionLabel?: string; 
  onAction?: () => void; 
  compact?: boolean; 
  dark?: boolean 
}) { 
  return (
    <View style={[styles.empty, compact && styles.emptyCompact]}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={compact ? 22 : 34} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, dark && styles.emptyTitleDark]}>{title}</Text>
      <Text style={[styles.emptyDescription, dark && styles.emptyDescriptionDark]}>{description}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.emptyAction} onPress={onAction}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ); 
}

export function EmptyTelemetryState({ label = 'Telemetry unavailable' }: { label?: string }) { 
  return <EmptyStateCard compact icon="database-off-outline" title={label} description="Data will appear when a valid MAVLink message is received." />; 
}

const styles = StyleSheet.create({
  chip: {
    height: 30,
    minWidth: 0,
    maxWidth: 170,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 15,
  },
  chipCompact: {
    height: 27,
    paddingHorizontal: 7,
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  chipValue: {
    fontSize: 10,
    fontWeight: '800',
    flexShrink: 1,
  },
  chipValueCompact: {
    fontSize: 8.5,
  },
  telemetryCard: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.90)',
    borderRadius: radius.md,
    ...shadow.card,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  telemetryCopy: {
    flex: 1,
  },
  valueWrap: {
    minWidth: 74,
    flex: 1,
  },
  valueLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.65,
    textTransform: 'uppercase',
  },
  value: {
    color: '#1E293B',
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  caption: {
    color: '#94A3B8',
    fontSize: 8,
    marginTop: 1,
  },
  telemetryCardCompact: {
    minHeight: 44,
    gap: 6,
    padding: 6,
    borderRadius: radius.sm,
  },
  iconTileCompact: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  valueCompact: {
    fontSize: 14,
  },
  panel: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderColor: glass.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  panelGlass: {
    backgroundColor: glass.backgroundHeavy,
    borderColor: glass.border,
  },
  sectionTitle: {
    color: '#1E293B',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  sectionTitleGlass: {
    color: '#1E293B',
  },
  command: {
    minWidth: 0,
    height: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
  },
  commandCompact: {
    height: 42,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 5,
  },
  commandActive: {
    backgroundColor: 'rgba(239, 246, 255, 0.98)',
    borderColor: '#2586EA',
  },
  commandLabel: {
    minWidth: 0,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  commandLabelCompact: {
    fontSize: 9.5,
  },
  disabled: {
    opacity: 0.38,
  },
  empty: {
    flex: 1,
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyCompact: {
    minHeight: 100,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyTitleDark: {
    color: '#1E293B',
  },
  emptyDescription: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    maxWidth: 330,
    marginTop: 5,
  },
  emptyDescriptionDark: {
    color: '#64748B',
  },
  emptyAction: {
    marginTop: 12,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
