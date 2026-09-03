import React, { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  deleteItem, 
  duplicateItem, 
  selectMissionItems, 
  selectSelectedItem, 
  selectItem, 
  updateItem 
} from '../../store/mission/missionSlice';
import { 
  COMMAND_REGISTRY, 
  MAV_CMD, 
  MAV_FRAME, 
  getCommandDefinition, 
  getFrameLabel 
} from '../../services/mission/MissionCommandRegistry';
import { MissionEditorItem } from '../../services/mission/MissionTypes';
import { glass, glassShadow, radius, spacing } from '../../theme/gcsTheme';

export function WaypointEditor() {
  const dispatch = useAppDispatch();
  const selected = useAppSelector(selectSelectedItem);
  const items = useAppSelector(selectMissionItems);
  const [isAdvanced, setIsAdvanced] = useState(false);

  if (!selected) return null;

  const itemIndex = items.findIndex(it => it.id === selected.id);
  const prevItem = itemIndex > 0 ? items[itemIndex - 1] : null;
  const nextItem = itemIndex < items.length - 1 ? items[itemIndex + 1] : null;
  const def = getCommandDefinition(selected.command);

  // Calculate derived leg metrics if coordinates exist
  const distFromPrev = prevItem && selected.lat !== undefined && selected.lng !== undefined && prevItem.lat !== undefined && prevItem.lng !== undefined
    ? haversine(prevItem.lat, prevItem.lng, selected.lat, selected.lng)
    : null;

  const distToNext = nextItem && selected.lat !== undefined && selected.lng !== undefined && nextItem.lat !== undefined && nextItem.lng !== undefined
    ? haversine(selected.lat, selected.lng, nextItem.lat, nextItem.lng)
    : null;

  const bearingFromPrev = prevItem && selected.lat !== undefined && selected.lng !== undefined && prevItem.lat !== undefined && prevItem.lng !== undefined
    ? calculateBearing(prevItem.lat, prevItem.lng, selected.lat, selected.lng)
    : null;

  const legSpeed = selected.speed ?? 5;
  const legTimeSec = distFromPrev && legSpeed > 0 ? Math.round(distFromPrev / legSpeed) : null;

  const quickCommands = [
    MAV_CMD.NAV_WAYPOINT,
    MAV_CMD.NAV_TAKEOFF,
    MAV_CMD.DO_CHANGE_SPEED,
    MAV_CMD.NAV_LOITER_TIME,
    MAV_CMD.NAV_RETURN_TO_LAUNCH,
    MAV_CMD.NAV_LAND,
  ];

  return (
    <View style={styles.container}>
      {/* 1. Header with Back button and Item Title */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => dispatch(selectItem(null))}>
          <MaterialCommunityIcons name="arrow-left" size={16} color="#2586EA" />
          <Text style={styles.backText}>ALL ITEMS</Text>
        </TouchableOpacity>
        <View style={styles.titleBadge}>
          <Text style={styles.titleSeq}>#{itemIndex + 1}</Text>
          <Text style={styles.titleLabel}>{def.label}</Text>
        </View>
      </View>

      {/* 2. Command Selector Pills */}
      <View style={styles.commandPillsRow}>
        {quickCommands.map(cmdId => {
          const cmdDef = getCommandDefinition(cmdId);
          const isActive = selected.command === cmdId;
          return (
            <TouchableOpacity
              key={cmdId}
              style={[styles.cmdPill, isActive && styles.cmdPillActive]}
              onPress={() => {
                dispatch(updateItem({
                  id: selected.id,
                  changes: {
                    command: cmdId,
                    frame: cmdDef.defaultFrame,
                    alt: cmdDef.hasAltitude ? (selected.alt ?? cmdDef.defaultAltitude ?? 50) : undefined,
                  },
                }));
              }}
            >
              <Text numberOfLines={1} style={[styles.cmdPillText, isActive && styles.cmdPillTextActive]}>
                {cmdDef.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Basic / Advanced Mode Toggle */}
      <View style={styles.modeToggleRow}>
        <Text style={styles.modeToggleLabel}>Advanced MAVLink Options</Text>
        <Switch
          value={isAdvanced}
          onValueChange={val => setIsAdvanced(val)}
          trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
          thumbColor={isAdvanced ? '#2586EA' : '#F8FAFC'}
        />
      </View>

      {/* 4. GPS Coordinates / Location badge */}
      {def.hasLocation && selected.lat !== undefined && selected.lng !== undefined ? (
        <View style={styles.coordsBadge}>
          <MaterialCommunityIcons name="crosshairs-gps" size={13} color="#64748B" />
          <Text numberOfLines={1} style={styles.coordsText}>
            {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}
          </Text>
        </View>
      ) : null}

      {/* 5. Primary Parameters Section */}
      <View style={styles.paramsGrid}>
        {/* Altitude (if applicable) */}
        {def.hasAltitude ? (
          <FieldInput
            label="ALTITUDE (M)"
            value={selected.alt ?? 50}
            unit="m"
            onValueChange={alt => dispatch(updateItem({ id: selected.id, changes: { alt } }))}
          />
        ) : null}

        {/* Speed from this point */}
        <FieldInput
          label="SPEED (M/S)"
          value={selected.speed ?? 5}
          unit="m/s"
          hint="Speed from this point"
          onValueChange={speed => dispatch(updateItem({ id: selected.id, changes: { speed } }))}
        />

        {/* Hold / Delay */}
        {selected.command === MAV_CMD.NAV_WAYPOINT || selected.command === MAV_CMD.NAV_SPLINE_WAYPOINT || selected.command === MAV_CMD.NAV_LOITER_TIME ? (
          <FieldInput
            label="HOLD / DELAY (S)"
            value={selected.delay ?? 0}
            unit="s"
            onValueChange={delay => dispatch(updateItem({ id: selected.id, changes: { delay } }))}
          />
        ) : null}
      </View>

      {/* 6. Advanced Parameters (Frame, Autocontinue, Raw Params) */}
      {isAdvanced ? (
        <View style={styles.advancedSection}>
          <Text style={styles.sectionHeader}>MAVLINK WIRE ATTRIBUTES</Text>
          
          {/* Frame Selector */}
          {def.hasAltitude || def.hasLocation ? (
            <View style={styles.frameRow}>
              <Text style={styles.fieldLabel}>ALTITUDE REFERENCE (FRAME)</Text>
              <View style={styles.framePills}>
                {[MAV_FRAME.GLOBAL_RELATIVE_ALT, MAV_FRAME.GLOBAL, MAV_FRAME.GLOBAL_TERRAIN_ALT].map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.framePill, selected.frame === f && styles.framePillActive]}
                    onPress={() => dispatch(updateItem({ id: selected.id, changes: { frame: f } }))}
                  >
                    <Text style={[styles.framePillText, selected.frame === f && styles.framePillTextActive]}>
                      {getFrameLabel(f)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {/* Autocontinue Toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Auto Continue to Next</Text>
            <Switch
              value={selected.autocontinue}
              onValueChange={autocontinue => {
                dispatch(updateItem({ id: selected.id, changes: { autocontinue } }));
              }}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={selected.autocontinue ? '#2586EA' : '#F8FAFC'}
            />
          </View>

          {/* Command Specific Param Inputs */}
          {def.params.length ? (
            <View style={styles.customParamsWrap}>
              {def.params.map(p => {
                const paramKey = `param${p.index}` as keyof MissionEditorItem;
                const val = (selected[paramKey] as number | undefined) ?? p.defaultValue;
                return (
                  <FieldInput
                    key={p.index}
                    label={`P${p.index}: ${p.label.toUpperCase()}`}
                    value={val}
                    unit={p.unit}
                    onValueChange={nextVal => dispatch(updateItem({ id: selected.id, changes: { [paramKey]: nextVal } }))}
                  />
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 7. Derived Navigation Leg Metrics */}
      {distFromPrev != null ? (
        <View style={styles.metricsBox}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>FROM PREV</Text>
            <Text style={styles.metricVal}>{Math.round(distFromPrev)} m</Text>
          </View>
          {bearingFromPrev != null ? (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>BEARING</Text>
              <Text style={styles.metricVal}>{bearingFromPrev.toFixed(0)}°</Text>
            </View>
          ) : null}
          {legTimeSec != null ? (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>LEG ETA</Text>
              <Text style={styles.metricVal}>{legTimeSec} s</Text>
            </View>
          ) : null}
          {distToNext != null ? (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>TO NEXT</Text>
              <Text style={styles.metricVal}>{Math.round(distToNext)} m</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 8. Action Buttons (Duplicate & Delete) */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={styles.dupBtn}
          onPress={() => dispatch(duplicateItem(selected.id))}
        >
          <MaterialCommunityIcons name="content-copy" size={14} color="#2586EA" />
          <Text style={styles.dupBtnText}>Duplicate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.delBtn}
          onPress={() => dispatch(deleteItem(selected.id))}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={14} color="#DC2626" />
          <Text style={styles.delBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FieldInput({
  label,
  value,
  unit,
  hint,
  onValueChange,
}: {
  label: string;
  value: number;
  unit?: string;
  hint?: string;
  onValueChange: (val: number) => void;
}) {
  return (
    <View style={styles.fieldBox}>
      <View style={styles.fieldLabelRow}>
        <Text numberOfLines={1} style={styles.fieldLabel}>{label}</Text>
        {unit ? <Text style={styles.fieldUnit}>({unit})</Text> : null}
      </View>
      <TextInput
        style={styles.textInput}
        keyboardType="decimal-pad"
        defaultValue={String(value)}
        onEndEditing={e => {
          const num = Number(e.nativeEvent.text);
          if (Number.isFinite(num)) onValueChange(num);
        }}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const toDeg = (v: number) => (v * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
  },
  backText: {
    color: '#2586EA',
    fontSize: 9,
    fontWeight: '900',
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleSeq: {
    color: '#2586EA',
    fontSize: 11,
    fontWeight: '900',
  },
  titleLabel: {
    color: '#1E293B',
    fontSize: 11,
    fontWeight: '900',
  },
  commandPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  cmdPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cmdPillActive: {
    backgroundColor: 'rgba(37, 134, 234, 0.14)',
    borderColor: '#2586EA',
  },
  cmdPillText: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '800',
  },
  cmdPillTextActive: {
    color: '#2586EA',
  },
  modeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  modeToggleLabel: {
    color: '#64748B',
    fontSize: 8.5,
    fontWeight: '800',
  },
  coordsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(240, 244, 250, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  coordsText: {
    color: '#64748B',
    fontSize: 8.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  paramsGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  fieldBox: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 2,
  },
  fieldLabel: {
    color: '#64748B',
    fontSize: 7.5,
    fontWeight: '800',
  },
  fieldUnit: {
    color: '#94A3B8',
    fontSize: 7,
    fontWeight: '700',
  },
  fieldHint: {
    color: '#94A3B8',
    fontSize: 6.5,
    marginTop: 1,
  },
  textInput: {
    height: 32,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(180, 190, 210, 0.60)',
    backgroundColor: '#FFFFFF',
    color: '#1E293B',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  advancedSection: {
    backgroundColor: 'rgba(248, 250, 252, 0.80)',
    padding: 8,
    borderRadius: radius.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  sectionHeader: {
    color: '#475569',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  frameRow: {
    gap: 3,
  },
  framePills: {
    flexDirection: 'row',
    gap: 4,
  },
  framePill: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  framePillActive: {
    borderColor: '#2586EA',
    backgroundColor: 'rgba(37, 134, 234, 0.12)',
  },
  framePillText: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#64748B',
  },
  framePillTextActive: {
    color: '#2586EA',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '800',
  },
  customParamsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricsBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(240, 245, 252, 0.85)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 6.5,
    fontWeight: '800',
  },
  metricVal: {
    color: '#1E293B',
    fontSize: 8.5,
    fontWeight: '900',
    marginTop: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  dupBtn: {
    flex: 1,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(37, 134, 234, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 134, 234, 0.30)',
  },
  dupBtnText: {
    color: '#2586EA',
    fontSize: 9,
    fontWeight: '900',
  },
  delBtn: {
    flex: 1,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(254, 242, 242, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.35)',
  },
  delBtnText: {
    color: '#DC2626',
    fontSize: 9,
    fontWeight: '900',
  },
});
