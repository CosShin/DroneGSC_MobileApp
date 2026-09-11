import test from 'node:test';
import assert from 'node:assert/strict';
import { configureStore } from '@reduxjs/toolkit';
import { aiSpeechService, AiSpeechService } from '../src/services/voice/AiSpeechService';
import { AniSpeechQueue, QueueSegmentItem } from '../src/services/voice/AniSpeechQueue';
import { ISpeechProvider, VoiceProviderStatus } from '../src/services/voice/SpeechProvider';
import { aiService } from '../src/services/ai/AiService';
import { aiClient } from '../src/services/ai/AiClient';
import settingsReducer, {
  setAiMuted,
  toggleAiMute,
  selectAiTtsMuted,
  hydrateSettings,
} from '../src/store/settings/settingsSlice';
import connectionReducer, {
  setDetectedVehicle,
  setHeartbeat,
  setLinkState,
  setStatus,
  updateConnectionHealth,
} from '../src/store/connection/connectionSlice';
import droneReducer, { setArmed, setFlightMode } from '../src/store/drone/droneSlice';
import telemetryReducer, { updateBattery, updateGps } from '../src/store/telemetry/telemetrySlice';
import homeReducer from '../src/store/home/homeSlice';
import commandReducer from '../src/store/command/commandSlice';
import videoReducer from '../src/store/videoSlice';
import { SpeechRecognitionService } from '../src/services/voice/SpeechRecognitionService';
import { DEFAULT_CONNECTION_CONFIG } from '../src/settings/defaults/connection';
import { DEFAULT_MAVLINK_CONFIG } from '../src/settings/defaults/mavlink';
import { DEFAULT_PI_CONFIG } from '../src/settings/defaults/pi';
import { DEFAULT_VIDEO_CONFIG } from '../src/settings/defaults/video';
import { DEFAULT_CAMERA_CONFIG } from '../src/settings/defaults/camera';
import { DEFAULT_TELEMETRY_CONFIG } from '../src/settings/defaults/telemetry';
import { DEFAULT_JOYSTICK_CONFIG } from '../src/settings/defaults/joystick';
import { DEFAULT_AI_CONFIG } from '../src/settings/defaults/ai';
import { emptyConnectionHealth } from '../src/services/connection/ConnectionHealth';

function createTestStore(initialMuted = false) {
  const store = configureStore({
    reducer: {
      settings: settingsReducer,
      connection: connectionReducer,
      drone: droneReducer,
      telemetry: telemetryReducer,
      home: homeReducer,
      command: commandReducer,
      video: videoReducer,
      mission: () => ({ items: [], selectedItemId: null, syncStatus: 'UNSYNCED', syncProgress: 0, rawWireItems: [], verifyResult: null }),
    },
    preloadedState: {
      settings: {
        hydrated: true,
        showJoysticks: true,
        showTelemetry: true,
        mainViewMode: 'HUD',
        flightDisplayMode: 'HUD',
        flightDisplayManual: false,
        connection: DEFAULT_CONNECTION_CONFIG,
        connectionProfiles: [],
        mavlink: DEFAULT_MAVLINK_CONFIG,
        piGateway: DEFAULT_PI_CONFIG,
        video: DEFAULT_VIDEO_CONFIG,
        camera: DEFAULT_CAMERA_CONFIG,
        telemetry: DEFAULT_TELEMETRY_CONFIG,
        joystick: DEFAULT_JOYSTICK_CONFIG,
        ai: {
          ...DEFAULT_AI_CONFIG,
          enabled: true,
          voiceEnabled: true,
          voiceRepliesEnabled: true,
          ttsMuted: initialMuted,
        },
        isAiAssistantOpen: false,
        aiFloatingPosition: null,
      },
      home: {
        status: 'SET',
        position: { latitude: 10.8231, longitude: 106.6297, altitude: 0 },
        accuracyMeters: 5,
        updatedAt: Date.now(),
      } as any,
    },
    middleware: getDefaultMiddleware => getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
    }),
  });

  const now = Date.now();
  store.dispatch(setStatus('CONNECTED'));
  store.dispatch(updateConnectionHealth({
    ...emptyConnectionHealth(),
    networkStatus: 'CONNECTED',
    mavlinkStatus: 'HEARTBEAT_OK',
    vehicleStatus: 'AVAILABLE',
    controlStatus: 'READY',
    controlAvailable: true,
    linkQuality: 'GOOD',
    linkQualityScore: 85,
    lastHeartbeatAt: now - 50,
    heartbeatAgeMs: 50,
    transport: 'WEBSOCKET',
    transportStatus: 'READY',
    updatedAt: now,
  }));
  store.dispatch(setDetectedVehicle({ name: 'ArduCopter SYS1', vehicleType: 'COPTER', autopilot: 'ARDUPILOT' }));
  store.dispatch(setLinkState({
    phase: 'VEHICLE_CONNECTED',
    network: 'BOUND',
    mavlink: 'ACTIVE',
    vehicle: 'CONNECTED',
    error: null,
  }));
  store.dispatch(setHeartbeat(now - 50));
  store.dispatch(setFlightMode('LOITER'));
  store.dispatch(setArmed(true));
  store.dispatch(updateBattery({ timestamp: now - 50, value: { voltage: 15.6, current: 1.2, percentage: 73 } }));
  store.dispatch(updateGps({
    timestamp: now - 50,
    value: {
      latitude: 10.8231,
      longitude: 106.6297,
      altitude: 8.5,
      satellites: 14,
      gpsFix: 3,
      hdop: 0.8,
    },
  }));

  return store;
}

