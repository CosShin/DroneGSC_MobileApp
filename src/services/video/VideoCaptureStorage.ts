import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { extensionForRecordingMime } from './VideoCaptureProtocol';

type MediaKind = 'photo' | 'video';

interface RecordingSession {
  file: File;
  handle: ReturnType<File['open']>;
  nextChunk: number;
  bytesWritten: number;
  maxBytes: number;
}

export interface SavedCapture {
  filename: string;
  bytes: number;
  width?: number;
  height?: number;
  durationMs?: number;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function timestampForFilename(now = new Date()) {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function saveToGalleryAndDelete(file: File) {
  await MediaLibrary.saveToLibraryAsync(file.uri);
  if (file.exists) file.delete();
}

export async function requestCapturePermission(kind: MediaKind): Promise<boolean> {
  if (!(await MediaLibrary.isAvailableAsync())) return false;
  const granular = [kind] as MediaLibrary.GranularPermission[];
  let permission = await MediaLibrary.getPermissionsAsync(true, granular);
  if (!permission.granted && permission.canAskAgain) {
    permission = await MediaLibrary.requestPermissionsAsync(true, granular);
  }
  return permission.granted;
}

export class VideoCaptureStorage {
  private readonly directory = new Directory(Paths.cache, 'anitech-captures');
  private recording: RecordingSession | null = null;

  async savePhoto(base64: string, width: number, height: number): Promise<SavedCapture> {
    this.ensureDirectory();
    const filename = `ANITECH_GCS_${timestampForFilename()}.jpg`;
    const file = new File(this.directory, filename);
    const bytes = base64ToBytes(base64);
    file.create({ overwrite: true, intermediates: true });
    file.write(bytes);

    try {
      await saveToGalleryAndDelete(file);
      return { filename, bytes: bytes.byteLength, width, height };
    } catch (error) {
      throw new Error(`PHOTO_SAVE_FAILED:${error instanceof Error ? error.message : String(error)}:${file.uri}`);
    }
  }

  beginRecording(mimeType: string, configuredMaxStorageGb: number) {
    this.abortRecording();
    this.ensureDirectory();

    const extension = extensionForRecordingMime(mimeType);
    const filename = `ANITECH_GCS_${timestampForFilename()}.${extension}`;
    const file = new File(this.directory, filename);
    file.create({ overwrite: true, intermediates: true });

    const configuredBytes = Math.max(0.1, Math.min(50, configuredMaxStorageGb || 1)) * 1024 ** 3;
    const diskSafeBytes = Math.max(0, Paths.availableDiskSpace - 100 * 1024 ** 2);
    const maxBytes = Math.min(configuredBytes, diskSafeBytes);
    if (maxBytes < 20 * 1024 ** 2) {
      file.delete();
      throw new Error('NOT_ENOUGH_STORAGE');
    }

    this.recording = {
      file,
      handle: file.open(),
      nextChunk: 0,
      bytesWritten: 0,
      maxBytes,
    };
    return filename;
  }

  appendRecordingChunk(index: number, base64: string): number {
    const session = this.recording;
    if (!session) throw new Error('NO_ACTIVE_RECORDING');
    if (index !== session.nextChunk) throw new Error(`RECORDING_CHUNK_OUT_OF_ORDER:${index}:${session.nextChunk}`);

    const bytes = base64ToBytes(base64);
    if (session.bytesWritten + bytes.byteLength > session.maxBytes) throw new Error('RECORDING_STORAGE_LIMIT_REACHED');
    session.handle.writeBytes(bytes);
    session.nextChunk += 1;
    session.bytesWritten += bytes.byteLength;
    return session.bytesWritten;
  }

  async finishRecording(durationMs: number): Promise<SavedCapture> {
    const session = this.recording;
    if (!session) throw new Error('NO_ACTIVE_RECORDING');
    this.recording = null;
    session.handle.close();

    if (session.nextChunk === 0 || session.bytesWritten === 0) {
      if (session.file.exists) session.file.delete();
      throw new Error('RECORDING_CONTAINS_NO_VIDEO_DATA');
    }

    try {
      await saveToGalleryAndDelete(session.file);
      return {
        filename: session.file.uri.split('/').pop() ?? 'ANITECH_GCS_video',
        bytes: session.bytesWritten,
        durationMs,
      };
    } catch (error) {
      throw new Error(`VIDEO_SAVE_FAILED:${error instanceof Error ? error.message : String(error)}:${session.file.uri}`);
    }
  }

  abortRecording() {
    const session = this.recording;
    this.recording = null;
    if (!session) return;
    try { session.handle.close(); } catch { /* already closed */ }
    try { if (session.file.exists) session.file.delete(); } catch { /* best effort cleanup */ }
  }

  hasActiveRecording() {
    return this.recording !== null;
  }

  private ensureDirectory() {
    if (!this.directory.exists) this.directory.create({ intermediates: true, idempotent: true });
  }
}
