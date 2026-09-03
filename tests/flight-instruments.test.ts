import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHeadingTape,
  clampAttitude,
  formatSignedAngle,
  headingCardinal,
  normalizeHeading,
} from '../src/utils/flightInstruments';

test('normalizes headings across north without negative values', () => {
  assert.equal(normalizeHeading(360), 0);
  assert.equal(normalizeHeading(-10), 350);
  assert.equal(normalizeHeading(725), 5);
});

test('maps headings to the nearest eight-point cardinal', () => {
  assert.equal(headingCardinal(0), 'N');
  assert.equal(headingCardinal(44), 'NE');
  assert.equal(headingCardinal(91), 'E');
  assert.equal(headingCardinal(225), 'SW');
});

test('builds a continuous compass tape at the 360 degree boundary', () => {
  const tape = buildHeadingTape(359);
  assert.equal(tape.heading, 359);
  assert.equal(tape.cardinal, 'N');
  assert.equal(tape.ticks.length, 9);
  assert.equal(tape.ticks[4].value, 0);
  assert.ok(tape.translateX > 0);
});

test('clamps attitude graphics and formats signed angle readouts', () => {
  assert.equal(clampAttitude(80, 45), 45);
  assert.equal(clampAttitude(-80, 45), -45);
  assert.equal(formatSignedAngle(2.4), '+2°');
  assert.equal(formatSignedAngle(-2.6), '-3°');
  assert.equal(formatSignedAngle(null), '--');
});
