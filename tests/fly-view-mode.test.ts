import assert from 'node:assert/strict';
import test from 'node:test';
import settingsReducer, {
  setAutomaticFlightDisplay,
  setFlightDisplayMode,
  setPrimaryFlyView,
  SettingsState,
} from '../src/store/settings/settingsSlice';
import { DEFAULT_CONNECTION_CONFIG } from '../src/settings/defaults/connection';
import { DEFAULT_MAVLINK_CONFIG } from '../src/settings/defaults/mavlink';
import { DEFAULT_PI_CONFIG } from '../src/settings/defaults/pi';
import { DEFAULT_VIDEO_CONFIG } from '../src/settings/defaults/video';
import { DEFAULT_CAMERA_CONFIG } from '../src/settings/defaults/camera';
import { DEFAULT_TELEMETRY_CONFIG } from '../src/settings/defaults/telemetry';
import { DEFAULT_JOYSTICK_CONFIG } from '../src/settings/defaults/joystick';
import {
  canShowVideo,
  getVideoAvailability,
  resolveInitialFlightDisplay,
} from '../src/video/FlightDisplayState';

const createBaseState = (): SettingsState => ({
  showJoysticks: true,
  showTelemetry: true,
  mainViewMode: 'HUD',
  flightDisplayMode: 'HUD',
  flightDisplayManual: false,
  connection: DEFAULT_CONNECTION_CONFIG,
  mavlink: DEFAULT_MAVLINK_CONFIG,
  piGateway: DEFAULT_PI_CONFIG,
  video: DEFAULT_VIDEO_CONFIG,
  camera: DEFAULT_CAMERA_CONFIG,
  telemetry: DEFAULT_TELEMETRY_CONFIG,
  joystick: DEFAULT_JOYSTICK_CONFIG,
});

test('Flight and Map are primary views while HUD/Video preference is preserved', () => {
  let state = createBaseState();
  state = settingsReducer(state, setFlightDisplayMode('VIDEO'));
  assert.equal(state.mainViewMode, 'VIDEO');
  assert.equal(state.flightDisplayMode, 'VIDEO');

  state = settingsReducer(state, setPrimaryFlyView('MAP'));
  assert.equal(state.mainViewMode, 'MAP');
  assert.equal(state.flightDisplayMode, 'VIDEO');

  state = settingsReducer(state, setPrimaryFlyView('FLIGHT'));
  assert.equal(state.mainViewMode, 'VIDEO');
});

test('automatic video selection never overrides a manual HUD choice', () => {
  let state = createBaseState();
  state = settingsReducer(state, setFlightDisplayMode('HUD'));
  state = settingsReducer(state, setAutomaticFlightDisplay('VIDEO'));
  assert.equal(state.flightDisplayMode, 'HUD');
  assert.equal(state.mainViewMode, 'HUD');
});

test('truthful video availability resolves a safe initial display', () => {
  assert.equal(resolveInitialFlightDisplay(false, 'LIVE'), 'HUD');
  assert.equal(resolveInitialFlightDisplay(true, 'CONNECTING'), 'HUD');
  assert.equal(resolveInitialFlightDisplay(true, 'LIVE'), 'VIDEO');
  assert.equal(getVideoAvailability(true, 'RECONNECTING'), 'CONNECTING');
  assert.equal(canShowVideo(true, 'CONNECTING'), true);
  assert.equal(canShowVideo(true, 'ERROR'), true);
  assert.equal(canShowVideo(false, 'LIVE'), false);
});
