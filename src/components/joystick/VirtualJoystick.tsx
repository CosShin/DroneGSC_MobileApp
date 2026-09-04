import React from 'react';
import {
  Animated,
  GestureResponderEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  findTrackedTouch,
  selectStartingTouch,
  shouldReleaseTrackedTouch,
  type JoystickTouchIdentifier,
} from './JoystickTouchTracker';

interface Props {
  size?: number;
  mode?: 'THROTTLE_YAW' | 'PITCH_ROLL';
  onUpdate: (x: number, y: number, active: boolean) => void;
}

/**
 * High-performance virtual flight joystick using direct native touch events.
 *
 * Each joystick instance owns its pointer independently via `touch.identifier`,
 * allowing TRUE simultaneous two-finger multi-touch across left and right sticks
 * on both iOS and Android without gesture cancellations or mutual exclusion.
 */
export function VirtualJoystick({
  size = 118,
  mode = 'PITCH_ROLL',
  onUpdate,
}: Props) {
  const pan = React.useRef(new Animated.ValueXY()).current;
  const onUpdateRef = React.useRef(onUpdate);
  const startPos = React.useRef({ pageX: 0, pageY: 0 });
  const currentPos = React.useRef({ x: 0, y: 0 });
  const activeTouchId = React.useRef<JoystickTouchIdentifier | null>(null);
  const isActive = React.useRef(false);
  const [isInteracting, setIsInteracting] = React.useState(false);

  const knobRadius = Math.max(24, size * 0.19);
  const maxTravel = Math.max(1, size * 0.5 - knobRadius - 9);

  React.useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const update = React.useCallback((dx: number, dy: number, active: boolean) => {
    onUpdateRef.current(
      Math.max(-1, Math.min(1, dx / maxTravel)),
      Math.max(-1, Math.min(1, dy / maxTravel)),
      active
    );
  }, [maxTravel]);

  const release = React.useCallback(() => {
    if (!isActive.current) return;
    isActive.current = false;
    activeTouchId.current = null;
    setIsInteracting(false);
    currentPos.current = { x: 0, y: 0 };
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      speed: 28,
      bounciness: 4,
    }).start();
    update(0, 0, false);
  }, [pan, update]);

  const handleTouchStart = React.useCallback((e: GestureResponderEvent) => {
    const touch = selectStartingTouch(e.nativeEvent, activeTouchId.current);
    if (!touch) return;

    activeTouchId.current = touch.identifier;
    startPos.current = { pageX: touch.pageX, pageY: touch.pageY };
    pan.stopAnimation();
    pan.setValue({ x: 0, y: 0 });
    currentPos.current = { x: 0, y: 0 };
    isActive.current = true;
    setIsInteracting(true);
    update(0, 0, true);
  }, [pan, update]);

  const handleTouchMove = React.useCallback((e: GestureResponderEvent) => {
    if (!isActive.current || activeTouchId.current === null || activeTouchId.current === undefined) return;
    const touch = findTrackedTouch(e.nativeEvent.touches, activeTouchId.current);

    // CRITICAL FIX: NEVER fallback to touches[0]!
    // If our tracked finger is not in this move event, this move belongs to another finger.
    // We MUST ignore it!
    if (!touch) return;

    let dx = touch.pageX - startPos.current.pageX;
    let dy = touch.pageY - startPos.current.pageY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxTravel) {
      dx = (dx / distance) * maxTravel;
      dy = (dy / distance) * maxTravel;
    }

    pan.setValue({ x: dx, y: dy });
    currentPos.current = { x: dx, y: dy };
    update(dx, dy, true);
  }, [maxTravel, pan, update]);

  const handleTouchEnd = React.useCallback((e: GestureResponderEvent) => {
    if (!isActive.current || activeTouchId.current === null || activeTouchId.current === undefined) return;
    if (shouldReleaseTrackedTouch(
      e.nativeEvent.changedTouches,
      e.nativeEvent.touches,
      activeTouchId.current,
    )) {
      release();
    }
  }, [release]);

  // Keep-alive timer while finger is held stationary
  React.useEffect(() => {
    if (!isInteracting) return;
    const keepAlive = setInterval(() => {
      if (isActive.current) {
        update(currentPos.current.x, currentPos.current.y, true);
      }
    }, 100);
    return () => clearInterval(keepAlive);
  }, [isInteracting, update]);

  // Clean-up on unmount
  React.useEffect(() => {
    return () => {
      if (isActive.current) {
        onUpdateRef.current(0, 0, false);
      }
    };
  }, []);

  const label = mode === 'THROTTLE_YAW' ? 'THROTTLE / YAW' : 'PITCH / ROLL';
  const verticalAxis = mode === 'THROTTLE_YAW' ? 'THR' : 'PITCH';
  const horizontalAxis = mode === 'THROTTLE_YAW' ? 'YAW' : 'ROLL';
  const accent = '#FFFFFF';
  const accentMuted = 'rgba(255, 255, 255, 0.50)';

  return (
    <View style={[styles.wrapper, isInteracting ? styles.wrapperActive : styles.wrapperIdle]}>
      <View
        accessible
        accessibilityLabel={`${label} virtual joystick`}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={[
          styles.base,
          isInteracting && styles.baseActive,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <View style={[styles.touchHalo, { borderRadius: size / 2 }, isInteracting && { borderColor: accent }]} />
        <View style={styles.verticalAxis} />
        <View style={styles.horizontalAxis} />
        <View style={[styles.deadzone, { borderColor: accentMuted }]} />
        <Text pointerEvents="none" style={[styles.verticalAxisLabel, { color: accent }]}>{verticalAxis}</Text>
        <Text pointerEvents="none" style={[styles.horizontalAxisLabel, { color: accent }]}>{horizontalAxis}</Text>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.knob,
            { borderColor: accent, shadowColor: accent },
            {
              width: knobRadius * 2,
              height: knobRadius * 2,
              borderRadius: knobRadius,
              marginLeft: -knobRadius,
              marginTop: -knobRadius,
              transform: [{ translateX: pan.x }, { translateY: pan.y }],
            },
          ]}
        >
          <View style={[styles.knobInner, isInteracting && styles.knobInnerActive]}>
            <View style={[styles.knobCore, { backgroundColor: accent }]} />
            <View style={styles.knobHighlight} />
          </View>
        </Animated.View>
      </View>

      <View style={[styles.labelPill, isInteracting && { borderColor: accentMuted }]}>
        <View style={[styles.labelDot, { backgroundColor: accent }]} />
        <Text style={[styles.label, isInteracting && { color: accent }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  wrapperIdle: {
    opacity: 0.94,
  },
  wrapperActive: {
    opacity: 1,
  },
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.62)',
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 16,
    elevation: 9,
  },
  baseActive: {
    borderColor: 'rgba(255, 255, 255, 0.88)',
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  touchHalo: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    margin: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.48)',
  },
  verticalAxis: {
    position: 'absolute',
    top: '14%',
    bottom: '14%',
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
  },
  horizontalAxis: {
    position: 'absolute',
    left: '14%',
    right: '14%',
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
  },
  deadzone: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  verticalAxisLabel: {
    position: 'absolute',
    top: 10,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  horizontalAxisLabel: {
    position: 'absolute',
    left: 9,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
    transform: [{ rotate: '-90deg' }],
  },
  knob: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.68)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 9,
    elevation: 12,
  },
  knobInner: {
    width: '76%',
    height: '76%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.58)',
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  knobInnerActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.54)',
  },
  knobCore: {
    width: '48%',
    height: '48%',
    borderRadius: 999,
    opacity: 0.9,
  },
  knobHighlight: {
    position: 'absolute',
    top: '14%',
    left: '22%',
    width: '42%',
    height: '18%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    transform: [{ rotate: '-18deg' }],
  },
  labelPill: {
    marginTop: 8,
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.48)',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  label: {
    color: '#E2E8F0',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  labelDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
