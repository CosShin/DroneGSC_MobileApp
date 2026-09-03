import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { MAV_CMD, MAV_FRAME, getCommandDefinition } from '../../services/mission/MissionCommandRegistry';
import { MissionEditorItem, MissionItemInt, MissionVerificationResult } from '../../services/mission/MissionTypes';

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
  delay: number;
  command?: number;
}

export interface MissionState {
  items: MissionEditorItem[];
  selectedItemId: string | null;
  syncStatus: 'UNSYNCED' | 'SYNCING' | 'SYNCED' | 'ERROR';
  syncProgress: number;
  rawWireItems: MissionItemInt[];
  verifyResult: MissionVerificationResult | null;
}

const initialState: MissionState = {
  items: [],
  selectedItemId: null,
  syncStatus: 'UNSYNCED',
  syncProgress: 0,
  rawWireItems: [],
  verifyResult: null,
};

export const missionSlice = createSlice({
  name: 'mission',
  initialState,
  reducers: {
    addWaypoint: (state, action: PayloadAction<{ lat: number; lng: number; command?: number }>) => {
      const command = action.payload.command ?? MAV_CMD.NAV_WAYPOINT;
      const def = getCommandDefinition(command);
      
      // Find previous item with location/altitude to inherit defaults
      const prevLocationItem = [...state.items].reverse().find(it => it.lat !== undefined && it.lng !== undefined);
      const prevSpeed = [...state.items].reverse().find(it => it.speed !== undefined)?.speed ?? 5;
      const prevAlt = prevLocationItem?.alt ?? def.defaultAltitude ?? 50;

      const newItem: MissionEditorItem = {
        id: uuidv4(),
        command,
        frame: def.defaultFrame,
        lat: action.payload.lat,
        lng: action.payload.lng,
        alt: prevAlt,
        speed: prevSpeed,
        delay: 0,
        param1: def.params.find(p => p.index === 1)?.defaultValue ?? 0,
        param2: def.params.find(p => p.index === 2)?.defaultValue ?? 0,
        param3: def.params.find(p => p.index === 3)?.defaultValue ?? 0,
        param4: def.params.find(p => p.index === 4)?.defaultValue ?? 0,
        autocontinue: true,
        customLabel: def.label,
      };

      state.items.push(newItem);
      state.selectedItemId = newItem.id;
      state.syncStatus = 'UNSYNCED';
      state.verifyResult = null;
    },

    addCommand: (state, action: PayloadAction<{ command: number; lat?: number; lng?: number; alt?: number }>) => {
      const def = getCommandDefinition(action.payload.command);
      const prevLocationItem = [...state.items].reverse().find(it => it.lat !== undefined && it.lng !== undefined);
      const prevSpeed = [...state.items].reverse().find(it => it.speed !== undefined)?.speed ?? 5;
      const prevAlt = prevLocationItem?.alt ?? def.defaultAltitude ?? 50;

      const newItem: MissionEditorItem = {
        id: uuidv4(),
        command: action.payload.command,
        frame: def.defaultFrame,
        lat: def.hasLocation ? (action.payload.lat ?? prevLocationItem?.lat ?? 0) : undefined,
        lng: def.hasLocation ? (action.payload.lng ?? prevLocationItem?.lng ?? 0) : undefined,
        alt: def.hasAltitude ? (action.payload.alt ?? prevAlt) : undefined,
        speed: prevSpeed,
        delay: 0,
        param1: def.params.find(p => p.index === 1)?.defaultValue ?? 0,
        param2: def.params.find(p => p.index === 2)?.defaultValue ?? 0,
        param3: def.params.find(p => p.index === 3)?.defaultValue ?? 0,
        param4: def.params.find(p => p.index === 4)?.defaultValue ?? 0,
        autocontinue: true,
        customLabel: def.label,
      };

      state.items.push(newItem);
      state.selectedItemId = newItem.id;
      state.syncStatus = 'UNSYNCED';
      state.verifyResult = null;
    },

    updateItem: (state, action: PayloadAction<{ id: string; changes: Partial<MissionEditorItem> }>) => {
      const idx = state.items.findIndex(w => w.id === action.payload.id);
      if (idx !== -1) {
        state.items[idx] = { ...state.items[idx], ...action.payload.changes };
        state.syncStatus = 'UNSYNCED';
        state.verifyResult = null;
      }
    },

    deleteItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(w => w.id !== action.payload);
      if (state.selectedItemId === action.payload) {
        state.selectedItemId = null;
      }
      state.syncStatus = 'UNSYNCED';
      state.verifyResult = null;
    },

    duplicateItem: (state, action: PayloadAction<string>) => {
      const idx = state.items.findIndex(w => w.id === action.payload);
      if (idx !== -1) {
        const source = state.items[idx];
        const copy: MissionEditorItem = {
          ...source,
          id: uuidv4(),
          // Offset slightly so it is visually distinct on map
          lat: source.lat !== undefined ? source.lat + 0.00015 : undefined,
          lng: source.lng !== undefined ? source.lng + 0.00015 : undefined,
        };
        state.items.splice(idx + 1, 0, copy);
        state.selectedItemId = copy.id;
        state.syncStatus = 'UNSYNCED';
        state.verifyResult = null;
      }
    },

    moveItem: (state, action: PayloadAction<{ fromIndex: number; toIndex: number }>) => {
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex < 0 || fromIndex >= state.items.length || toIndex < 0 || toIndex >= state.items.length) {
        return;
      }
      const [moved] = state.items.splice(fromIndex, 1);
      state.items.splice(toIndex, 0, moved);
      state.syncStatus = 'UNSYNCED';
      state.verifyResult = null;
    },

    selectItem: (state, action: PayloadAction<string | null>) => {
      state.selectedItemId = action.payload;
    },

    clearMission: (state) => {
      state.items = [];
      state.selectedItemId = null;
      state.rawWireItems = [];
      state.verifyResult = null;
      state.syncStatus = 'UNSYNCED';
    },

    setMissionFromDownload: (state, action: PayloadAction<{ editorItems: MissionEditorItem[]; wireItems: MissionItemInt[] }>) => {
      state.items = action.payload.editorItems;
      state.rawWireItems = action.payload.wireItems;
      state.selectedItemId = null;
      state.syncStatus = 'SYNCED';
      state.syncProgress = 1;
      state.verifyResult = null;
    },

    setEditorItems: (state, action: PayloadAction<MissionEditorItem[]>) => {
      state.items = action.payload;
      state.selectedItemId = null;
      state.syncStatus = 'UNSYNCED';
      state.verifyResult = null;
    },

    setRawWireItems: (state, action: PayloadAction<MissionItemInt[]>) => {
      state.rawWireItems = action.payload;
    },

    setVerifyResult: (state, action: PayloadAction<MissionVerificationResult | null>) => {
      state.verifyResult = action.payload;
    },

    setSyncStatus: (state, action: PayloadAction<'UNSYNCED' | 'SYNCING' | 'SYNCED' | 'ERROR'>) => {
      state.syncStatus = action.payload;
    },

    setSyncProgress: (state, action: PayloadAction<number>) => {
      state.syncProgress = action.payload;
    },

    // Legacy backwards compatibility actions
    updateWaypoint: (state, action: PayloadAction<{ id: string; changes: Partial<MissionEditorItem> }>) => {
      const idx = state.items.findIndex(w => w.id === action.payload.id);
      if (idx !== -1) {
        state.items[idx] = { ...state.items[idx], ...action.payload.changes };
        state.syncStatus = 'UNSYNCED';
      }
    },
    deleteWaypoint: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(w => w.id !== action.payload);
      if (state.selectedItemId === action.payload) {
        state.selectedItemId = null;
      }
      state.syncStatus = 'UNSYNCED';
    },
    selectWaypoint: (state, action: PayloadAction<string | null>) => {
      state.selectedItemId = action.payload;
    },
    replaceMission: (state, action: PayloadAction<Array<{ lat: number; lng: number; alt: number; speed: number; delay: number }>>) => {
      state.items = action.payload.map((p) => ({
        id: uuidv4(),
        command: MAV_CMD.NAV_WAYPOINT,
        frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
        lat: p.lat,
        lng: p.lng,
        alt: p.alt,
        speed: p.speed,
        delay: p.delay,
        autocontinue: true,
      }));
      state.selectedItemId = null;
      state.syncStatus = 'SYNCED';
      state.syncProgress = 1;
    },
  },
});

