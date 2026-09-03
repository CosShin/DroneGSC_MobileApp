import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';
import type { VideoRuntimeState, VideoStatus } from '../video/VideoTypes';

const initialState: VideoRuntimeState = {
  status: 'IDLE',
  currentUrl: null,
  lastConnectedAt: null,
  lastError: null,
  reconnectAttempt: 0,
};

const videoSlice = createSlice({
  name: 'video',
  initialState,
  reducers: {
    setVideoSource: (state, action: PayloadAction<string | null>) => {
      state.currentUrl = action.payload;
      state.lastError = null;
      state.reconnectAttempt = 0;
    },
    setVideoStatus: (state, action: PayloadAction<VideoStatus>) => {
      state.status = action.payload;
    },
    videoPlaying: state => {
      state.status = 'LIVE';
      state.lastConnectedAt = Date.now();
      state.lastError = null;
      state.reconnectAttempt = 0;
    },
    videoFailed: (state, action: PayloadAction<string>) => {
      state.status = 'ERROR';
      state.lastError = action.payload;
    },
    videoReconnecting: (state, action: PayloadAction<number>) => {
      state.status = 'RECONNECTING';
      state.reconnectAttempt = action.payload;
    },
    resetVideoRuntime: () => initialState,
  },
});

export const {
  setVideoSource,
  setVideoStatus,
  videoPlaying,
  videoFailed,
  videoReconnecting,
  resetVideoRuntime,
} = videoSlice.actions;

export const selectVideoRuntime = (state: RootState) => state.video;
export default videoSlice.reducer;
