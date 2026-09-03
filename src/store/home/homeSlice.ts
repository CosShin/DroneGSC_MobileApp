import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

export type HomeStatus = 'UNKNOWN' | 'SET';

export interface HomePosition {
  latitude: number;
  longitude: number;
  altitude: number; // meters AMSL
  updatedAt: number;
}

export type HomeTransactionStatus =
  | 'IDLE'
  | 'CONFIRMING'
  | 'SENDING'
  | 'WAITING_ACK'
  | 'VERIFYING_HOME'
  | 'SUCCESS'
  | 'FAILED';

export interface HomeTargetLocation {
  source: 'VEHICLE' | 'MAP' | 'PHONE';
  latitude: number;
  longitude: number;
  /** Absolute altitude above mean sea level, as required by MAV_CMD_DO_SET_HOME. */
  altitude?: number;
  accuracy?: number | null;
  label: string;
}

export interface HomeTransactionState {
  status: HomeTransactionStatus;
  error: string | null;
  targetLocation: HomeTargetLocation | null;
  updatedAt: number;
}

export interface HomeState {
  status: HomeStatus;
  position: HomePosition | null;
  selectingOnMap: boolean;
  previewPosition: { latitude: number; longitude: number; altitude?: number } | null;
  transaction: HomeTransactionState;
}

const initialState: HomeState = {
  status: 'UNKNOWN',
  position: null,
  selectingOnMap: false,
  previewPosition: null,
  transaction: {
    status: 'IDLE',
    error: null,
    targetLocation: null,
    updatedAt: 0,
  },
};

export const homeSlice = createSlice({
  name: 'home',
  initialState,
  reducers: {
    setHomePosition: (state, action: PayloadAction<HomePosition | null>) => {
      if (action.payload) {
        state.status = 'SET';
        state.position = action.payload;
      } else {
        state.status = 'UNKNOWN';
        state.position = null;
      }
    },
    clearHomePosition: state => {
      state.status = 'UNKNOWN';
      state.position = null;
      state.selectingOnMap = false;
      state.previewPosition = null;
      state.transaction = {
        status: 'IDLE',
        error: null,
        targetLocation: null,
        updatedAt: Date.now(),
      };
    },
    setSelectingOnMap: (state, action: PayloadAction<boolean>) => {
      state.selectingOnMap = action.payload;
      if (!action.payload) {
        state.previewPosition = null;
      }
    },
    setPreviewPosition: (
      state,
      action: PayloadAction<{ latitude: number; longitude: number; altitude?: number } | null>,
    ) => {
      state.previewPosition = action.payload;
    },
    setHomeTransaction: (
      state,
      action: PayloadAction<Partial<HomeTransactionState>>,
    ) => {
      state.transaction = {
        ...state.transaction,
        ...action.payload,
        updatedAt: Date.now(),
      };
    },
    resetHomeTransaction: state => {
      state.transaction = {
        status: 'IDLE',
        error: null,
        targetLocation: null,
        updatedAt: Date.now(),
      };
      state.selectingOnMap = false;
      state.previewPosition = null;
    },
  },
});

export const {
  setHomePosition,
  clearHomePosition,
  setSelectingOnMap,
  setPreviewPosition,
  setHomeTransaction,
  resetHomeTransaction,
} = homeSlice.actions;

export const selectHomeState = (state: RootState) => state.home;
export const selectHomePosition = (state: RootState) => state.home.position;
export const selectHomeStatus = (state: RootState) => state.home.status;
export const selectIsSelectingHomeOnMap = (state: RootState) => state.home.selectingOnMap;
export const selectHomePreviewPosition = (state: RootState) => state.home.previewPosition;
export const selectHomeTransaction = (state: RootState) => state.home.transaction;

export default homeSlice.reducer;
