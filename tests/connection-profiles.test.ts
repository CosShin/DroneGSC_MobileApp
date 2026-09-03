import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CONNECTION_CONFIG } from '../src/settings/defaults/connection';
import { applyNetworkProfile, createSavedConnectionProfile } from '../src/services/connection/ConnectionProfiles';
import { isValidHost, isValidPort, validateConnectionConfig, validateWebSocketUrl } from '../src/services/connection/ConnectionValidation';

test('network profiles configure transport without treating VPN as a protocol', () => {
  const vpn = applyNetworkProfile(DEFAULT_CONNECTION_CONFIG, 'CELLULAR_VPN');
  assert.equal(vpn.networkProfile, 'CELLULAR_VPN');
  assert.equal(vpn.type, DEFAULT_CONNECTION_CONFIG.type);

  const radio = applyNetworkProfile(DEFAULT_CONNECTION_CONFIG, 'TELEMETRY_RADIO');
  assert.equal(radio.type, 'UDP');
  assert.equal(radio.udp.mode, 'LISTEN');

  const usb = applyNetworkProfile(DEFAULT_CONNECTION_CONFIG, 'USB_DIRECT');
  assert.equal(usb.type, 'USB_SERIAL');
});

test('connection validation accepts hostnames and ws/wss while rejecting invalid ports and schemes', () => {
  assert.equal(isValidHost('pi-gateway.local'), true);
  assert.equal(isValidHost('192.168.1.27'), true);
  assert.equal(isValidHost('../bad'), false);
  assert.equal(isValidPort(65_535), true);
  assert.equal(isValidPort(65_536), false);
  assert.equal(validateWebSocketUrl('wss://gateway.example.com/mavlink'), null);
  assert.match(validateWebSocketUrl('http://gateway.example.com/mavlink') ?? '', /ws:\/\/ or wss:\/\//);
});

test('transport-specific validation reports the exact invalid field', () => {
  const invalidTcp = {
    ...DEFAULT_CONNECTION_CONFIG,
    type: 'TCP' as const,
    tcp: { ...DEFAULT_CONNECTION_CONFIG.tcp, host: '', port: 70_000 },
  };
  assert.deepEqual(validateConnectionConfig(invalidTcp).map(issue => issue.field), ['tcp.host', 'tcp.port']);
});

test('saved profiles clone editable transport settings and contain no signing key', () => {
  const profile = createSavedConnectionProfile('field', ' Field VPN ', DEFAULT_CONNECTION_CONFIG, 123);
  assert.equal(profile.name, 'Field VPN');
  assert.equal('signingKey' in profile.config, false);
  assert.notEqual(profile.config.websocket, DEFAULT_CONNECTION_CONFIG.websocket);
});

