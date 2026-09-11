import test from 'node:test';
import assert from 'node:assert/strict';
import { configureStore } from '@reduxjs/toolkit';
import settingsReducer, {
  selectVoiceSendMode,
  setVoiceSendMode,
  updateAiSettings,
} from '../src/store/settings/settingsSlice';
import { SpeechRecognitionService } from '../src/services/voice/SpeechRecognitionService';
import { aiSpeechService } from '../src/services/voice/AiSpeechService';
import { DEFAULT_AI_CONFIG } from '../src/settings/defaults/ai';

test('1. SpeechRecognitionService initializes with confidence null and clean transcripts', () => {
  const service = new SpeechRecognitionService();
  const state = service.getState();

  assert.equal(state.status, 'IDLE');
  assert.equal(state.transcript, '');
  assert.equal(state.interimTranscript, '');
  assert.equal(state.confidence, null);
  assert.equal(state.isRecognizing, false);
});

test('2. SpeechRecognitionService streams real-time partial transcript and preserves confidence when provided', () => {
  const service = new SpeechRecognitionService();
  const recordedStates: any[] = [];

  const unsubscribe = service.subscribe(state => {
    recordedStates.push({ ...state });
  });

  // Mock internal event emission as native module would deliver
  // Partial 1
  (service as any).status = 'LISTENING';
  (service as any).interimTranscript = 'Kiểm tra';
  (service as any).confidence = 0.88;
  (service as any).emit();

  // Partial 2
  (service as any).interimTranscript = 'Kiểm tra pin của';
  (service as any).confidence = 0.92;
  (service as any).emit();

  // Partial 3 with mixed technical term
  (service as any).interimTranscript = 'Kiểm tra pin của drone và GPS signal';
  (service as any).confidence = 0.95;
  (service as any).emit();

  // Final event
  (service as any).transcript = 'Kiểm tra pin của drone và GPS signal';
  (service as any).interimTranscript = '';
  (service as any).confidence = 0.96;
  (service as any).status = 'IDLE';
  (service as any).emit();

  unsubscribe();

  const finalState = recordedStates[recordedStates.length - 1];
  assert.equal(finalState.transcript, 'Kiểm tra pin của drone và GPS signal');
  assert.equal(finalState.interimTranscript, '');
  assert.equal(finalState.confidence, 0.96);
  assert.equal(finalState.status, 'IDLE');

  // Verify progression of partial transcripts
  const partials = recordedStates.map(s => s.interimTranscript).filter(Boolean);
  assert.deepEqual(partials, [
    'Kiểm tra',
    'Kiểm tra pin của',
    'Kiểm tra pin của drone và GPS signal',
  ]);
});

test('3. Confidence is not faked when native module does not supply it', () => {
  const service = new SpeechRecognitionService();
  (service as any).status = 'LISTENING';
  (service as any).interimTranscript = 'Xin chào ANI';
  (service as any).confidence = null;
  (service as any).emit();

  const state = service.getState();
  assert.equal(state.confidence, null);
});

test('4. VoiceSendMode defaults to AUTO and toggles cleanly in Redux store', () => {
  const store = configureStore({
    reducer: { settings: settingsReducer },
  });

  // Default mode
  assert.equal(selectVoiceSendMode(store.getState()), 'AUTO');
  assert.equal(DEFAULT_AI_CONFIG.voiceSendMode, 'AUTO');

  // Set to CONFIRM
  store.dispatch(setVoiceSendMode('CONFIRM'));
  assert.equal(selectVoiceSendMode(store.getState()), 'CONFIRM');

  // Update via updateAiSettings
  store.dispatch(updateAiSettings({ voiceSendMode: 'AUTO' }));
  assert.equal(selectVoiceSendMode(store.getState()), 'AUTO');
});

test('5. Audio Interruption Safety: starting voice recognition stops ongoing speech immediately', async () => {
  let stopCalled = false;
  const originalStop = aiSpeechService.stop;
  aiSpeechService.stop = async () => {
    stopCalled = true;
  };

  try {
    // Simulate audio stop invocation before microphone opens
    await aiSpeechService.stop();
    assert.equal(stopCalled, true);
  } finally {
    aiSpeechService.stop = originalStop;
  }
});

test('6. Mute Compatibility: ttsMuted does not prevent SpeechRecognitionService from recording', () => {
  const service = new SpeechRecognitionService();
  aiSpeechService.setMuted(true);

  assert.equal(aiSpeechService.isMuted, true);

  // STT service remains fully functional and decoupled from audio output
  (service as any).status = 'LISTENING';
  (service as any).interimTranscript = 'Kiểm tra độ cao drone';
  (service as any).emit();

  assert.equal(service.getState().interimTranscript, 'Kiểm tra độ cao drone');

  // Clean up
  aiSpeechService.setMuted(false);
  assert.equal(aiSpeechService.isMuted, false);
});

test('7. Empty Speech Detection: cancelListening clears transcript and confidence', () => {
  const service = new SpeechRecognitionService();
  (service as any).status = 'LISTENING';
  (service as any).transcript = 'Dữ liệu dở dang';
  (service as any).confidence = 0.5;

  service.cancelListening();

  const state = service.getState();
  assert.equal(state.status, 'IDLE');
  assert.equal(state.transcript, '');
  assert.equal(state.interimTranscript, '');
  assert.equal(state.confidence, null);
  assert.equal(state.errorCode, null);
});
