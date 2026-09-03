import test from 'node:test';
import assert from 'node:assert/strict';
import { configureStore } from '@reduxjs/toolkit';
import { aiService } from '../src/services/ai/AiService';
import { aiClient } from '../src/services/ai/AiClient';
import settingsReducer, { updateAiSettings } from '../src/store/settings/settingsSlice';
import telemetryReducer from '../src/store/telemetry/telemetrySlice';
import droneReducer from '../src/store/drone/droneSlice';
import connectionReducer from '../src/store/connection/connectionSlice';
import homeReducer from '../src/store/home/homeSlice';

function createTestStore() {
  const s = configureStore({
    reducer: {
      settings: settingsReducer,
      telemetry: telemetryReducer,
      drone: droneReducer,
      connection: connectionReducer,
      home: homeReducer,
      mission: () => ({ items: [] }),
    },
  });
  aiService.setStore(s);
  return s;
}

test('AiService executePrompt successfully uses Gemma Cloud when cloud is reachable', async () => {
  const store = createTestStore();
  store.dispatch(updateAiSettings({
    enabled: true,
    model: 'gemma4:31b-cloud',
    enableFallback: true,
    fallbackModel: 'qwen3.5:9b',
  }));

  const originalChat = aiClient.chat.bind(aiClient);
  const modelsRequested: string[] = [];

  (aiClient as any).chat = async (_msgs: any, settings: any) => {
    modelsRequested.push(settings.model);
    return {
      content: 'Gemma 4 response: Flight systems normal.',
      latencyMs: 150,
    };
  };

  try {
    await aiService.sendUserMessage('Test cloud query');
    const state = aiService.getState();
    const lastMsg = state.messages[state.messages.length - 1];

    assert.equal(modelsRequested.length, 1);
    assert.equal(modelsRequested[0], 'gemma4:31b-cloud');
    assert.ok(lastMsg.content.includes('Gemma 4 response'));
    assert.equal(lastMsg.status, 'success');
  } finally {
    (aiClient as any).chat = originalChat;
  }
});

test('AiService executePrompt retries ONCE with local fallback when cloud fails and fallback is enabled', async () => {
  const store = createTestStore();
  store.dispatch(updateAiSettings({
    enabled: true,
    model: 'gemma4:31b-cloud',
    enableFallback: true,
    fallbackModel: 'qwen3.5:9b',
  }));

  const originalChat = aiClient.chat.bind(aiClient);
  const modelsRequested: string[] = [];

  (aiClient as any).chat = async (_msgs: any, settings: any) => {
    modelsRequested.push(settings.model);
    if (settings.model === 'gemma4:31b-cloud') {
      throw new Error('INTERNET / CLOUD CONNECTION FAILED');
    }
    return {
      content: 'Qwen fallback response: All parameters nominal.',
      latencyMs: 80,
    };
  };

  try {
    await aiService.sendUserMessage('Analyze telemetry');
    const state = aiService.getState();
    const lastMsg = state.messages[state.messages.length - 1];

    // Verifies single retry with fallback model:
    assert.equal(modelsRequested.length, 2);
    assert.equal(modelsRequested[0], 'gemma4:31b-cloud');
    assert.equal(modelsRequested[1], 'qwen3.5:9b');

    // Verifies explicit disclosure tag prepended to response
    assert.ok(lastMsg.content.includes('[Using local fallback: qwen3.5:9b]'));
    assert.ok(lastMsg.content.includes('Qwen fallback response'));
    assert.equal(lastMsg.status, 'success');
  } finally {
    (aiClient as any).chat = originalChat;
  }
});

test('AiService executePrompt does NOT fallback when enableFallback is false', async () => {
  const store = createTestStore();
  store.dispatch(updateAiSettings({
    enabled: true,
    model: 'gemma4:31b-cloud',
    enableFallback: false,
    fallbackModel: 'qwen3.5:9b',
  }));

  const originalChat = aiClient.chat.bind(aiClient);
  const modelsRequested: string[] = [];

  (aiClient as any).chat = async (_msgs: any, settings: any) => {
    modelsRequested.push(settings.model);
    throw new Error('OLLAMA CLOUD AUTH REQUIRED');
  };

  try {
    await aiService.sendUserMessage('Preflight check');
    const state = aiService.getState();
    const lastMsg = state.messages[state.messages.length - 1];

    // Only one attempt made; no fallback attempt
    assert.equal(modelsRequested.length, 1);
    assert.equal(modelsRequested[0], 'gemma4:31b-cloud');
    assert.equal(lastMsg.status, 'error');
    assert.ok(lastMsg.content.includes('OLLAMA CLOUD AUTH REQUIRED'));
  } finally {
    (aiClient as any).chat = originalChat;
  }
});

test('Switching active model immediately takes effect on next request without app restart', async () => {
  const store = createTestStore();
  const originalChat = aiClient.chat.bind(aiClient);
  let lastUsedModel = '';

  (aiClient as any).chat = async (_msgs: any, settings: any) => {
    lastUsedModel = settings.model;
    return { content: 'OK', latencyMs: 50 };
  };

  try {
    // 1. Send with Qwen
    store.dispatch(updateAiSettings({ model: 'qwen3.5:9b' }));
    await aiService.sendUserMessage('Msg 1');
    assert.equal(lastUsedModel, 'qwen3.5:9b');

    // 2. Switch to Gemma Cloud
    store.dispatch(updateAiSettings({ model: 'gemma4:31b-cloud' }));
    await aiService.sendUserMessage('Msg 2');
    assert.equal(lastUsedModel, 'gemma4:31b-cloud');
  } finally {
    (aiClient as any).chat = originalChat;
  }
});

test('AI cloud failure leaves vehicle connection and flight state completely untouched', async () => {
  const store = createTestStore();
  const originalChat = aiClient.chat.bind(aiClient);

  (aiClient as any).chat = async () => {
    throw new Error('INTERNET / CLOUD CONNECTION FAILED');
  };

  try {
    const droneBefore = store.getState().drone;
    const connBefore = store.getState().connection;

    await aiService.sendUserMessage('Preflight');

    const droneAfter = store.getState().drone;
    const connAfter = store.getState().connection;

    assert.deepEqual(droneAfter, droneBefore);
    assert.deepEqual(connAfter, connBefore);
  } finally {
    (aiClient as any).chat = originalChat;
  }
});
