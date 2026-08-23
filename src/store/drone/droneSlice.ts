import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

export interface DroneState {
  armed: boolean;
  flightMode: string;
  systemStatus: string;
}

const initialState: DroneState = {
  armed: false,
  flightMode: 'UNKNOWN',
  systemStatus: 'UNINIT',
};

export const droneSlice = createSlice({
  name: 'drone',
  initialState,
  reducers: {
    setArmed: (state, action: PayloadAction<boolean>) => {
      state.armed = action.payload;
    },
    setFlightMode: (state, action: PayloadAction<string>) => {
      state.flightMode = action.payload;
    },
    setSystemStatus: (state, action: PayloadAction<string>) => {
      state.systemStatus = action.payload;
    },
  },
});

export const { setArmed, setFlightMode, setSystemStatus } = droneSlice.actions;

export const selectIsArmed = (state: RootState) => state.drone.armed;
export const selectDroneMode = (state: RootState) => state.drone.flightMode;
export const selectSystemStatus = (state: RootState) => state.drone.systemStatus;

export default droneSlice.reducer;
