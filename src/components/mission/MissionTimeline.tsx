import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  addCommand, 
  deleteItem, 
  moveItem, 
  selectMissionItems, 
  selectSelectedItemId, 
  selectItem 
} from '../../store/mission/missionSlice';
import { MAV_CMD, getCommandDefinition } from '../../services/mission/MissionCommandRegistry';
import { radius } from '../../theme/gcsTheme';

export function MissionTimeline() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectMissionItems);
  const selectedId = useAppSelector(selectSelectedItemId);

  // Quick Command Add Handler
  const handleAddCommand = (cmd: number) => {
    dispatch(addCommand({ command: cmd }));
  };

  return (
    <View style={styles.container}>
      {/* 1. Quick Add Bar */}
      <View style={styles.quickAddBar}>
        <TouchableOpacity style={styles.quickBtn} onPress={() => handleAddCommand(MAV_CMD.NAV_WAYPOINT)}>
          <MaterialCommunityIcons name="map-marker-plus" size={13} color="#2586EA" />
          <Text style={styles.quickBtnText}>+ WP</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickBtn} onPress={() => handleAddCommand(MAV_CMD.NAV_TAKEOFF)}>
          <MaterialCommunityIcons name="airplane-takeoff" size={13} color="#10B981" />
          <Text style={styles.quickBtnText}>+ Takeoff</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickBtn} onPress={() => handleAddCommand(MAV_CMD.DO_CHANGE_SPEED)}>
          <MaterialCommunityIcons name="speedometer" size={13} color="#F59E0B" />
          <Text style={styles.quickBtnText}>+ Speed</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickBtn} onPress={() => handleAddCommand(MAV_CMD.NAV_LOITER_TIME)}>
          <MaterialCommunityIcons name="timer-sand" size={13} color="#8B5CF6" />
          <Text style={styles.quickBtnText}>+ Loiter</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickBtn} onPress={() => handleAddCommand(MAV_CMD.NAV_RETURN_TO_LAUNCH)}>
          <MaterialCommunityIcons name="home-export-outline" size={13} color="#2586EA" />
          <Text style={styles.quickBtnText}>+ RTL</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickBtn} onPress={() => handleAddCommand(MAV_CMD.NAV_LAND)}>
          <MaterialCommunityIcons name="airplane-landing" size={13} color="#DC2626" />
          <Text style={styles.quickBtnText}>+ Land</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Timeline List */}
      <View style={styles.timelineList}>
        {items.map((item, index) => {
          const isSelected = selectedId === item.id;
          const def = getCommandDefinition(item.command);
          const icon = getCommandIcon(item.command);

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.itemRow, isSelected && styles.itemRowSelected]}
              onPress={() => dispatch(selectItem(item.id))}
            >
              {/* Sequence badge */}
              <View style={[styles.seqBadge, isSelected && styles.seqBadgeSelected]}>
                <Text style={[styles.seqText, isSelected && styles.seqTextSelected]}>{index + 1}</Text>
              </View>

              {/* Command Icon */}
              <MaterialCommunityIcons name={icon} size={15} color={isSelected ? '#2586EA' : '#64748B'} />

              {/* Info Column */}
              <View style={styles.infoCol}>
                <Text numberOfLines={1} style={[styles.cmdTitle, isSelected && styles.cmdTitleSelected]}>
                  {def.label}
                </Text>
                <Text numberOfLines={1} style={styles.cmdDetails}>
                  {formatItemDetails(item)}
                </Text>
              </View>

              {/* Reorder Arrows */}
              <View style={styles.reorderCol}>
                <TouchableOpacity
                  disabled={index === 0}
                  style={[styles.arrowBtn, index === 0 && styles.arrowDisabled]}
                  onPress={() => dispatch(moveItem({ fromIndex: index, toIndex: index - 1 }))}
                >
                  <MaterialCommunityIcons name="chevron-up" size={14} color={index === 0 ? '#CBD5E1' : '#64748B'} />
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={index === items.length - 1}
                  style={[styles.arrowBtn, index === items.length - 1 && styles.arrowDisabled]}
                  onPress={() => dispatch(moveItem({ fromIndex: index, toIndex: index + 1 }))}
                >
                  <MaterialCommunityIcons name="chevron-down" size={14} color={index === items.length - 1 ? '#CBD5E1' : '#64748B'} />
                </TouchableOpacity>
              </View>

              {/* Delete Button */}
              <TouchableOpacity style={styles.deleteMiniBtn} onPress={() => dispatch(deleteItem(item.id))}>
                <MaterialCommunityIcons name="close" size={13} color="#94A3B8" />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function getCommandIcon(cmd: number): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (cmd) {
    case MAV_CMD.NAV_WAYPOINT:
    case MAV_CMD.NAV_SPLINE_WAYPOINT:
      return 'map-marker';
    case MAV_CMD.NAV_TAKEOFF:
      return 'airplane-takeoff';
    case MAV_CMD.NAV_LAND:
      return 'airplane-landing';
    case MAV_CMD.NAV_RETURN_TO_LAUNCH:
      return 'home-export-outline';
    case MAV_CMD.NAV_LOITER_TIME:
    case MAV_CMD.NAV_LOITER_TURNS:
    case MAV_CMD.NAV_LOITER_UNLIM:
      return 'timer-sand';
    case MAV_CMD.DO_CHANGE_SPEED:
      return 'speedometer';
    case MAV_CMD.CONDITION_YAW:
      return 'rotate-right';
    case MAV_CMD.DO_SET_ROI:
      return 'crosshairs';
    default:
      return 'cog-outline';
  }
}

function formatItemDetails(item: any): string {
  const parts: string[] = [];
  if (item.alt !== undefined) parts.push(`${item.alt.toFixed(0)}m alt`);
  if (item.speed !== undefined) parts.push(`${item.speed.toFixed(1)}m/s`);
  if (item.delay && item.delay > 0) parts.push(`${item.delay}s delay`);
  return parts.length ? parts.join(' · ') : 'Default parameters';
}

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  quickAddBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  quickBtnText: {
    color: '#334155',
    fontSize: 8,
    fontWeight: '800',
  },
  timelineList: {
    gap: 3.5,
  },
  itemRow: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  itemRowSelected: {
    backgroundColor: 'rgba(37, 134, 234, 0.12)',
    borderColor: 'rgba(37, 134, 234, 0.35)',
  },
  seqBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 134, 234, 0.12)',
    borderWidth: 1,
    borderColor: '#2586EA',
  },
  seqBadgeSelected: {
    backgroundColor: '#2586EA',
  },
  seqText: {
    color: '#2586EA',
    fontSize: 8.5,
    fontWeight: '900',
  },
  seqTextSelected: {
    color: '#FFFFFF',
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
  },
  cmdTitle: {
    color: '#1E293B',
    fontSize: 9,
    fontWeight: '900',
  },
  cmdTitleSelected: {
    color: '#2586EA',
  },
  cmdDetails: {
    color: '#64748B',
    fontSize: 7.5,
    marginTop: 0.5,
  },
  reorderCol: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
  },
  arrowBtn: {
    padding: 1,
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  deleteMiniBtn: {
    padding: 3,
  },
});
