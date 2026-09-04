export type JoystickTouchIdentifier = string | number;

export interface JoystickTouchPoint {
  identifier: JoystickTouchIdentifier;
  pageX: number;
  pageY: number;
}

export interface JoystickTouchEventData {
  identifier?: JoystickTouchIdentifier;
  pageX?: number;
  pageY?: number;
  changedTouches?: readonly JoystickTouchPoint[];
  touches?: readonly JoystickTouchPoint[];
}

function isUsableTouch(touch: Partial<JoystickTouchPoint> | null | undefined): touch is JoystickTouchPoint {
  return touch?.identifier !== undefined
    && touch.identifier !== null
    && Number.isFinite(touch.pageX)
    && Number.isFinite(touch.pageY);
}

/** Select only the touch which began this gesture; never steal an already tracked stick. */
export function selectStartingTouch(
  event: JoystickTouchEventData,
  activeTouchId: JoystickTouchIdentifier | null,
): JoystickTouchPoint | null {
  if (activeTouchId !== null) return null;

  const changedTouch = event.changedTouches?.[0];
  if (isUsableTouch(changedTouch)) return changedTouch;

  const eventTouch = {
    identifier: event.identifier,
    pageX: event.pageX,
    pageY: event.pageY,
  };
  if (isUsableTouch(eventTouch)) return eventTouch;

  const fallbackTouch = event.touches?.[event.touches.length - 1];
  return isUsableTouch(fallbackTouch) ? fallbackTouch : null;
}

export function findTrackedTouch(
  touches: readonly JoystickTouchPoint[] | undefined,
  activeTouchId: JoystickTouchIdentifier,
): JoystickTouchPoint | null {
  const target = String(activeTouchId);
  return touches?.find(touch => String(touch.identifier) === target) ?? null;
}

export function shouldReleaseTrackedTouch(
  changedTouches: readonly JoystickTouchPoint[] | undefined,
  remainingTouches: readonly JoystickTouchPoint[] | undefined,
  activeTouchId: JoystickTouchIdentifier,
): boolean {
  const target = String(activeTouchId);
  const explicitlyEnded = changedTouches?.some(touch => String(touch.identifier) === target) ?? false;
  const stillActive = remainingTouches?.some(touch => String(touch.identifier) === target) ?? false;
  return explicitlyEnded || !stillActive;
}
