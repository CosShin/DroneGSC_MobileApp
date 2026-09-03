export const CAPTURE_PROTOCOL = 'ANITECH_CAPTURE';
export const MAX_PHOTO_BASE64_LENGTH = 24 * 1024 * 1024;
export const MAX_VIDEO_CHUNK_BASE64_LENGTH = 8 * 1024 * 1024;

const SESSION_ID = /^[A-Za-z0-9_-]{8,80}$/;
const MIME_TYPE = /^video\/(?:mp4|webm)(?:;[A-Za-z0-9=., _-]+)?$/i;

export type VideoCaptureMessage =
  | { type: 'PHOTO_RESULT'; sessionId: string; base64: string; width: number; height: number }
  | { type: 'RECORDING_STARTED'; sessionId: string; mimeType: string }
  | { type: 'RECORDING_CHUNK'; sessionId: string; index: number; base64: string }
  | { type: 'RECORDING_STOPPED'; sessionId: string; mimeType: string; durationMs: number }
  | { type: 'CAPTURE_ERROR'; sessionId: string | null; operation: 'photo' | 'recording'; message: string };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID.test(value);
}

function validBase64(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}

export function parseVideoCaptureMessage(raw: string): VideoCaptureMessage | null {
  if (!raw.startsWith('{') || raw.length > MAX_PHOTO_BASE64_LENGTH + 2_048) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.protocol !== CAPTURE_PROTOCOL || value.version !== 1) return null;

  if (value.type === 'PHOTO_RESULT') {
    if (!validSessionId(value.sessionId) || !validBase64(value.base64, MAX_PHOTO_BASE64_LENGTH)) return null;
    if (!Number.isInteger(value.width) || !Number.isInteger(value.height)) return null;
    const width = value.width as number;
    const height = value.height as number;
    if (width < 1 || height < 1 || width > 8_192 || height > 8_192) return null;
    return { type: 'PHOTO_RESULT', sessionId: value.sessionId, base64: value.base64, width, height };
  }

  if (value.type === 'RECORDING_STARTED') {
    if (!validSessionId(value.sessionId) || typeof value.mimeType !== 'string' || !MIME_TYPE.test(value.mimeType)) return null;
    return { type: 'RECORDING_STARTED', sessionId: value.sessionId, mimeType: value.mimeType };
  }

  if (value.type === 'RECORDING_CHUNK') {
    if (!validSessionId(value.sessionId) || !validBase64(value.base64, MAX_VIDEO_CHUNK_BASE64_LENGTH)) return null;
    if (!Number.isInteger(value.index) || (value.index as number) < 0 || (value.index as number) > 1_000_000) return null;
    return { type: 'RECORDING_CHUNK', sessionId: value.sessionId, index: value.index as number, base64: value.base64 };
  }

  if (value.type === 'RECORDING_STOPPED') {
    if (!validSessionId(value.sessionId) || typeof value.mimeType !== 'string' || !MIME_TYPE.test(value.mimeType)) return null;
    if (typeof value.durationMs !== 'number' || !Number.isFinite(value.durationMs) || value.durationMs < 0) return null;
    return { type: 'RECORDING_STOPPED', sessionId: value.sessionId, mimeType: value.mimeType, durationMs: value.durationMs };
  }

  if (value.type === 'CAPTURE_ERROR') {
    const sessionId = value.sessionId === null ? null : validSessionId(value.sessionId) ? value.sessionId : null;
    if (value.operation !== 'photo' && value.operation !== 'recording') return null;
    if (typeof value.message !== 'string' || !value.message.trim() || value.message.length > 500) return null;
    return { type: 'CAPTURE_ERROR', sessionId, operation: value.operation, message: value.message.trim() };
  }

  return null;
}

export function createCaptureSessionId(kind: 'photo' | 'video', now = Date.now(), random = Math.random()): string {
  return `${kind}_${now.toString(36)}_${Math.floor(random * 0x1_0000_0000).toString(36).padStart(6, '0')}`;
}

export function extensionForRecordingMime(mimeType: string): 'mp4' | 'webm' {
  return mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
}

export function formatRecordingDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
