import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMediaMtxBrowserUrl,
  buildMediaMtxWebRtcUrl,
  validateRtspUrl,
  VideoConfigError,
} from '../src/video/VideoSourceResolver';
import type { WebRtcVideoConfig } from '../src/video/VideoTypes';

const config: WebRtcVideoConfig = {
  scheme: 'http', host: '192.168.1.50', port: 8889, streamPath: '/landing-cam/',
  autoplay: true, muted: true, controls: false, playsInline: true, autoReconnect: true,
};

test('builds a sanitized MediaMTX player URL', () => {
  assert.equal(buildMediaMtxWebRtcUrl(config), 'http://192.168.1.50:8889/landing-cam?controls=false&muted=true&autoplay=true&playsInline=true&disablepictureinpicture=true');
  assert.equal(buildMediaMtxBrowserUrl(config), 'http://192.168.1.50:8889/landing-cam');
});

test('supports HTTPS hostnames without hardcoding a LAN address', () => {
  assert.equal(buildMediaMtxBrowserUrl({ ...config, scheme: 'https', host: 'video.anitech.example', port: 443 }), 'https://video.anitech.example:443/landing-cam');
});

test('rejects unsafe hosts, paths and ports', () => {
  assert.throws(() => buildMediaMtxWebRtcUrl({ ...config, host: 'host/path?x=1' }), VideoConfigError);
  assert.throws(() => buildMediaMtxWebRtcUrl({ ...config, streamPath: '../landing-cam' }), VideoConfigError);
  assert.throws(() => buildMediaMtxWebRtcUrl({ ...config, port: 65_536 }), VideoConfigError);
});

test('accepts RTSP URLs but rejects wrong schemes and embedded credentials', () => {
  assert.equal(validateRtspUrl(' rtsp://192.168.1.27:8554/landing-cam '), 'rtsp://192.168.1.27:8554/landing-cam');
  assert.throws(() => validateRtspUrl('http://192.168.1.27/landing-cam'), VideoConfigError);
  assert.throws(() => validateRtspUrl('rtsp://pilot:secret@192.168.1.27/landing-cam'), VideoConfigError);
});
