import test from 'node:test';
import assert from 'node:assert/strict';
import { InputMapper } from '../src/services/joystick/InputMapper';
import { JoystickInput } from '../src/types/joystick';
import {
  findTrackedTouch,
  selectStartingTouch,
  shouldReleaseTrackedTouch,
} from '../src/components/joystick/JoystickTouchTracker';

test('InputMapper maps both sticks simultaneously when both are active (4-axis non-zero)', () => {
  const leftStick: JoystickInput = {
    x: 0.6, // Yaw right
    y: -0.7, // Throttle up (screen Y is negative up)
    active: true,
    timestamp: Date.now(),
  };

  const rightStick: JoystickInput = {
    x: -0.5, // Roll left
    y: -0.8, // Pitch forward (screen Y is negative up, MAVLink pitch is positive forward)
    active: true,
    timestamp: Date.now(),
  };

  const result = InputMapper.mapInputs(leftStick, rightStick);

  // All 4 axes should reflect their respective stick inputs simultaneously
  assert.ok(result.yaw > 0, `Expected positive yaw, got ${result.yaw}`);
  assert.ok(result.throttle > 0.5, `Expected throttle > 0.5, got ${result.throttle}`);
  assert.ok(result.roll < 0, `Expected negative roll, got ${result.roll}`);
  assert.ok(result.pitch > 0, `Expected positive pitch, got ${result.pitch}`);
  assert.deepEqual(result.validAxes, { roll: true, pitch: true, yaw: true, throttle: true });
});

test('InputMapper preserves right stick active values when left stick is released (neutral/center)', () => {
  // Left stick released (centered, active = false)
  const leftStick: JoystickInput = {
    x: 0,
    y: 0,
    active: false,
    timestamp: Date.now(),
  };

  // Right stick still actively held forward-right
  const rightStick: JoystickInput = {
    x: 0.75, // Roll right
    y: -0.75, // Pitch forward
    active: true,
    timestamp: Date.now(),
  };

  const result = InputMapper.mapInputs(leftStick, rightStick);

  // Left stick axes should be at neutral (yaw = 0, throttle = 0.5 centered)
  assert.equal(result.yaw, 0, `Expected neutral yaw, got ${result.yaw}`);
  assert.equal(result.throttle, 0.5, `Expected center throttle (0.5), got ${result.throttle}`);

  // Right stick axes must remain fully active
  assert.ok(result.roll > 0.5, `Expected active roll > 0.5, got ${result.roll}`);
  assert.ok(result.pitch > 0.5, `Expected active pitch > 0.5, got ${result.pitch}`);
  assert.deepEqual(result.validAxes, { roll: true, pitch: true, yaw: false, throttle: false });
});

test('InputMapper preserves left stick active values when right stick is released (neutral/center)', () => {
  // Left stick actively held full throttle and yaw left
  const leftStick: JoystickInput = {
    x: -0.8, // Yaw left
    y: -0.9, // High throttle
    active: true,
    timestamp: Date.now(),
  };

  // Right stick released (centered, active = false)
  const rightStick: JoystickInput = {
    x: 0,
    y: 0,
    active: false,
    timestamp: Date.now(),
  };

  const result = InputMapper.mapInputs(leftStick, rightStick);

  // Left stick axes must remain fully active
  assert.ok(result.yaw < -0.5, `Expected active yaw < -0.5, got ${result.yaw}`);
  assert.ok(result.throttle > 0.8, `Expected high throttle > 0.8, got ${result.throttle}`);

  // Right stick axes should be at neutral (roll = 0, pitch = 0)
  assert.equal(result.roll, 0, `Expected neutral roll, got ${result.roll}`);
  assert.equal(result.pitch, 0, `Expected neutral pitch, got ${result.pitch}`);
  assert.deepEqual(result.validAxes, { roll: false, pitch: false, yaw: true, throttle: true });
});

test('InputMapper deadzone correctly zeroes tiny drift while preserving the other stick', () => {
  // Left stick within deadzone (0.02 < 0.05)
  const leftStick: JoystickInput = {
    x: 0.02,
    y: -0.02,
    active: true,
    timestamp: Date.now(),
  };

  // Right stick deliberately deflected outside deadzone
  const rightStick: JoystickInput = {
    x: 0.6,
    y: 0,
    active: true,
    timestamp: Date.now(),
  };

  const result = InputMapper.mapInputs(leftStick, rightStick);

  assert.equal(result.yaw, 0, 'Deadzone should filter tiny yaw');
  assert.equal(result.throttle, 0.5, 'Deadzone should keep throttle at 0.5');
  assert.ok(result.roll > 0.4, `Right stick roll should be active, got ${result.roll}`);
});

test('Simultaneous touch tracking: Right stick selects new touch from changedTouches instead of touches[0]', () => {
  // Scenario: Left stick is already actively held by Finger 1 (identifier: 0, pageX: 120, pageY: 250)
  // When Finger 2 touches Right stick, touches contains [Finger 1, Finger 2] in arrival order.
  const touchFinger1 = { identifier: 0, pageX: 120, pageY: 250 };
  const touchFinger2 = { identifier: 1, pageX: 750, pageY: 250 };

  const onTouchStartRight = {
    nativeEvent: {
      identifier: 1,
      pageX: 750,
      pageY: 250,
      changedTouches: [touchFinger2],
      touches: [touchFinger1, touchFinger2],
    },
  };

  // The touch picker must pick Finger 2 (from changedTouches), NOT touches[0] (which is Finger 1)
  const picked = selectStartingTouch(onTouchStartRight.nativeEvent, null);

  assert.equal(picked?.identifier, 1, 'Right stick must identify Finger 2, not Finger 1');
  assert.equal(picked?.pageX, 750);
});

test('Simultaneous touch tracking: Move event from finger 1 does NOT deflect right stick', () => {
  const rightStickTrackedId = 1; // Finger 2
  const rightStickStartPos = { pageX: 750, pageY: 250 };

  // Finger 1 drags from 120 to 180 (moving Left stick)
  // Finger 2 stays stationary at 750
  const touches = [
    { identifier: 0, pageX: 180, pageY: 210 }, // Finger 1 moved!
    { identifier: 1, pageX: 750, pageY: 250 }, // Finger 2 stationary!
  ];

  const touchForRightStick = findTrackedTouch(touches, rightStickTrackedId);

  assert.ok(touchForRightStick, 'Finger 2 should be found in active touches');
  assert.equal(touchForRightStick.identifier, 1);

  // Right stick deflection must be 0 (no motion on Finger 2)
  const dx = touchForRightStick.pageX - rightStickStartPos.pageX;
  const dy = touchForRightStick.pageY - rightStickStartPos.pageY;
  assert.equal(dx, 0, 'Right stick must NOT move when only left finger moves');
  assert.equal(dy, 0, 'Right stick must NOT move when only left finger moves');
});

test('Simultaneous touch tracking: a second finger cannot steal an active joystick', () => {
  const secondFinger = { identifier: 2, pageX: 760, pageY: 260 };
  const picked = selectStartingTouch({ changedTouches: [secondFinger], touches: [secondFinger] }, 1);

  assert.equal(picked, null);
});

test('Simultaneous touch tracking: only ending the tracked finger releases the stick', () => {
  const left = { identifier: 1, pageX: 100, pageY: 200 };
  const right = { identifier: 2, pageX: 700, pageY: 200 };

  assert.equal(shouldReleaseTrackedTouch([left], [right], 2), false);
  assert.equal(shouldReleaseTrackedTouch([right], [left], 2), true);
});
