import test from 'node:test';
import assert from 'node:assert/strict';
import settingsReducer, { setAiFloatingPosition } from '../src/store/settings/settingsSlice';
import {
  placePanelBesideControl,
  positionFromRatio,
  positionToRatio,
} from '../src/components/ai/floatingAniLayout';

test('ANI floating position round-trips as a viewport-independent ratio', () => {
  const viewport = { width: 900, height: 420 };
  const control = { width: 50, height: 50 };
  const original = { x: 680, y: 296 };
  const ratio = positionToRatio(original, viewport, control);
  const restored = positionFromRatio(ratio, viewport, control, { x: 0, y: 0 });

  assert.equal(restored.x, original.x);
  assert.equal(restored.y, original.y);
});

test('ANI bubble opens right/down from a top-left icon and remains in bounds', () => {
  const placement = placePanelBesideControl(
    { x: 24, y: 70 },
    { width: 50, height: 50 },
    { width: 320, height: 150 },
    { width: 900, height: 420 },
    { top: 0, right: 0, bottom: 0, left: 0 },
  );

  assert.equal(placement.opensRight, true);
  assert.equal(placement.opensDown, true);
  assert.equal(placement.x, 84);
  assert.equal(placement.y, 70);
});

test('ANI bubble opens left/up near the bottom-right and cannot leave safe area', () => {
  const placement = placePanelBesideControl(
    { x: 830, y: 350 },
    { width: 50, height: 50 },
    { width: 340, height: 220 },
    { width: 900, height: 420 },
    { top: 6, right: 20, bottom: 8, left: 20 },
  );

  assert.equal(placement.opensRight, false);
  assert.equal(placement.opensDown, false);
  assert.ok(placement.x >= 28 && placement.x + 340 <= 872);
  assert.ok(placement.y >= 14 && placement.y + 220 <= 404);
});

test('ANI persisted position is clamped before entering settings state', () => {
  const state = settingsReducer(undefined, setAiFloatingPosition({ xRatio: 1.8, yRatio: -0.4 }));
  assert.deepEqual(state.aiFloatingPosition, { xRatio: 1, yRatio: 0 });
});
