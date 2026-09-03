import { AiModelMetadata, AiSettings } from '../types/ai';

export const SUPPORTED_AI_MODELS: AiModelMetadata[] = [
  {
    id: 'qwen3.5:9b',
    label: 'Qwen 3.5 9B',
    execution: 'LOCAL',
    requiresInternet: false,
    supportsVision: false,
    description: 'Runs offline on your PC. Low latency & private flight operations.',
  },
  {
    id: 'gemma4:31b-cloud',
    label: 'Gemma 4 31B',
    execution: 'CLOUD',
    requiresInternet: true,
    supportsVision: true,
    description: 'Advanced reasoning via Ollama Cloud. Requires PC ollama signin & internet.',
  },
];

export function getModelMetadata(modelId: string): AiModelMetadata {
  const cleanId = (modelId || '').trim();
  const found = SUPPORTED_AI_MODELS.find(m => m.id.toLowerCase() === cleanId.toLowerCase());
  if (found) return found;

  const lower = cleanId.toLowerCase();
  const isCloud = lower.includes('cloud') || lower.includes(':cloud');
  const supportsVision = lower.includes('vision') || lower.includes('llava') || lower.includes('moondream') || lower.includes('gemma');

  return {
    id: cleanId,
    label: cleanId,
    execution: isCloud ? 'CLOUD' : 'LOCAL',
    requiresInternet: isCloud,
    supportsVision,
    description: isCloud ? 'Custom Cloud Model' : 'Custom Local Model',
  };
}

export const DEFAULT_AI_CONFIG: AiSettings = {
  enabled: true,
  provider: 'OLLAMA',
  host: '127.0.0.1',
  port: 11434,
  model: 'qwen3.5:9b',
  timeoutMs: 30000,
  autoConnect: true,
  enableFallback: false,
  fallbackModel: 'qwen3.5:9b',
  voiceEnabled: true,
  voiceRepliesEnabled: true,
  speechLanguage: 'vi-VN',
  speechRate: 1.0,
  speechPitch: 1.0,
  voiceIdentifier: null,
  voiceGender: 'DEFAULT',
  voiceStyle: 'COPILOT',
};
