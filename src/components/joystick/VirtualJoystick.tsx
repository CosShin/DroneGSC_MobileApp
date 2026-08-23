import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent, State } from 'react-native-gesture-handler';

interface Props {
  size?: number;
  mode?: 'THROTTLE_YAW' | 'PITCH_ROLL';
  onUpdate: (x: number, y: number, active: boolean) => void;
}

export function VirtualJoystick({ size = 120, mode = 'PITCH_ROLL', onUpdate }: Props) {
  const [isEngaged, setIsEngaged] = useState(false);
  const [valX, setValX] = useState(0);
  const [valY, setValY] = useState(0);
  
  // Max radius the stick can travel
  const radius = size / 2;
  const stickRadius = size / 3.6;
  const maxTravel = radius - stickRadius;

  const pan = useRef(new Animated.ValueXY()).current;
  const activeRef = useRef(false);

  const notifyUpdate = (dx: number, dy: number, active: boolean) => {
    // Normalize to [-1, 1]
    let nx = dx / maxTravel;
    let ny = dy / maxTravel;
    
    nx = Math.max(-1, Math.min(1, nx));
    ny = Math.max(-1, Math.min(1, ny));
    
    setValX(nx);
    setValY(ny);
    onUpdate(nx, ny, active);
  };

  const handleGestureEvent = (e: PanGestureHandlerGestureEvent) => {
    let dx = e.nativeEvent.translationX;
    let dy = e.nativeEvent.translationY;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxTravel) {
      dx = (dx / distance) * maxTravel;
      dy = (dy / distance) * maxTravel;
    }

    pan.setValue({ x: dx, y: dy });
    notifyUpdate(dx, dy, true);
  };

  const handleStateChange = (e: PanGestureHandlerGestureEvent) => {
    if (e.nativeEvent.state === State.BEGAN) {
      activeRef.current = true;
      setIsEngaged(true);
    } else if (e.nativeEvent.state === State.END || e.nativeEvent.state === State.CANCELLED || e.nativeEvent.state === State.FAILED) {
      activeRef.current = false;
      setIsEngaged(false);
      
      // Spring back to center
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false,
        friction: 6,
        tension: 100,
      }).start();
      
      setValX(0);
      setValY(0);
      notifyUpdate(0, 0, false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeRef.current) {
        onUpdate(0, 0, false);
      }
    };
  }, []);

  // Compute live display percentages
  const isLeftStick = mode === 'THROTTLE_YAW';
  // Stealth Aerospace Gunmetal Gray & Titanium Silver Theme
  const themeColor = '#e2e8f0';
  const themeBorder = 'rgba(203, 213, 225, 0.35)';

  // In RC Mode 2, Throttle: up is positive (0 to 100% or -100 to +100)
  const throttlePct = Math.round((-valY + 1) * 50); // 0% at bottom, 50% at center, 100% at top
  const yawPct = Math.round(valX * 100);
  const pitchPct = Math.round(-valY * 100);
  const rollPct = Math.round(valX * 100);

  const yawStr = yawPct > 0 ? `+${yawPct}%` : `${yawPct}%`;
  const pitchStr = pitchPct > 0 ? `+${pitchPct}%` : `${pitchPct}%`;
  const rollStr = rollPct > 0 ? `+${rollPct}%` : `${rollPct}%`;

  return (
    <View style={styles.wrapper}>
      {/* Live Readout Pill Badge */}
      <View style={[
        styles.readoutPill, 
        { borderColor: isEngaged ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)' },
        isEngaged && { backgroundColor: 'rgba(15, 23, 42, 0.96)' }
      ]}>
        {isLeftStick ? (
          <Text style={styles.readoutText}>
            THR: <Text style={[styles.readoutVal, { color: '#f8fafc' }]}>{throttlePct}%</Text>  YAW: <Text style={[styles.readoutVal, { color: '#f8fafc' }]}>{yawStr}</Text>
          </Text>
        ) : (
          <Text style={styles.readoutText}>
            PIT: <Text style={[styles.readoutVal, { color: '#f8fafc' }]}>{pitchStr}</Text>  ROL: <Text style={[styles.readoutVal, { color: '#f8fafc' }]}>{rollStr}</Text>
          </Text>
        )}
      </View>

      <PanGestureHandler
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleStateChange}
      >
        <View 
          style={[
            styles.gimbalBezel, 
            { 
              width: size, 
              height: size, 
              borderRadius: size / 2,
              borderColor: isEngaged ? '#e2e8f0' : themeBorder,
              shadowColor: isEngaged ? '#ffffff' : '#000',
            },
            isEngaged && styles.gimbalBezelEngaged
          ]}
        >
          {/* CNC Outer Notch Ring */}
          <View style={[styles.cncGuardRing, { width: size * 0.85, height: size * 0.85, borderRadius: (size * 0.85) / 2 }]} />
          
          {/* Concentric Deflection Rings */}
          <View style={[
            styles.deflectionRing, 
            { 
              width: size * 0.55, 
              height: size * 0.55, 
              borderRadius: (size * 0.55) / 2,
              borderColor: 'rgba(203, 213, 225, 0.2)',
            }
          ]} />
          
          {/* Axis Crosshairs */}
          <View style={styles.axisH} />
          <View style={styles.axisV} />

          {/* Mode 2 Left: Throttle Notch Scale (0%, 25%, 50%, 75%, 100%) */}
          {isLeftStick ? (
            <>
              {/* Vertical Scale Ticks */}
              <View style={styles.throttleScaleContainer}>
                <View style={styles.throttleTickMark}><Text style={styles.scaleNumber}>100</Text></View>
                <View style={styles.throttleTickMark}><Text style={styles.scaleNumber}>75</Text></View>
                <View style={[styles.throttleTickMark, styles.throttleCenterMark]}><Text style={[styles.scaleNumber, styles.hoverCenterText]}>50</Text></View>
                <View style={styles.throttleTickMark}><Text style={styles.scaleNumber}>25</Text></View>
                <View style={styles.throttleTickMark}><Text style={styles.scaleNumber}>0</Text></View>
              </View>

              {/* Yaw Labels */}
              <Text style={[styles.yawLeftLabel, { color: '#cbd5e1' }]}>◀ L</Text>
              <Text style={[styles.yawRightLabel, { color: '#cbd5e1' }]}>R ▶</Text>
            </>
          ) : (
            /* Mode 2 Right: 4-Way Directional Arrow Guides */
            <>
              <Text style={[styles.dirFwd, { color: '#cbd5e1' }]}>▲ FWD</Text>
              <Text style={[styles.dirRev, { color: '#cbd5e1' }]}>▼ REV</Text>
              <Text style={[styles.dirLeft, { color: '#cbd5e1' }]}>◀ L</Text>
              <Text style={[styles.dirRight, { color: '#cbd5e1' }]}>R ▶</Text>
            </>
          )}

          {/* Center Rest Crosshair Notch */}
          <View style={[styles.centerRestDot, { backgroundColor: '#e2e8f0' }]} />

          {/* Machined Metal Thumbstick Stick-End */}
          <Animated.View
            style={[
              styles.knurledStick,
              { 
                width: stickRadius * 2, 
                height: stickRadius * 2, 
                borderRadius: stickRadius,
                marginLeft: -stickRadius,
                marginTop: -stickRadius,
                borderColor: isEngaged ? '#ffffff' : 'rgba(203, 213, 225, 0.45)',
                shadowColor: isEngaged ? '#ffffff' : '#000',
              },
              isEngaged && styles.knurledStickEngaged,
              {
                transform: [{ translateX: pan.x }, { translateY: pan.y }],
              },
            ]}
          >
            {/* Grip Texture Concentric Rings */}
            <View style={styles.stickGripRing} />
            {/* Center Status LED */}
            <View style={[
              styles.stickCenterLed,
              { backgroundColor: isEngaged ? '#ffffff' : 'rgba(203, 213, 225, 0.6)' },
              isEngaged && { shadowColor: '#ffffff', backgroundColor: '#ffffff' }
            ]} />
          </Animated.View>
        </View>
      </PanGestureHandler>

      {/* Axis Type Subtitle */}
      <Text style={[styles.gimbalTitle, { color: '#94a3b8' }]}>
        {isLeftStick ? 'MODE 2: THROTTLE / YAW' : 'MODE 2: PITCH / ROLL'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  readoutPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 4,
  },
  readoutText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  readoutVal: {
    fontWeight: '900',
  },
  gimbalBezel: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  gimbalBezelEngaged: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    shadowOpacity: 0.7,
    shadowRadius: 12,
  },
  cncGuardRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.2)',
    borderStyle: 'dashed',
  },
  deflectionRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  axisH: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  axisV: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  throttleScaleContainer: {
    position: 'absolute',
    left: 6,
    top: 10,
    bottom: 10,
    justifyContent: 'space-between',
  },
  throttleTickMark: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  throttleCenterMark: {
    borderLeftWidth: 3,
    borderLeftColor: '#e2e8f0',
    paddingLeft: 2,
  },
  scaleNumber: {
    color: '#94a3b8',
    fontSize: 7.5,
    fontWeight: 'bold',
  },
  hoverCenterText: {
    color: '#f8fafc',
    fontWeight: '900',
  },
  yawLeftLabel: {
    position: 'absolute',
    left: 8,
    fontSize: 8,
    fontWeight: '800',
  },
  yawRightLabel: {
    position: 'absolute',
    right: 8,
    fontSize: 8,
    fontWeight: '800',
  },
  dirFwd: {
    position: 'absolute',
    top: 6,
    fontSize: 7.5,
    fontWeight: '800',
  },
  dirRev: {
    position: 'absolute',
    bottom: 6,
    fontSize: 7.5,
    fontWeight: '800',
  },
  dirLeft: {
    position: 'absolute',
    left: 6,
    fontSize: 7.5,
    fontWeight: '800',
  },
  dirRight: {
    position: 'absolute',
    right: 6,
    fontSize: 7.5,
    fontWeight: '800',
  },
  centerRestDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.6,
  },
  knurledStick: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 8,
  },
  knurledStickEngaged: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  stickGripRing: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.25)',
    borderStyle: 'dashed',
  },
  stickCenterLed: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1,
    borderColor: '#fff',
  },
  gimbalTitle: {
    marginTop: 4,
    fontWeight: '800',
    fontSize: 8.5,
    letterSpacing: 0.8,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
