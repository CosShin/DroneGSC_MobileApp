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

interface Position {
  x: number;
  y: number;
}

interface Props {
  initialPosition: Position;
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  tapSlop?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function DraggableFloatingControl({
  initialPosition,
  children,
  style,
  onPress,
  tapSlop = 7,
}: Props) {
  const { width, height } = useWindowDimensions();
  const [position, setPosition] = React.useState(initialPosition);
  const [size, setSize] = React.useState({ width: 56, height: 56 });
  const startRef = React.useRef(initialPosition);
  const movedRef = React.useRef(false);
  const ownsTouch = Boolean(onPress);

  const clampPosition = React.useCallback((next: Position) => ({
    x: clamp(next.x, 0, Math.max(0, width - size.width)),
    y: clamp(next.y, 0, Math.max(0, height - size.height)),
  }), [height, size.height, size.width, width]);

  React.useEffect(() => {
    setPosition(current => clampPosition(current));
  }, [clampPosition]);

  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => ownsTouch,
    onStartShouldSetPanResponderCapture: () => ownsTouch,
    onMoveShouldSetPanResponder: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => (
      Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6
    ),
    onMoveShouldSetPanResponderCapture: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => (
      Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6
    ),
    onPanResponderGrant: () => {
      startRef.current = position;
      movedRef.current = false;
    },
    onPanResponderMove: (_event, gesture) => {
      if (Math.abs(gesture.dx) > tapSlop || Math.abs(gesture.dy) > tapSlop) {
        movedRef.current = true;
      }
      setPosition(clampPosition({
        x: startRef.current.x + gesture.dx,
        y: startRef.current.y + gesture.dy,
      }));
    },
    onPanResponderRelease: (_event, gesture) => {
      setPosition(clampPosition({
        x: startRef.current.x + gesture.dx,
        y: startRef.current.y + gesture.dy,
      }));
      if (!movedRef.current) {
        onPress?.();
      }
    },
    onPanResponderTerminate: (_event, gesture) => {
      setPosition(clampPosition({
        x: startRef.current.x + gesture.dx,
        y: startRef.current.y + gesture.dy,
      }));
    },
    onShouldBlockNativeResponder: () => false,
  }), [clampPosition, onPress, ownsTouch, position, tapSlop]);

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
        {
          left: position.x,
          top: position.y,
        },
        style,
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
