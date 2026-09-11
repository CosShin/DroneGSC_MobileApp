import React from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
  Animated,
} from 'react-native';

export interface FloatingControlPosition {
  x: number;
  y: number;
}

interface Props {
  initialPosition: FloatingControlPosition;
  position?: FloatingControlPosition;
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  onLongPress?: () => void;
  onPositionChange?: (position: FloatingControlPosition) => void;
  onDragEnd?: (position: FloatingControlPosition) => void;
  tapSlop?: number;
  longPressDelayMs?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function DraggableFloatingControl({
  initialPosition,
  position: controlledPosition,
  children,
  style,
  onPress,
  onLongPress,
  onPositionChange,
  onDragEnd,
  tapSlop = 7,
  longPressDelayMs = 550,
}: Props) {
  const { width, height } = useWindowDimensions();
  const [position, setPosition] = React.useState(initialPosition);
  const [size, setSize] = React.useState({ width: 56, height: 56 });
  const positionRef = React.useRef(initialPosition);
  const startRef = React.useRef(initialPosition);
  const movedRef = React.useRef(false);
  const longPressTriggeredRef = React.useRef(false);
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownsTouch = Boolean(onPress || onLongPress);
  const renderedPosition = controlledPosition ?? position;
  positionRef.current = renderedPosition;

  const clampPosition = React.useCallback((next: FloatingControlPosition) => ({
    x: clamp(next.x, 0, Math.max(0, width - size.width)),
    y: clamp(next.y, 0, Math.max(0, height - size.height)),
  }), [height, size.height, size.width, width]);

  const clampPositionRef = React.useRef(clampPosition);
  const onPressRef = React.useRef(onPress);
  const onLongPressRef = React.useRef(onLongPress);
  const onPositionChangeRef = React.useRef(onPositionChange);
  const onDragEndRef = React.useRef(onDragEnd);
  const ownsTouchRef = React.useRef(ownsTouch);
  const tapSlopRef = React.useRef(tapSlop);
  const longPressDelayRef = React.useRef(longPressDelayMs);

  clampPositionRef.current = clampPosition;
  onPressRef.current = onPress;
  onLongPressRef.current = onLongPress;
  onPositionChangeRef.current = onPositionChange;
  onDragEndRef.current = onDragEnd;
  ownsTouchRef.current = ownsTouch;
  tapSlopRef.current = tapSlop;
  longPressDelayRef.current = longPressDelayMs;

  const clearLongPressTimer = React.useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const updatePosition = React.useCallback((next: FloatingControlPosition) => {
    const clamped = clampPositionRef.current(next);
    positionRef.current = clamped;
    setPosition(clamped);
    onPositionChangeRef.current?.(clamped);
    return clamped;
  }, []);

  React.useEffect(() => {
    updatePosition(positionRef.current);
  }, [clampPosition, updatePosition]);

  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => ownsTouchRef.current,
    onStartShouldSetPanResponderCapture: () => ownsTouchRef.current,
    onMoveShouldSetPanResponder: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => (
      Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6
    ),
    onMoveShouldSetPanResponderCapture: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => (
      Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6
    ),
    onPanResponderGrant: () => {
      startRef.current = positionRef.current;
      movedRef.current = false;
      longPressTriggeredRef.current = false;
      clearLongPressTimer();
      if (onLongPressRef.current) {
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          longPressTriggeredRef.current = true;
          onLongPressRef.current?.();
        }, longPressDelayRef.current);
      }
    },
    onPanResponderMove: (_event, gesture) => {
      if (Math.abs(gesture.dx) > tapSlopRef.current || Math.abs(gesture.dy) > tapSlopRef.current) {
        movedRef.current = true;
        clearLongPressTimer();
      }
      updatePosition({
        x: startRef.current.x + gesture.dx,
        y: startRef.current.y + gesture.dy,
      });
    },
    onPanResponderRelease: (_event, gesture) => {
      clearLongPressTimer();
      const finalPosition = updatePosition({
        x: startRef.current.x + gesture.dx,
        y: startRef.current.y + gesture.dy,
      });
      if (movedRef.current) {
        onDragEndRef.current?.(finalPosition);
      } else if (!longPressTriggeredRef.current) {
        onPressRef.current?.();
      }
    },
    onPanResponderTerminate: (_event, gesture) => {
      clearLongPressTimer();
      const finalPosition = updatePosition({
        x: startRef.current.x + gesture.dx,
        y: startRef.current.y + gesture.dy,
      });
      if (movedRef.current) onDragEndRef.current?.(finalPosition);
    },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [clearLongPressTimer, updatePosition]);

  React.useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextSize = {
      width: Math.max(1, event.nativeEvent.layout.width),
      height: Math.max(1, event.nativeEvent.layout.height),
    };
    setSize(nextSize);
  }, []);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      onLayout={handleLayout}
      style={[
        styles.root,
        style,
        {
          top: renderedPosition.y,
          left: renderedPosition.x,
        },
      ]}
    >
      <View pointerEvents={ownsTouch ? 'none' : 'auto'}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
  },
});
