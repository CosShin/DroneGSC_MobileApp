export function clamp(value: number, min: number, max: number): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  return Math.min(Math.max(value, min), max);
}

export function applyDeadzone(value: number, deadzone: number): number {
  const absValue = Math.abs(value);
  if (absValue < deadzone) return 0;
  
  // Remap the remaining range (deadzone to 1) to (0 to 1)
  const sign = Math.sign(value);
  const remapped = (absValue - deadzone) / (1 - deadzone);
  return sign * remapped;
}

export function applyExpo(value: number, expo: number): number {
  // Expo curve: value * (1 - expo) + value^3 * expo
  // This keeps the output in [-1, 1] while flattening the curve near 0.
  const val3 = value * value * value;
  return value * (1 - expo) + val3 * expo;
}

export function applySensitivity(value: number, sensitivity: number): number {
  return clamp(value * sensitivity, -1, 1);
}

export function processAxis(value: number, deadzone: number, expo: number, sensitivity: number): number {
  const clamped = clamp(value, -1, 1);
  const dz = applyDeadzone(clamped, deadzone);
  const ex = applyExpo(dz, expo);
  return applySensitivity(ex, sensitivity);
}

/**
 * Throttle mapping:
 * Raw Y from joystick: -1 (up) to +1 (down)
 * We want throttle: 0 (bottom/down) to 1 (top/up), with 0.5 at center.
 * So y = -1 => 1.0
 *    y =  0 => 0.5
 *    y =  1 => 0.0
 * Formula: throttle = (-y + 1) / 2
 */
export function mapThrottle(y: number): number {
  const clamped = clamp(y, -1, 1);
  return (-clamped + 1) / 2;
}
