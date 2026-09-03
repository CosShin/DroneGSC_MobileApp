import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AiQuickActionType } from '../../services/ai/AiTypes';
import { radius } from '../../theme/gcsTheme';

interface Props {
  onSelectAction: (action: AiQuickActionType) => void;
  disabled?: boolean;
}

const ACTIONS: Array<{
  type: AiQuickActionType;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone: string;
}> = [
  { type: 'PREFLIGHT', label: 'Preflight', icon: 'clipboard-check-outline', tone: '#10B981' },
  { type: 'MAVLINK_CHECK', label: 'MAVLink', icon: 'pulse', tone: '#2586EA' },
  { type: 'ANALYZE_CAMERA', label: 'Camera', icon: 'camera-outline', tone: '#EC4899' },
  { type: 'MISSION_REVIEW', label: 'Mission', icon: 'map-marker-path', tone: '#8B5CF6' },
  { type: 'WHY_CANT_ARM', label: "Why can't I arm?", icon: 'shield-alert-outline', tone: '#F59E0B' },
  { type: 'CHECK_LANDING_MARKER', label: 'Landing Marker', icon: 'crosshairs-gps', tone: '#06B6D4' },
];

export const AiQuickActions = React.memo(function AiQuickActions({
  onSelectAction,
  disabled = false,
}: Props) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {ACTIONS.map(action => (
          <TouchableOpacity
            key={action.type}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            disabled={disabled}
            activeOpacity={0.75}
            style={[styles.chip, disabled && styles.chipDisabled]}
            onPress={() => onSelectAction(action.type)}
          >
            <MaterialCommunityIcons name={action.icon} size={13} color={action.tone} />
            <Text numberOfLines={1} style={styles.chipText}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  scrollContent: {
    paddingHorizontal: 10,
    gap: 5,
    alignItems: 'center',
  },
  chip: {
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(37, 134, 234, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.1,
  },
});
