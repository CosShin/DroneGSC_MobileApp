import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CommandExecutionStatus, CommandType } from '../../types/command';
import type { RootState } from '../index';

export type CommandStatus = CommandExecutionStatus;

export interface CommandState {
  lastCommand: CommandType | null;
  lastCommandStatus: CommandStatus;
  lastCommandTimestamp: number | null;
  lastCommandError: string | null;
  pendingCommand: CommandType | null;
  mavCommand: number | null;
  sentAt: number | null;
  ackAt: number | null;
  result: number | null;
  progress: number | null;
}

const initialState: CommandState = {
  lastCommand: null,
  lastCommandStatus: 'IDLE',
  lastCommandTimestamp: null,
  lastCommandError: null,
  pendingCommand: null,
  mavCommand: null,
  sentAt: null,
  ackAt: null,
  result: null,
  progress: null,
};

export const commandSlice = createSlice({
  name: 'command',
  initialState,
  reducers: {
    setPendingCommand: (state, action: PayloadAction<{ command: CommandType; mavCommand: number }>) => {
      state.pendingCommand = action.payload.command;
      state.lastCommand = action.payload.command;
      state.mavCommand = action.payload.mavCommand;
      state.lastCommandStatus = 'PENDING';
      state.lastCommandTimestamp = Date.now();
      state.sentAt = state.lastCommandTimestamp;
      state.ackAt = null;
      state.result = null;
      state.progress = null;
      state.lastCommandError = null;
    },
    setCommandAck: (state, action: PayloadAction<{ mavCommand: number; result: number; progress: number | null; ackAt: number }>) => {
      if (state.pendingCommand === null || state.mavCommand !== action.payload.mavCommand) return;
      state.ackAt = action.payload.ackAt;
      state.result = action.payload.result;
      state.progress = action.payload.progress;
      if (action.payload.result === 0 || action.payload.result === 5) state.lastCommandStatus = 'IN_PROGRESS';
      else if (action.payload.result === 2 || action.payload.result === 1 || action.payload.result === 10) state.lastCommandStatus = 'DENIED';
      else if (action.payload.result === 3 || action.payload.result === 7 || action.payload.result === 8 || action.payload.result === 9) state.lastCommandStatus = 'UNSUPPORTED';
      else state.lastCommandStatus = 'FAILED';
    },
    setCommandResult: (state, action: PayloadAction<{ status: CommandStatus; error?: string; result?: number; ackAt?: number }>) => {
      if (action.payload.status !== 'IN_PROGRESS' && action.payload.status !== 'PENDING') state.pendingCommand = null;
      state.lastCommandStatus = action.payload.status;
      state.lastCommandError = action.payload.error || null;
      if (action.payload.result !== undefined) state.result = action.payload.result;
      if (action.payload.ackAt !== undefined) state.ackAt = action.payload.ackAt;
    },
    clearCommandState: (state) => {
      state.lastCommand = null;
      state.lastCommandStatus = 'IDLE';
      state.lastCommandTimestamp = null;
      state.lastCommandError = null;
      state.pendingCommand = null;
      state.mavCommand = null;
      state.sentAt = null;
      state.ackAt = null;
      state.result = null;
      state.progress = null;
    }
  },
});

export const { setPendingCommand, setCommandAck, setCommandResult, clearCommandState } = commandSlice.actions;

export const selectCommandState = (state: RootState) => state.command;
export const selectPendingCommand = (state: RootState) => state.command.pendingCommand;

export default commandSlice.reducer;
