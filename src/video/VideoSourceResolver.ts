import type { WebRtcVideoConfig } from './VideoTypes';

const SAFE_HOST = /^(?:\[[0-9a-fA-F:]+\]|[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)$/;
const SAFE_PATH = /^[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/;

export class VideoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoConfigError';
  }
}

export function normalizeStreamPath(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

export function validateWebRtcConfig(config: WebRtcVideoConfig): void {
  const host = config.host.trim();
  const streamPath = normalizeStreamPath(config.streamPath);
  if (!host) throw new VideoConfigError('MediaMTX host is required.');
  if (!SAFE_HOST.test(host) || host.includes('..')) {
    throw new VideoConfigError('MediaMTX host contains unsupported characters.');
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65_535) {
    throw new VideoConfigError('MediaMTX port must be between 1 and 65535.');
  }
  if (!streamPath || !SAFE_PATH.test(streamPath) || streamPath.split('/').some(segment => segment === '.' || segment === '..')) {
    throw new VideoConfigError('Stream path may contain only safe URL path characters.');
  }
}

export function buildMediaMtxWebRtcUrl(config: WebRtcVideoConfig): string {
  validateWebRtcConfig(config);
  const host = config.host.trim();
  const streamPath = normalizeStreamPath(config.streamPath);
  const query = [
    `controls=${String(config.controls)}`,
    `muted=${String(config.muted)}`,
    `autoplay=${String(config.autoplay)}`,
    `playsInline=${String(config.playsInline)}`,
    'disablepictureinpicture=true',
  ].join('&');
  return `${config.scheme}://${host}:${config.port}/${streamPath}?${query}`;
}

export function buildMediaMtxBrowserUrl(config: WebRtcVideoConfig): string {
  validateWebRtcConfig(config);
  return `${config.scheme}://${config.host.trim()}:${config.port}/${normalizeStreamPath(config.streamPath)}`;
}

export function validateRtspUrl(value: string): string {
  const raw = value.trim();
  if (!raw) throw new VideoConfigError('RTSP URL is required.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new VideoConfigError('RTSP URL is malformed.');
  }
  if (url.protocol !== 'rtsp:') throw new VideoConfigError('RTSP URL must use rtsp://.');
  if (!url.hostname) throw new VideoConfigError('RTSP host is required.');
  if (url.port && (!Number.isInteger(Number(url.port)) || Number(url.port) < 1 || Number(url.port) > 65_535)) {
    throw new VideoConfigError('RTSP port must be between 1 and 65535.');
  }
  if (url.username || url.password) {
    throw new VideoConfigError('Do not embed RTSP credentials in the URL. Secure credential storage is required.');
  }
  return raw;
}