class MockSpeechProvider implements ISpeechProvider {
  public speaking = false;
  public speakLog: string[] = [];
  public stopCallCount = 0;

  isSpeaking(): boolean {
    return this.speaking;
  }

  isAvailable(): boolean {
    return true;
  }

  getStatus(): VoiceProviderStatus {
    return {
      provider: 'SYSTEM_TTS',
      state: this.speaking ? 'SPEAKING' : 'READY',
      lastError: null,
    };
  }

  async getAvailableVoices() {
    return [];
  }

  async speak(text: string): Promise<void> {
    this.speaking = true;
    this.speakLog.push(text);
  }

  async stop(): Promise<void> {
    this.speaking = false;
    this.stopCallCount++;
  }
}

test('TEST 1: ANI is speaking -> Tap Mute -> audio stops immediately and state becomes IDLE', async () => {
  const mockProvider = new MockSpeechProvider();
  const tts = new AiSpeechService(mockProvider);

  let reportedSpeaking: boolean | null = null;
  tts.subscribe(s => { reportedSpeaking = s; });

  // 1. Simulate speech in progress
  await tts.speak('Drone đang ở LOITER, độ cao 10 mét.');
  assert.equal(mockProvider.speaking, true);
  assert.equal(tts.isSpeaking, true);
  assert.equal(tts.isMuted, false);

  // 2. User taps Mute
  await tts.mute();

  // 3. Audio must stop immediately
  assert.equal(tts.isMuted, true);
  assert.equal(mockProvider.speaking, false);
  assert.equal(tts.isSpeaking, false);
  assert.equal(mockProvider.stopCallCount, 2); // 1 from speak interruption + 1 from mute
});

test('TEST 2: Muted -> Ask ANI a new question -> text response displayed, NO audio played', async () => {
  const store = createTestStore(true); // preloaded with ttsMuted: true
  aiService.setStore(store as any);
  aiService.clearChat();
  aiSpeechService.setMuted(true);

  let speechTriggered = false;
  const originalSpeak = aiSpeechService.speak.bind(aiSpeechService);
  (aiSpeechService as any).speak = async (text: string) => {
    speechTriggered = true;
    return originalSpeak(text);
  };

  const originalChat = aiClient.chat.bind(aiClient);
  (aiClient as any).chat = async () => {
    return {
      content: 'Drone đang ở LOITER, pin 73%, độ cao 8.5 mét.',
      latencyMs: 20,
    };
  };

  try {
    await aiService.sendUserMessage('Drone hiện tại sao?', { source: 'text' });

    // 1. Text response MUST be present in messages
    const msgs = aiService.getState().messages;
    const assistantMsg = msgs[msgs.length - 1];
    assert.equal(assistantMsg.role, 'assistant');
    assert.ok(assistantMsg.content.includes('LOITER') || assistantMsg.content.includes('73%'));

    // 2. Audio MUST NOT be played
    assert.equal(speechTriggered, false, 'Speech.speak must NOT be called when muted');
    assert.equal(aiSpeechService.isSpeaking, false);
  } finally {
    aiSpeechService.speak = originalSpeak;
    (aiClient as any).chat = originalChat;
    aiSpeechService.unmute();
    aiService.setStore(null);
  }
});

test('TEST 3: Unmute -> Ask ANI new question -> text + audio both occur without replaying old messages', async () => {
  const store = createTestStore(false); // unmuted
  aiService.setStore(store as any);
  aiService.clearChat();
  aiSpeechService.unmute();

  let spokenTexts: string[] = [];
  const originalSpeak = aiSpeechService.speak.bind(aiSpeechService);
  (aiSpeechService as any).speak = async (text: string) => {
    spokenTexts.push(text);
  };

  const originalChat = aiClient.chat.bind(aiClient);
  (aiClient as any).chat = async () => {
    return {
      content: 'Drone đang ở LOITER, pin 73%.',
      latencyMs: 15,
    };
  };

  try {
    // 1. Ensure unmuted
    assert.equal(aiSpeechService.isMuted, false);

    // 2. Ask question
    await aiService.sendUserMessage('Drone hiện tại sao?', { source: 'text' });

    // 3. Verify text AND audio are produced
    assert.equal(spokenTexts.length, 1);
    assert.ok(spokenTexts[0].includes('LOITER') || spokenTexts[0].includes('Pin') || spokenTexts[0].includes('73%'));

    // 4. Mute and then Unmute again
    await aiSpeechService.mute();
    spokenTexts = [];
    aiSpeechService.unmute();

    // Verify unmute DOES NOT replay previously muted or spoken message
    assert.equal(spokenTexts.length, 0, 'Unmuting must NOT replay old messages');
  } finally {
    aiSpeechService.speak = originalSpeak;
    (aiClient as any).chat = originalChat;
    aiService.setStore(null);
  }
});