export const { 
  addWaypoint, 
  addCommand,
  updateItem, 
  deleteItem, 
  duplicateItem,
  moveItem,
  selectItem, 
  clearMission,
  setMissionFromDownload,
  setRawWireItems,
  setVerifyResult,
  setSyncStatus,
  setSyncProgress,
  setEditorItems,
  // Legacy exports
  updateWaypoint,
  deleteWaypoint,
  selectWaypoint,
  replaceMission,
} = missionSlice.actions;

export const selectMissionItems = (state: RootState) => state.mission.items;
export const selectSelectedItemId = (state: RootState) => state.mission.selectedItemId;
export const selectSelectedItem = (state: RootState) => 
  state.mission.items.find(w => w.id === state.mission.selectedItemId) || null;

// Legacy selectors mapped to rich items
export const selectWaypoints = createSelector(
  [selectMissionItems],
  items => items
    .filter(it => it.lat !== undefined && it.lng !== undefined)
    .map(it => ({
      id: it.id,
      lat: it.lat!,
      lng: it.lng!,
      alt: it.alt ?? 50,
      speed: it.speed ?? 5,
      delay: it.delay ?? 0,
      command: it.command,
    })),
);

export const selectSelectedWaypointId = (state: RootState) => state.mission.selectedItemId;
export const selectSelectedWaypoint = (state: RootState) => {
  const item = state.mission.items.find(w => w.id === state.mission.selectedItemId);
  if (!item || item.lat === undefined || item.lng === undefined) return null;
  return {
    id: item.id,
    lat: item.lat,
    lng: item.lng,
    alt: item.alt ?? 50,
    speed: item.speed ?? 5,
    delay: item.delay ?? 0,
    command: item.command,
  };
};

export const selectSyncStatus = (state: RootState) => state.mission.syncStatus;
export const selectSyncProgress = (state: RootState) => state.mission.syncProgress;
export const selectRawWireItems = (state: RootState) => state.mission.rawWireItems;
export const selectVerifyResult = (state: RootState) => state.mission.verifyResult;

export default missionSlice.reducer;
