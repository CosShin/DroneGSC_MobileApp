import { configureStore } from '@reduxjs/toolkit';
import connectionReducer from './connection/connectionSlice';
import droneReducer from './drone/droneSlice';
import telemetryReducer from './telemetry/telemetrySlice';
import commandReducer from './command/commandSlice';
import settingsReducer from './settings/settingsSlice';
import missionReducer from './mission/missionSlice';

export const store = configureStore({
  reducer: {
    connection: connectionReducer,
    drone: droneReducer,
    telemetry: telemetryReducer,
    command: commandReducer,
    settings: settingsReducer,
    mission: missionReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
