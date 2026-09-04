import React from 'react';
import { StyleSheet, View } from 'react-native';
import { VirtualJoystick } from './VirtualJoystick';
import { layers } from '../../theme/gcsTheme';

export interface DualJoystickControllerProps {
  size: number;
  isCompactLandscape?: boolean;
  onUpdateLeft: (x: number, y: number, active: boolean) => void;
  onUpdateRight: (x: number, y: number, active: boolean) => void;
}

/**
 * DualJoystickController coordinates simultaneous two-finger multi-touch for
 * Mode 2 flight controls (Left: Throttle/Yaw, Right: Pitch/Roll).
 *
 * Each stick manages its own pointer lifecycle independently via native touch events,
 * guaranteeing 100% simultaneous movement without gesture collisions or cancellations.
 */
export function DualJoystickController({
  size,
  isCompactLandscape = false,
  onUpdateLeft,
  onUpdateRight,
}: DualJoystickControllerProps) {
  return (
    <View style={styles.controlsLayer} pointerEvents="box-none">
      <View
        style={[styles.leftStick, isCompactLandscape && styles.leftStickCompact]}
        pointerEvents="auto"
      >
        <VirtualJoystick
          size={size}
          mode="THROTTLE_YAW"
          onUpdate={onUpdateLeft}
        />
      </View>
      <View
        style={[styles.rightStick, isCompactLandscape && styles.rightStickCompact]}
        pointerEvents="auto"
      >
        <VirtualJoystick
          size={size}
          mode="PITCH_ROLL"
          onUpdate={onUpdateRight}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlsLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: layers.controls,
  },
  leftStick: {
    position: 'absolute',
    left: 20,
    bottom: 18,
  },
  rightStick: {
    position: 'absolute',
    right: 20,
    bottom: 18,
  },
  leftStickCompact: {
    left: 10,
  },
  rightStickCompact: {
    right: 10,
  },
});
