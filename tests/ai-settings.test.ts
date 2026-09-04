import test from 'node:test';
import assert from 'node:assert/strict';
import { configureStore } from '@reduxjs/toolkit';
import settingsReducer, {
  hydrateSettings,
  selectAiSettings,
  updateAiSettings,
} from '../src/store/settings/settingsSlice';
import { DEFAULT_AI_CONFIG, SUPPORTED_AI_MODELS, getModelMetadata } from '../src/settings/defaults/ai';
import { DEFAULT_PI_CONFIG } from '../src/settings/defaults/pi';
import { DEFAULT_CAMERA_CONFIG } from '../src/settings/defaults/camera';
import { DEFAULT_TELEMETRY_CONFIG } from '../src/settings/defaults/telemetry';
import { DEFAULT_JOYSTICK_CONFIG } from '../src/settings/defaults/joystick';

test('settingsSlice initializes with DEFAULT_AI_CONFIG including fallback and voice defaults', () => {
  const store = configureStore({
    reducer: { settings: settingsReducer },
  });

  const ai = selectAiSettings(store.getState());
  assert.equal(ai.enabled, true);
  assert.equal(ai.provider, 'OLLAMA');
  assert.equal(ai.model, 'qwen3.5:9b');
  assert.equal(ai.port, 11434);
  assert.equal(ai.enableFallback, false);
  assert.equal(ai.fallbackModel, 'qwen3.5:9b');
  assert.equal(ai.voiceEnabled, true);
  assert.equal(ai.voiceRepliesEnabled, true);
  assert.equal(ai.speechLanguage, 'vi-VN');
  assert.equal(ai.speechRate, 1.0);
  assert.equal(ai.speechPitch, 1.0);
  assert.equal(ai.voiceIdentifier, null);
});

test('SUPPORTED_AI_MODELS contains both Qwen Local and Gemma Cloud presets', () => {
  const qwen = SUPPORTED_AI_MODELS.find(m => m.id === 'qwen3.5:9b');
  assert.ok(qwen);
  assert.equal(qwen.execution, 'LOCAL');
  assert.equal(qwen.requiresInternet, false);

  const gemma = SUPPORTED_AI_MODELS.find(m => m.id === 'gemma4:31b-cloud');
  assert.ok(gemma);
  assert.equal(gemma.execution, 'CLOUD');
  assert.equal(gemma.requiresInternet, true);
});

test('getModelMetadata resolves execution type correctly without arbitrary guessing', () => {
  const qwenMeta = getModelMetadata('qwen3.5:9b');
  assert.equal(qwenMeta.execution, 'LOCAL');
  assert.equal(qwenMeta.requiresInternet, false);

  const gemmaMeta = getModelMetadata('gemma4:31b-cloud');
  assert.equal(gemmaMeta.execution, 'CLOUD');
  assert.equal(gemmaMeta.requiresInternet, true);

  const customCloud = getModelMetadata('custom-model-cloud');
  assert.equal(customCloud.execution, 'CLOUD');

  const customLocal = getModelMetadata('llama3:8b');
  assert.equal(customLocal.execution, 'LOCAL');
});

test('settingsSlice updateAiSettings modifies model and fallback configuration', () => {
  const store = configureStore({
    reducer: { settings: settingsReducer },
  });

  store.dispatch(updateAiSettings({
    host: '100.115.92.1',
    port: 11434,
    model: 'gemma4:31b-cloud',
    enableFallback: true,
    fallbackModel: 'qwen3.5:9b',
    voiceEnabled: false,
    speechLanguage: 'en-US',
    speechRate: 1.2,
    speechPitch: 0.8,
    voiceIdentifier: 'com.apple.speech.synthesis.voice.custom',
    timeoutMs: 45000,
  }));

  const ai = selectAiSettings(store.getState());
  assert.equal(ai.host, '100.115.92.1');
  assert.equal(ai.model, 'gemma4:31b-cloud');
  assert.equal(ai.enableFallback, true);
  assert.equal(ai.fallbackModel, 'qwen3.5:9b');
  assert.equal(ai.voiceEnabled, false);
  assert.equal(ai.speechLanguage, 'en-US');
  assert.equal(ai.speechRate, 1.2);
  assert.equal(ai.speechPitch, 0.8);
  assert.equal(ai.voiceIdentifier, 'com.apple.speech.synthesis.voice.custom');
  assert.equal(ai.timeoutMs, 45000);
});

test('settingsSlice hydrateSettings merges incoming AI configuration backwards-compatibly', () => {
  const store = configureStore({
    reducer: { settings: settingsReducer },
  });

  // Incoming settings without fallback fields (e.g. from previous app version)
  store.dispatch(hydrateSettings({
    ai: {
      enabled: true,
      provider: 'OLLAMA',
      host: '192.168.1.50',
      port: 11434,
      model: 'gemma4:31b-cloud',
      timeoutMs: 30000,
      autoConnect: true,
    } as any,
  }));

  const ai = selectAiSettings(store.getState());
  assert.equal(ai.host, '192.168.1.50');
  assert.equal(ai.model, 'gemma4:31b-cloud');
  assert.equal(ai.enableFallback, false);
  assert.equal(ai.fallbackModel, 'qwen3.5:9b');
  assert.equal(ai.speechPitch, 1.0);
  assert.equal(ai.voiceIdentifier, null);
});

test('settings hydration deep-merges every persisted subsystem and marks startup ready', () => {
  const store = configureStore({ reducer: { settings: settingsReducer } });
  store.dispatch(hydrateSettings({
    piGateway: { gatewayIp: '10.1.2.3' } as any,
    camera: { zoomLevel: 2 } as any,
    telemetry: { gpsUpdateRateHz: 2 } as any,
    joystick: { deadzone: 0.2 } as any,
  }));

  const settings = store.getState().settings;
  assert.equal(settings.hydrated, true);
  assert.equal(settings.piGateway.gatewayIp, '10.1.2.3');
  assert.equal(settings.piGateway.mavlinkPort, DEFAULT_PI_CONFIG.mavlinkPort);
  assert.equal(settings.camera.zoomLevel, 2);
  assert.equal(settings.camera.focusMode, DEFAULT_CAMERA_CONFIG.focusMode);
  assert.equal(settings.telemetry.gpsUpdateRateHz, 2);
  assert.equal(settings.telemetry.attitudeUpdateRateHz, DEFAULT_TELEMETRY_CONFIG.attitudeUpdateRateHz);
  assert.equal(settings.joystick.deadzone, 0.2);
  assert.equal(settings.joystick.updateRateHz, DEFAULT_JOYSTICK_CONFIG.updateRateHz);
});
