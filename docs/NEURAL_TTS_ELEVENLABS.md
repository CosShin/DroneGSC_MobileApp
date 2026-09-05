# ANI Neural TTS / ElevenLabs

ANI supports a provider-based speech path:

Display response -> SpokenResponseBuilder -> VoiceProvider -> ElevenLabs or System TTS fallback.

## Current Safety Rules

- Do not commit or hardcode an ElevenLabs API key.
- Do not store a long-lived TTS API key in Redux or normal persisted settings.
- Voice failure must not affect MAVLink, joystick, mission, map, video, or AI text chat.
- If ElevenLabs fails, times out, or is unconfigured, ANI falls back to System TTS.

## Development Configuration

Use `aiSpeechService.configureNeuralVoice()` with a runtime-only key while developing:

```ts
aiSpeechService.configureNeuralVoice({
  provider: 'ELEVENLABS',
  apiKey: runtimeSecret,
  voiceId: 'your_voice_id',
  modelId: 'eleven_multilingual_v2',
  language: 'vi-VN',
  timeoutMs: 8000,
}, playbackAdapter);
```

The playback adapter must play the returned `audio/mpeg` bytes and resolve when playback has started or completed.

## Production Strategy

Prefer a backend/proxy:

1. The iPhone app sends sanitized spoken text and selected non-secret voice config to your backend.
2. The backend owns the ElevenLabs API key and calls ElevenLabs.
3. The backend returns short-lived audio bytes or a short-lived signed audio URL.
4. The app plays the audio.

This keeps the secret out of distributable client builds and allows rate limiting, request logging without secrets, and operator-controlled disable switches.

## Unsupported Until Wired

The repository currently includes the ElevenLabs provider, timeout/cancel/error handling, status reporting, and fallback tests. Native audio playback for returned cloud audio still needs a production playback adapter before Neural TTS can be marked PASS on a real iPhone.