test('TEST 4: Mute while ANI is speaking mixed Vietnamese/English -> current stops, remaining segments canceled', async () => {
  const nativeLog: string[] = [];
  let nativeStopCalled = false;

  const queue = new AniSpeechQueue(
    (text, opts) => {
      nativeLog.push(`START: ${text} (${opts.language})`);
      // Simulate playback taking 30ms
      setTimeout(() => {
        nativeLog.push(`DONE: ${text}`);
        opts.onDone?.();
      }, 30);
    },
    async () => {
      nativeStopCalled = true;
      nativeLog.push('NATIVE_STOP');
    }
  );

  const segments: QueueSegmentItem[] = [
    { text: 'Pin hiện tại còn 75 phần trăm.', lang: 'vi-VN' },
    { text: 'GPS signal is good.', lang: 'en-US' },
    { text: 'Drone đang ở LOITER.', lang: 'vi-VN' },
  ];

  // Start playing mixed segments
  void queue.play(segments);

  // Wait 10ms (while segment 1 is actively playing)
  await new Promise(r => setTimeout(r, 10));
  assert.equal(queue.isSpeaking, true);
  assert.ok(nativeLog.some(l => l.includes('Pin hiện tại còn 75 phần trăm')));

  // Mute immediately
  await queue.stop();

  assert.equal(nativeStopCalled, true);
  assert.equal(queue.isSpeaking, false);

  // Wait 60ms to verify subsequent segments (English & Vietnamese) NEVER start
  await new Promise(r => setTimeout(r, 60));

  const startedEnglish = nativeLog.some(l => l.includes('GPS signal is good'));
  const startedSegment3 = nativeLog.some(l => l.includes('Drone đang ở LOITER'));

  assert.equal(startedEnglish, false, 'English segment 2 must NOT be played after mute');
  assert.equal(startedSegment3, false, 'Vietnamese segment 3 must NOT be played after mute');
});

test('TEST 5: Mute ANI -> Restart app (hydrateSettings) -> ANI remains muted', () => {
  // 1. User mutes ANI in active app session
  const store1 = createTestStore(false);
  assert.equal(selectAiTtsMuted(store1.getState()), false);

  store1.dispatch(setAiMuted(true));
  assert.equal(selectAiTtsMuted(store1.getState()), true);

  // Saved state to storage
  const persistedAiSettings = store1.getState().settings.ai;
  assert.equal(persistedAiSettings.ttsMuted, true);

  // 2. User restarts app (brand new store created and hydrated from storage)
  const store2 = createTestStore(false);
  assert.equal(selectAiTtsMuted(store2.getState()), false); // fresh default

  // Hydration loads persisted settings
  store2.dispatch(hydrateSettings({ ai: persistedAiSettings }));
  assert.equal(selectAiTtsMuted(store2.getState()), true, 'Hydrated store must retain ttsMuted: true');

  // Toggle mute
  store2.dispatch(toggleAiMute());
  assert.equal(selectAiTtsMuted(store2.getState()), false, 'toggleAiMute toggles to false');
  store2.dispatch(toggleAiMute());
  assert.equal(selectAiTtsMuted(store2.getState()), true, 'toggleAiMute toggles back to true');
});

test('TEST 6: Muted but user uses microphone -> STT works, AI answers in text, TTS does not speak', async () => {
  const store = createTestStore(true); // muted
  aiService.setStore(store as any);
  aiService.clearChat();
  aiSpeechService.setMuted(true);

  let speechTriggered = false;
  const originalSpeak = aiSpeechService.speak.bind(aiSpeechService);
  (aiSpeechService as any).speak = async (text: string) => {
    speechTriggered = true;
    return originalSpeak(text);
  };

  const stt = new SpeechRecognitionService();
  assert.equal(stt.getState().status, 'IDLE');

  // Simulate user speech transcribed by STT
  const transcriptFromVoice = 'Kiểm tra pin';

  const originalChat = aiClient.chat.bind(aiClient);
  (aiClient as any).chat = async () => {
    return {
      content: 'Pin hiện tại còn 73%, điện áp 15.6V.',
      latencyMs: 12,
    };
  };

  try {
    // 1. Voice input submitted to AI
    await aiService.sendUserMessage(transcriptFromVoice, { source: 'voice' });

    // 2. AI response is present in text chat
    const messages = aiService.getState().messages;
    const lastMsg = messages[messages.length - 1];
    assert.equal(lastMsg.role, 'assistant');
    assert.ok(lastMsg.content.includes('73%') || lastMsg.content.includes('15.6V'));

    // 3. TTS is completely silenced (no audio)
    assert.equal(speechTriggered, false, 'TTS must not speak even for voice query when muted');
    assert.equal(aiSpeechService.isSpeaking, false);
  } finally {
    aiSpeechService.speak = originalSpeak;
    (aiClient as any).chat = originalChat;
    aiSpeechService.unmute();
    aiService.setStore(null);
  }
});
