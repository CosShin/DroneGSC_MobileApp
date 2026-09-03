export type AiProviderType = 'OLLAMA';

export type AiConnectionStatus = 'OFFLINE' | 'CONNECTING' | 'READY' | 'ERROR';

export type AiExecutionType = 'LOCAL' | 'CLOUD';

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
  voiceGender?: 'DEFAULT' | 'MALE' | 'FEMALE';
  voiceStyle?: 'NATURAL' | 'COPILOT' | 'CALM';
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
