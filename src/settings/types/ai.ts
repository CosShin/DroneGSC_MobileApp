export type AiProviderType = 'OLLAMA';

export type AiConnectionStatus = 'OFFLINE' | 'CONNECTING' | 'READY' | 'ERROR';

export type AiExecutionType = 'LOCAL' | 'CLOUD';
export type AiVoiceProviderType = 'SYSTEM_TTS' | 'ELEVENLABS';

export interface AiModelMetadata {
  id: string;
  label: string;
  execution: AiExecutionType;
  requiresInternet: boolean;
  description: string;
  supportsVision?: boolean;
}

export interface AiSettings {
  enabled: boolean;
  provider: AiProviderType;
  host: string;
  port: number;
  model: string;
  timeoutMs: number;
  autoConnect: boolean;
  enableFallback: boolean;
  fallbackModel: string;
  voiceEnabled: boolean;
  voiceRepliesEnabled: boolean;
  speechLanguage: 'vi-VN' | 'en-US';
  speechRate: number;
  speechPitch: number;
  voiceIdentifier: string | null;
  vietnameseVoiceIdentifier?: string | null;
  englishVoiceIdentifier?: string | null;
  voiceGender?: 'DEFAULT' | 'MALE' | 'FEMALE';
  voiceStyle?: 'NATURAL' | 'COPILOT' | 'CALM';
  voiceProvider?: AiVoiceProviderType;
  elevenLabsVoiceId?: string | null;
  elevenLabsModelId?: string;
  neuralVoiceLanguage?: 'vi-VN' | 'en-US';
  neuralVoiceTimeoutMs?: number;
  neuralVoiceProxyUrl?: string | null;
  ttsMuted?: boolean;
  voiceSendMode?: 'AUTO' | 'CONFIRM';
}

export interface AiDiagnosticsState {
  status: AiConnectionStatus;
  latencyMs: number | null;
  lastTestedAt: number | null;
  lastError: string | null;
  modelName: string | null;
  serverVersion: string | null;
  executionType?: AiExecutionType;
}
