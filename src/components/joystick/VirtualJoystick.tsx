import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
  State,
} from 'react-native-gesture-handler';

interface Props {
  size?: number;
  mode?: 'THROTTLE_YAW' | 'PITCH_ROLL';
  onUpdate: (x: number, y: number, active: boolean) => void;
}

export function VirtualJoystick({ size = 118, mode = 'PITCH_ROLL', onUpdate }: Props) {
  const pan = React.useRef(new Animated.ValueXY()).current;
  const onUpdateRef = React.useRef(onUpdate);
  const position = React.useRef({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = React.useState(false);
  const active = React.useRef(false);
  const knobRadius = Math.max(24, size * 0.19);
  const maxTravel = Math.max(1, size * 0.5 - knobRadius - 9);

  React.useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const update = React.useCallback((dx: number, dy: number, isActive: boolean) => {
    onUpdateRef.current(
      Math.max(-1, Math.min(1, dx / maxTravel)),
      Math.max(-1, Math.min(1, dy / maxTravel)),
      isActive
    );
  }, [maxTravel]);

  const onGesture = (event: PanGestureHandlerGestureEvent) => {
    let dx = event.nativeEvent.translationX;
    let dy = event.nativeEvent.translationY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxTravel) {
      dx = (dx / distance) * maxTravel;
      dy = (dy / distance) * maxTravel;
    }

    pan.setValue({ x: dx, y: dy });
    position.current = { x: dx, y: dy };
    update(dx, dy, true);
  };

  const release = React.useCallback(() => {
    if (!active.current) return;
    active.current = false;
    setIsInteracting(false);
    position.current = { x: 0, y: 0 };
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      speed: 28,
      bounciness: 4,
    }).start();
    update(0, 0, false);
  }, [pan, update]);

  const onState = (event: PanGestureHandlerStateChangeEvent) => {
    const state = event.nativeEvent.state;

    if (state === State.BEGAN) {
      pan.stopAnimation();
      pan.setValue({ x: 0, y: 0 });
      position.current = { x: 0, y: 0 };
      active.current = true;
      setIsInteracting(true);
      update(0, 0, true);
    }

    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      release();
    }
  };

  React.useEffect(() => {
    if (!isInteracting) return;
    // Gesture-handler may not emit MOVE events while a finger is held still.
    // Refresh the processor timestamp so an intentional held command remains live.
    const keepAlive = setInterval(() => {
      if (active.current) update(position.current.x, position.current.y, true);
    }, 100);
    return () => clearInterval(keepAlive);
  }, [isInteracting, update]);

  React.useEffect(() => {
    return () => {
      if (active.current) onUpdateRef.current(0, 0, false);
    };
  }, []);

  const label = mode === 'THROTTLE_YAW' ? 'THROTTLE / YAW' : 'PITCH / ROLL';
  const verticalAxis = mode === 'THROTTLE_YAW' ? 'THR' : 'PITCH';
  const horizontalAxis = mode === 'THROTTLE_YAW' ? 'YAW' : 'ROLL';
  const accent = '#FFFFFF';
  const accentMuted = 'rgba(255, 255, 255, 0.50)';

  return (
    <View style={[styles.wrapper, isInteracting ? styles.wrapperActive : styles.wrapperIdle]}>
      <PanGestureHandler
        maxPointers={1}
        minDist={0}
        shouldCancelWhenOutside={false}
        onGestureEvent={onGesture}
        onHandlerStateChange={onState}
      >
        <View
          accessible
          accessibilityLabel={`${label} virtual joystick`}
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
      </PanGestureHandler>

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
    ...StyleSheet.absoluteFillObject,
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
