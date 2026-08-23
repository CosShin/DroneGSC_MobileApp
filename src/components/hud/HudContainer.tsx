import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '../../store/hooks';
import { selectAttitude, selectGps, selectVelocity, selectBattery } from '../../store/telemetry/telemetrySlice';
import { selectDroneMode, selectIsArmed } from '../../store/drone/droneSlice';
import { selectVideoSettings } from '../../store/settings/settingsSlice';
import { VideoStream } from '../video/VideoStream';

const PITCH_SCALE = 6; // Pixels per degree of pitch
const DEG_TO_RAD = Math.PI / 180;

export function HudContainer() {
  const insets = useSafeAreaInsets();
  const attitude = useAppSelector(selectAttitude);
  const gps = useAppSelector(selectGps);
  const velocity = useAppSelector(selectVelocity);
  const battery = useAppSelector(selectBattery);
  const mode = useAppSelector(selectDroneMode);
  const isArmed = useAppSelector(selectIsArmed);
  const videoSettings = useAppSelector(selectVideoSettings);

  const isVideoActive = videoSettings.source !== 'Disabled';

  const roll = attitude?.value.roll || 0;
  const pitch = attitude?.value.pitch || 0;
  const yaw = attitude?.value.yaw || 0;
  const altitude = gps?.value.altitude || 0;
  const speed = velocity?.value.groundSpeed || 0;
  const satellites = gps?.value.satellites || 0;
  const gpsFix = gps?.value.gpsFix || 0;

  const voltage = battery?.value.voltage || 0;
  const current = battery?.value.current || 0;
  const percentage = battery?.value.percentage || 0;

  // Normalized heading string (0 - 359)
  const heading = ((Math.round(yaw) % 360) + 360) % 360;

  // Roll arc angle ticks
  const rollTicks = useMemo(() => [
    { deg: -60, label: '60' },
    { deg: -45, label: '45' },
    { deg: -30, label: '30' },
    { deg: -20, label: '20' },
    { deg: -10, label: '10' },
    { deg: 0, label: '0' },
    { deg: 10, label: '10' },
    { deg: 20, label: '20' },
    { deg: 30, label: '30' },
    { deg: 45, label: '45' },
    { deg: 60, label: '60' },
  ], []);

  const bgSize = 2500;

  return (
    <View style={styles.container}>
      {/* 1. Artificial Horizon Background (Sky & Ground) */}
      <Animated.View
        style={[
          styles.horizonContainer,
          {
            width: bgSize,
            height: bgSize,
            left: '50%',
            top: '50%',
            marginLeft: -bgSize / 2,
            marginTop: -bgSize / 2,
            transform: [
              { rotateZ: `${-roll}deg` },
              { translateY: pitch * PITCH_SCALE }
            ],
          },
        ]}
      >
        <View style={styles.sky} />
        <View style={styles.ground} />
        
        {/* Horizon Dividing Level Line */}
        <View style={styles.horizonLineContainer}>
          <View style={styles.horizonBarRedLeft} />
          <View style={styles.horizonCenterGreen} />
          <View style={styles.horizonBarRedRight} />
        </View>
      </Animated.View>

      {/* Optional Live Video Feed */}
      {isVideoActive && <VideoStream />}

      {/* 2. Pitch Ladder (Rotates with Roll, Moves with Pitch) */}
      <View style={styles.pitchLadderWrapper} pointerEvents="none">
        <Animated.View
          style={{
            alignItems: 'center',
            transform: [
              { rotateZ: `${-roll}deg` },
              { translateY: pitch * PITCH_SCALE }
            ],
          }}
        >
          {[-20, -10, 0, 10, 20].map((deg) => {
            return (
              <View 
                key={deg} 
                style={[
                  styles.pitchRungRow,
                  { position: 'absolute', top: -deg * PITCH_SCALE - 6 }
                ]}
              >
                <Text style={styles.pitchDegText}>{deg}</Text>
                <View style={[styles.pitchWhiteLine, deg === 0 && styles.pitchZeroLine]} />
              </View>
            );
          })}

          {/* Central Arming Status Text on HUD */}
          <Text style={[styles.armingStatusText, isArmed ? styles.armedText : styles.disarmedText]}>
            {isArmed ? 'ARMED' : 'DISARMED'}
          </Text>
        </Animated.View>
      </View>

      {/* 3. Static Center Aircraft Wings & Reticle */}
      <View style={styles.centerReticle} pointerEvents="none">
        <View style={styles.reticleLeftWing} />
        <View style={styles.reticleCenterChevron}>
          <View style={styles.chevronLeft} />
          <View style={styles.chevronRight} />
        </View>
        <View style={styles.reticleRightWing} />
      </View>

      {/* 4. Top Roll Arc (Bank Angle Scale) */}
      <View style={styles.rollArcWrapper} pointerEvents="none">
        {/* Top Roll Indicator Pointer Triangle */}
        <View style={styles.rollPointer} />

        {/* Curved Roll Arc Scale */}
        <View style={styles.rollArcContainer}>
          {rollTicks.map((tick) => {
            const rad = (tick.deg - 90) * DEG_TO_RAD;
            const r = 140; // Arc radius
            const cx = 150;
            const cy = 150;
            const x = cx + r * Math.cos(rad);
            const y = cy + r * Math.sin(rad);

            return (
              <View 
                key={tick.deg} 
                style={[
                  styles.rollTickContainer, 
                  { left: x - 12, top: y - 10 }
                ]}
              >
                <Text style={styles.rollTickText}>{tick.label}</Text>
              </View>
            );
          })}
          <View style={styles.rollArcLine} />
        </View>
      </View>

      {/* 5. Left Speed Tape */}
      <View 
        style={[
          styles.leftSpeedTape,
          { left: 56 }
        ]} 
        pointerEvents="none"
      >
        {/* Throttle Bar Indicator */}
        <View style={styles.throttleBarRow}>
          <View style={styles.stickBar} />
          <View style={[styles.stickBar, styles.stickBarActive]} />
          <View style={styles.stickBar} />
        </View>

        {/* Speed Scale Container */}
        <View style={styles.tapeColumn}>
          {[10, 5, 0, -5, -10].map((v) => (
            <View key={v} style={styles.tapeMarkRow}>
              <Text style={styles.tapeNumberText}>{v}</Text>
              <View style={styles.tapeTick} />
            </View>
          ))}

          {/* Current Speed Badge Arrow */}
          <View style={styles.speedPointerBadge}>
            <Text style={styles.speedPointerText}>{speed.toFixed(0)}m/s</Text>
            <View style={styles.pointerArrowRight} />
          </View>
        </View>

        {/* Bottom Speed Text */}
        <View style={styles.speedFooter}>
          <Text numberOfLines={1} style={styles.speedFooterText}>AS 0.0m/s</Text>
          <Text numberOfLines={1} style={styles.speedFooterText}>GS {speed.toFixed(1)}m/s</Text>
        </View>
      </View>

      {/* 6. Right Altitude Tape */}
      <View 
        style={[
          styles.rightAltTape,
          { right: 10 }
        ]} 
        pointerEvents="none"
      >
        {/* Top Flight Time & Battery */}
        <View style={styles.altTopHeader}>
          <Text numberOfLines={1} style={styles.flightTimeText}>00:00:00</Text>
        </View>

        {/* Altitude Scale Container */}
        <View style={styles.tapeColumnAlt}>
          {/* Current Altitude Badge Arrow */}
          <View style={styles.altPointerBadge}>
            <View style={styles.pointerArrowLeft} />
            <Text style={styles.altPointerText}>{altitude.toFixed(0)} m</Text>
          </View>

          {[10, 5, 0, -5, -10].map((v) => (
            <View key={v} style={styles.tapeMarkRowAlt}>
              <View style={styles.tapeTickAlt} />
              <Text style={styles.tapeNumberTextAlt}>{v}</Text>
            </View>
          ))}
        </View>

        {/* Bottom Mode & Target Alt */}
        <View style={styles.altFooter}>
          <Text numberOfLines={1} style={styles.modeStatusText}>{mode || 'Unknown'}</Text>
          <Text numberOfLines={1} style={styles.targetAltText}>{altitude.toFixed(0)}m&gt;0</Text>
        </View>
      </View>

      {/* 7. Bottom Center Circular Compass & Telemetry Badges (Between Joysticks) */}
      <View style={styles.circularCompassWrapper} pointerEvents="none">
        {/* Telemetry Stats: GPS | Heading | Battery */}
        <View style={styles.bottomTelemetryRow}>
          {/* GPS Badge */}
          <View style={styles.bottomStatBadge}>
            <Text style={styles.bottomStatLabel}>GPS</Text>
            <Text style={styles.bottomStatValue}>{satellites}</Text>
          </View>

          {/* Heading Readout Pill */}
          <View style={styles.headingPill}>
            <Text style={styles.headingPillText}>{heading.toString().padStart(3, '0')}°</Text>
          </View>

          {/* Battery Badge */}
          <View style={styles.bottomStatBadge}>
            <Text style={styles.bottomStatLabel}>BAT</Text>
            <Text style={[
              styles.bottomStatValue, 
              { color: percentage > 50 ? '#22c55e' : percentage > 20 ? '#f59e0b' : '#ef4444' }
            ]}>
              {Math.round(percentage)}%
            </Text>
          </View>
        </View>

        {/* Rotating Compass Rose Dial */}
        <Animated.View 
          style={[
            styles.compassDial,
            {
              transform: [{ rotateZ: `${-yaw}deg` }],
            }
          ]}
        >
          {/* Cardinal Labels */}
          <Text style={[styles.cardinalLabel, styles.cardinalN]}>N</Text>
          <Text style={[styles.cardinalLabel, styles.cardinalE]}>E</Text>
          <Text style={[styles.cardinalLabel, styles.cardinalS]}>S</Text>
          <Text style={[styles.cardinalLabel, styles.cardinalW]}>W</Text>

          {/* Diagonal Tick Marks */}
          <View style={[styles.compassCrossTick, { transform: [{ rotate: '45deg' }] }]} />
          <View style={[styles.compassCrossTick, { transform: [{ rotate: '135deg' }] }]} />

          {/* Inner concentric ring */}
          <View style={styles.compassInnerRing} />
        </Animated.View>

        {/* Static Heading Pointer (Aircraft Reticle pointing UP) */}
        <View style={styles.staticAircraftPointer}>
          <View style={styles.planeNose} />
          <View style={styles.planeWings} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  horizonContainer: {
    position: 'absolute',
    flexDirection: 'column',
  },
  sky: {
    flex: 1,
    backgroundColor: '#528cf0', // Bright sky blue (Mission Planner style)
  },
  ground: {
    flex: 1,
    backgroundColor: '#7b9c14', // Fresh olive-green grass (Mission Planner style)
  },
  horizonLineContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -1.5,
  },
  horizonBarRedLeft: {
    width: 60,
    height: 3,
    backgroundColor: '#ff0000',
    marginRight: 40,
  },
  horizonCenterGreen: {
    width: 80,
    height: 2,
    backgroundColor: '#00e676',
  },
  horizonBarRedRight: {
    width: 60,
    height: 3,
    backgroundColor: '#ff0000',
    marginLeft: 40,
  },
  pitchLadderWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pitchRungRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 180,
    height: 12,
  },
  pitchDegText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    width: 32,
    textAlign: 'right',
    marginRight: 10,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  pitchWhiteLine: {
    width: 70,
    height: 1.5,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  pitchZeroLine: {
    width: 80,
    height: 2,
  },
  armingStatusText: {
    position: 'absolute',
    top: -55,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
  armedText: {
    color: '#00ff00',
  },
  disarmedText: {
    color: '#ff0000',
  },
  centerReticle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 80,
    height: 30,
    marginLeft: -40,
    marginTop: -15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleLeftWing: {
    width: 25,
    height: 3,
    backgroundColor: '#ff0000',
  },
  reticleCenterChevron: {
    width: 30,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chevronLeft: {
    position: 'absolute',
    left: 3,
    top: 6,
    width: 14,
    height: 3,
    backgroundColor: '#ff0000',
    transform: [{ rotate: '-30deg' }],
  },
  chevronRight: {
    position: 'absolute',
    right: 3,
    top: 6,
    width: 14,
    height: 3,
    backgroundColor: '#ff0000',
    transform: [{ rotate: '30deg' }],
  },
  reticleRightWing: {
    width: 25,
    height: 3,
    backgroundColor: '#ff0000',
  },
  rollArcWrapper: {
    position: 'absolute',
    top: 48,
    left: '50%',
    marginLeft: -150,
    width: 300,
    height: 150,
    alignItems: 'center',
  },
  rollPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#ff0000',
    zIndex: 10,
    marginTop: 4,
  },
  rollArcContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 300,
    height: 150,
  },
  rollArcLine: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  rollTickContainer: {
    position: 'absolute',
    width: 24,
    alignItems: 'center',
  },
  rollTickText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  circularCompassWrapper: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    marginLeft: -44,
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  bottomTelemetryRow: {
    position: 'absolute',
    top: -24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    zIndex: 35,
  },
  bottomStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 15, 26, 0.85)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  bottomStatIcon: {
    fontSize: 9,
    marginRight: 2,
  },
  bottomStatLabel: {
    color: '#64748b',
    fontSize: 7.5,
    fontWeight: '700',
    marginRight: 2,
  },
  bottomStatValue: {
    color: '#e2e8f0',
    fontSize: 9.5,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  headingPill: {
    backgroundColor: 'rgba(10, 15, 26, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 30,
  },
  headingPillText: {
    color: '#00ffff',
    fontSize: 10,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  compassDial: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(10, 15, 26, 0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardinalLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  cardinalN: {
    top: 2,
    alignSelf: 'center',
    color: '#ff3333',
  },
  cardinalS: {
    bottom: 2,
    alignSelf: 'center',
    color: '#ffffff',
  },
  cardinalE: {
    right: 4,
    top: '50%',
    marginTop: -7,
    color: '#ffffff',
  },
  cardinalW: {
    left: 4,
    top: '50%',
    marginTop: -7,
    color: '#ffffff',
  },
  compassCrossTick: {
    position: 'absolute',
    width: 72,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  compassInnerRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
  },
  staticAircraftPointer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    zIndex: 25,
  },
  planeNose: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 7,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#ff0000',
    marginBottom: -1,
  },
  planeWings: {
    width: 16,
    height: 2.5,
    backgroundColor: '#ff0000',
    borderRadius: 1,
  },
  leftSpeedTape: {
    position: 'absolute',
    left: 56,
    top: '50%',
    marginTop: -85,
    width: 54,
    alignItems: 'flex-start',
  },
  throttleBarRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 4,
  },
  stickBar: {
    width: 2,
    height: 14,
    backgroundColor: '#ffffff',
  },
  stickBarActive: {
    backgroundColor: '#00e676',
    height: 16,
  },
  tapeColumn: {
    width: 46,
    height: 130,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'space-between',
    paddingVertical: 6,
    position: 'relative',
  },
  tapeMarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  tapeNumberText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  tapeTick: {
    width: 6,
    height: 1.5,
    backgroundColor: '#ffffff',
  },
  speedPointerBadge: {
    position: 'absolute',
    top: '50%',
    right: -24,
    marginTop: -9,
    height: 18,
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderRadius: 2,
    zIndex: 10,
  },
  speedPointerText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pointerArrowRight: {
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#000000',
    marginLeft: 2,
  },
  speedFooter: {
    marginTop: 4,
    alignItems: 'flex-start',
  },
  speedFooterText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  rightAltTape: {
    position: 'absolute',
    right: 56,
    top: '50%',
    marginTop: -85,
    width: 54,
    alignItems: 'flex-end',
  },
  altTopHeader: {
    marginBottom: 4,
    alignItems: 'flex-end',
  },
  flightTimeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  tapeColumnAlt: {
    width: 46,
    height: 130,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'space-between',
    paddingVertical: 6,
    position: 'relative',
  },
  tapeMarkRowAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  tapeTickAlt: {
    width: 6,
    height: 1.5,
    backgroundColor: '#ffffff',
  },
  tapeNumberTextAlt: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  altPointerBadge: {
    position: 'absolute',
    top: '50%',
    left: -24,
    marginTop: -9,
    height: 18,
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderRadius: 2,
    zIndex: 10,
  },
  pointerArrowLeft: {
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#000000',
    marginRight: 2,
  },
  altPointerText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  altFooter: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
  modeStatusText: {
    color: '#ff0000',
    fontSize: 10,
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  targetAltText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
