import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CommandType } from '../../types/command';
import type { RootState } from '../index';

export type CommandStatus = 'IDLE' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REJECTED';

export interface CommandState {
  lastCommand: CommandType | null;
  lastCommandStatus: CommandStatus;
  lastCommandTimestamp: number | null;
  lastCommandError: string | null;
  pendingCommand: CommandType | null;
}

const initialState: CommandState = {
  lastCommand: null,
  lastCommandStatus: 'IDLE',
  lastCommandTimestamp: null,
  lastCommandError: null,
  pendingCommand: null,
};

export const commandSlice = createSlice({
  name: 'command',
  initialState,
  reducers: {
    setPendingCommand: (state, action: PayloadAction<CommandType>) => {
      state.pendingCommand = action.payload;
      state.lastCommand = action.payload;
      state.lastCommandStatus = 'PENDING';
      state.lastCommandTimestamp = Date.now();
      state.lastCommandError = null;
    },
    setCommandResult: (state, action: PayloadAction<{ status: CommandStatus; error?: string }>) => {
      state.pendingCommand = null;
      state.lastCommandStatus = action.payload.status;
      state.lastCommandError = action.payload.error || null;
      // We don't update timestamp here to keep the timestamp of when it was issued, 
      // or we can update it. Let's keep the original timestamp.
    },
    clearCommandState: (state) => {
      state.lastCommand = null;
      state.lastCommandStatus = 'IDLE';
      state.lastCommandTimestamp = null;
      state.lastCommandError = null;
      state.pendingCommand = null;
    }
  },
});

export const { setPendingCommand, setCommandResult, clearCommandState } = commandSlice.actions;

export const selectCommandState = (state: RootState) => state.command;
export const selectPendingCommand = (state: RootState) => state.command.pendingCommand;

export default commandSlice.reducer;
