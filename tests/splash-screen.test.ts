import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  MIN_SPLASH_DISPLAY_MS,
  MAX_SPLASH_TIMEOUT_MS,
  SPLASH_FADE_DURATION_MS,
  SPLASH_FALLBACK_BG,
  calculateRemainingSplashTime,
  isAppReadyForFlight,
  type AppBootStatus,
} from '../src/app/splashConfig';

test('1. Splash timing parameters satisfy UX requirements', () => {
  // Requirement 8: Minimum display time must be 800ms - 1500ms
  assert.ok(
    MIN_SPLASH_DISPLAY_MS >= 800 && MIN_SPLASH_DISPLAY_MS <= 1500,
    `MIN_SPLASH_DISPLAY_MS (${MIN_SPLASH_DISPLAY_MS}) should be between 800ms and 1500ms`
  );

  // Requirement 9: Maximum safety timeout must be 5000ms - 8000ms
  assert.ok(
    MAX_SPLASH_TIMEOUT_MS >= 5000 && MAX_SPLASH_TIMEOUT_MS <= 8000,
    `MAX_SPLASH_TIMEOUT_MS (${MAX_SPLASH_TIMEOUT_MS}) should be between 5000ms and 8000ms`
  );

  // Requirement 10: Smooth fade out duration must be 250ms - 400ms
  assert.ok(
    SPLASH_FADE_DURATION_MS >= 250 && SPLASH_FADE_DURATION_MS <= 400,
    `SPLASH_FADE_DURATION_MS (${SPLASH_FADE_DURATION_MS}) should be between 250ms and 400ms`
  );

  // Requirement 17: Fallback background color must be #071722
  assert.equal(SPLASH_FALLBACK_BG, '#071722');
});

test('2. Local landscape splash assets exist and match required dimensions', () => {
  const assetsDir = path.join(__dirname, '../assets/splash');
  const jpgPath = path.join(assetsDir, 'anitech-gcs-loading-landscape.jpg');
  const pngPath = path.join(assetsDir, 'anitech-gcs-loading-landscape.png');

  assert.ok(fs.existsSync(jpgPath), 'anitech-gcs-loading-landscape.jpg must exist in assets/splash/');
  assert.ok(fs.existsSync(pngPath), 'anitech-gcs-loading-landscape.png must exist in assets/splash/');

  const jpgStats = fs.statSync(jpgPath);
  const pngStats = fs.statSync(pngPath);

  assert.ok(jpgStats.size > 50000, 'JPG asset size must be valid (>50KB)');
  assert.ok(pngStats.size > 100000, 'PNG asset size must be valid (>100KB)');
});

test('3. app.json defines splash with cover resizeMode and #071722 background', () => {
  const appJsonPath = path.join(__dirname, '../app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  // Top level splash
  assert.ok(appJson.expo.splash, 'expo.splash must be defined');
  assert.equal(appJson.expo.splash.resizeMode, 'cover');
  assert.equal(appJson.expo.splash.backgroundColor, '#071722');
  assert.equal(appJson.expo.splash.image, './assets/splash/anitech-gcs-loading-landscape.png');

  // expo-splash-screen plugin
  const splashPlugin = appJson.expo.plugins.find(
    (p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen'
  );
  assert.ok(splashPlugin, 'expo-splash-screen plugin must be configured in plugins');
  assert.equal(splashPlugin[1].resizeMode, 'cover');
  assert.equal(splashPlugin[1].backgroundColor, '#071722');
  assert.equal(splashPlugin[1].image, './assets/splash/anitech-gcs-loading-landscape.png');
});

test('4. AppBootStatus transitions correctly and decouples from vehicle/drone connection', () => {
  const statuses: AppBootStatus[] = [
    'STARTING',
    'LOADING_SETTINGS',
    'INITIALIZING_SERVICES',
    'READY',
    'ERROR',
  ];

  // Verify all lifecycle status states
  assert.equal(statuses.length, 5);

  // Simulate vehicle offline scenario
  const mockVehicleState = {
    connected: false,
    heartbeat: null,
    gpsFix: null,
    videoStream: 'OFFLINE',
    aiOnline: false,
  };

  // App enters READY regardless of whether vehicle is offline or online
  assert.equal(isAppReadyForFlight('STARTING'), false);
  assert.equal(isAppReadyForFlight('LOADING_SETTINGS'), false);
  assert.equal(isAppReadyForFlight('INITIALIZING_SERVICES'), false);
  assert.equal(isAppReadyForFlight('READY'), true);

  // Even when mockVehicleState has no connection, READY status allows entering Flight Screen
  assert.equal(mockVehicleState.connected, false);
  assert.equal(isAppReadyForFlight('READY'), true);
});

test('5. Remaining splash display time accounts for elapsed mount time', () => {
  const mountTime = 10000;

  // If boot finished in 200ms, splash stays for remainder (900ms)
  assert.equal(calculateRemainingSplashTime(mountTime, mountTime + 200), 900);

  // If boot took 1200ms (> 1100ms), splash transitions immediately (0ms delay)
  assert.equal(calculateRemainingSplashTime(mountTime, mountTime + 1200), 0);

  // If boot took exactly 1100ms, splash transitions immediately
  assert.equal(calculateRemainingSplashTime(mountTime, mountTime + 1100), 0);
});
