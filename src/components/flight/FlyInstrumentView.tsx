import React, { useMemo } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import {
  selectRoll, selectPitch, selectYaw, selectAltitude,
  selectGroundSpeed, selectVerticalSpeed, selectHeading, selectTelemetryStale,
} from '../../store/telemetry/telemetrySlice';
import { selectPacketsPerSec, selectConnectionStatus, selectVehicleState } from '../../store/connection/connectionSlice';
import { useGcsLayout } from '../../hooks/useGcsLayout';
import { glassShadow } from '../../theme/gcsTheme';

const PITCH_SCALE = 4.8;

export const FlyInstrumentView = React.memo(function FlyInstrumentView() {
  const layout = useGcsLayout();

  const roll = useAppSelector(selectRoll);
  const pitch = useAppSelector(selectPitch);
  const yaw = useAppSelector(selectYaw);
  const altitude = useAppSelector(selectAltitude);
  const groundSpeed = useAppSelector(selectGroundSpeed);
  const verticalSpeed = useAppSelector(selectVerticalSpeed);
  const heading = useAppSelector(selectHeading);
  
  const pps = useAppSelector(selectPacketsPerSec);
  const connectionStatus = useAppSelector(selectConnectionStatus);
  const vehicleState = useAppSelector(selectVehicleState);
  const telemetryStale = useAppSelector(selectTelemetryStale);

  const isCompact = layout.isCompactLandscape || layout.contentHeight < 450;

  // Responsive sizes: Attitude circle size calculated to leave guaranteed 16-24px gap above the Bottom Toolbar
  const indicatorSize = isCompact 
    ? Math.min(235, Math.max(205, layout.contentHeight * 0.58))
    : Math.min(340, Math.max(250, layout.contentHeight * 0.56));

  const horizonSize = indicatorSize * 4;

  const isConnected = connectionStatus === 'CONNECTED' && vehicleState === 'CONNECTED';
  const telemetryLive = isConnected && !telemetryStale;
  const attitudeLive = telemetryLive && roll != null && pitch != null;
  const displayRoll = attitudeLive ? roll : 0;
  const displayPitch = attitudeLive ? pitch : 0;
  const rawHeading = heading ?? (yaw != null ? Math.round(((yaw % 360) + 360) % 360) : null);
  const activeHeading = attitudeLive ? rawHeading : null;

  const linkActivityLabel = useMemo(() => {
    if (!isConnected) return 'Disconnected';
    if (telemetryStale) return 'Stale';
    return pps > 0 ? 'Receiving' : 'No traffic';
  }, [isConnected, pps, telemetryStale]);

  // Roll arc ticks (0°, 10°, 20°, 30°, 45°, 60°)
  const rollTicks = useMemo(() => [
    { deg: -60 },
    { deg: -45 },
    { deg: -30, label: '30' },
    { deg: -20 },
    { deg: -10 },
    { deg: 0, label: '0', isCenter: true },
    { deg: 10 },
    { deg: 20 },
    { deg: 30, label: '30' },
    { deg: 45 },
    { deg: 60 },
  ], []);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* 1. HUD background — bundled locally so it works offline on the aircraft link. */}
      <View style={styles.hudBackgroundFrame} pointerEvents="none">
        <Image
          source={require('../../../assets/hud-background.png')}
          style={styles.hudBackground}
          resizeMode="cover"
          accessible={false}
        />
      </View>
      <View style={styles.backgroundWash} pointerEvents="none" />

      {/* 2. Main 3-Column Cockpit Workspace - Centered tightly around the circle */}
      <View style={[styles.cockpitGrid, isCompact && styles.cockpitGridCompact]} pointerEvents="box-none">
        
        {/* ================= LEFT COLUMN ================= */}
        <View style={[styles.column, styles.columnLeft]} pointerEvents="none">
          {/* ALTITUDE Card */}
          <View style={[styles.card, isCompact && styles.cardCompact]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="image-filter-hdr" size={11} color="#64748B" />
              <Text style={styles.cardLabel}>ALTITUDE</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={[styles.mainValue, isCompact && styles.mainValueCompact]}>
                {altitude != null && telemetryLive ? altitude.toFixed(1) : '--'}
              </Text>
              <Text style={styles.unitText}>m</Text>
            </View>
          </View>

          {/* GROUND SPEED Card */}
          <View style={[styles.card, isCompact && styles.cardCompact]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="speedometer" size={11} color="#64748B" />
              <Text style={styles.cardLabel}>GROUND SPEED</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={[styles.mainValue, isCompact && styles.mainValueCompact]}>
                {groundSpeed != null && telemetryLive ? groundSpeed.toFixed(1) : '--'}
              </Text>
              <Text style={styles.unitText}>m/s</Text>
            </View>
          </View>

          {/* Left spacer for joystick bounding clearance */}
          <View style={styles.joystickSpacer} />
        </View>

        {/* ================= CENTER COLUMN (ATTITUDE + HEADING) ================= */}
        <View style={styles.centerInstrumentArea} pointerEvents="none">
          {/* Circular Artificial Horizon Instrument */}
          <View 
            style={[
              styles.bezelCircle,
              !attitudeLive && styles.bezelUnavailable,
              { 
                width: indicatorSize, 
                height: indicatorSize, 
                borderRadius: indicatorSize / 2 
              }
            ]}
          >
            {/* Moving Sky / Ground Canvas */}
            <Animated.View
              style={[
                styles.movingHorizon,
                !attitudeLive && styles.hiddenAttitude,
                {
                  width: horizonSize,
                  height: horizonSize,
                  left: '50%',
                  top: '50%',
                  marginLeft: -horizonSize / 2,
                  marginTop: -horizonSize / 2,
                  transform: [
                    { rotateZ: `${-displayRoll}deg` },
                    { translateY: displayPitch * PITCH_SCALE }
                  ],
                },
              ]}
            >
              {/* Vivid Aviation Blue Sky */}
              <View style={styles.skyHalf} />
              
              {/* Vivid Bright Green Earth */}
              <View style={styles.groundHalf} />

              {/* Dividing White Horizon Line */}
              <View style={styles.horizonLine} />

              {/* Pitch Ladder (0, 10, 20, 30) */}
              <View style={styles.pitchLadder}>
                {/* Sky Pitch Rungs */}
                {[30, 20, 10].map((deg) => (
                  <View 
                    key={`sky-${deg}`} 
                    style={[
                      styles.pitchRow, 
                      { position: 'absolute', top: horizonSize / 2 - deg * PITCH_SCALE - 8 }
                    ]}
                  >
                    <Text style={styles.pitchText}>{deg}</Text>
                    <View style={styles.pitchLine} />
                    <Text style={styles.pitchText}>{deg}</Text>
                  </View>
                ))}

                {/* Ground Pitch Rungs */}
                {[10, 20, 30].map((deg) => (
                  <View 
                    key={`gnd-${deg}`} 
                    style={[
                      styles.pitchRow, 
                      { position: 'absolute', top: horizonSize / 2 + deg * PITCH_SCALE - 8 }
                    ]}
                  >
                    <Text style={styles.pitchText}>{deg}</Text>
                    <View style={styles.pitchLine} />
                    <Text style={styles.pitchText}>{deg}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            {!attitudeLive ? (
              <View style={styles.attitudeUnavailable}>
                <Text style={styles.attitudeUnavailableText}>ATTITUDE --</Text>
              </View>
            ) : null}

            {/* Static Bank Angle Scale (Outer Rim Ticks & Triangle Index) */}
            <View style={styles.rollScaleOverlay}>
              {/* Top Center Index Triangle (0°) */}
              <View style={styles.topZeroTriangle} />

              {/* 30° Left, 0° Center, 30° Right Markers */}
              <Text style={[styles.rollLabel, styles.rollLabelLeft]}>30</Text>
              <Text style={[styles.rollLabel, styles.rollLabelCenter]}>0</Text>
              <Text style={[styles.rollLabel, styles.rollLabelRight]}>30</Text>

              {/* Circular Ticks along top arc */}
              {rollTicks.map((tick) => {
                const rad = (tick.deg - 90) * (Math.PI / 180);
                const r = indicatorSize / 2 - 12;
                const cx = indicatorSize / 2;
                const cy = indicatorSize / 2;
                const x = cx + r * Math.cos(rad);
                const y = cy + r * Math.sin(rad);

                return (
                  <View
                    key={tick.deg}
                    style={[
                      styles.rollTickDot,
                      {
                        left: x - 1.5,
                        top: y - 1.5,
                      }
                    ]}
                  />
                );
              })}
            </View>

            {/* Static Aircraft Reference Symbol (Chevron + Wing Reference Tabs) */}
            <View style={styles.aircraftReticle}>
              {/* Left Yellow Wing Tab */}
              <View style={styles.yellowWingLeft} />

              {/* Center White Chevron Reticle */}
              <View style={styles.chevronSymbol}>
                <View style={styles.chevronLeftLeg} />
                <View style={styles.chevronRightLeg} />
                <View style={styles.chevronBaseLine} />
              </View>

              {/* Right Yellow Wing Tab */}
              <View style={styles.yellowWingRight} />
            </View>
          </View>

          {/* Heading Panel (Dark Glass Capsule Overlapping Bottom Edge of Instrument) */}
          <View style={[styles.headingPanel, isCompact && styles.headingPanelCompact]}>
            {/* West Readout */}
            <View style={styles.headingSideCol}>
              <Text style={styles.headingCardinal}>W</Text>
              <Text style={styles.headingSubVal}>{attitudeLive ? '270' : '--'}</Text>
            </View>

            {/* Divider */}
            <View style={styles.headingDivider} />

            {/* Center Main Heading (Bright Cyan/Blue Glow) */}
            <View style={styles.headingCenterCol}>
              <Text style={[styles.headingDegreeText, isCompact && styles.headingDegreeTextCompact]}>
                {activeHeading != null ? `${activeHeading.toString().padStart(3, '0')}°` : '---'}
              </Text>
            </View>

            {/* Divider */}
            <View style={styles.headingDivider} />

            {/* North Readout */}
            <View style={styles.headingSideCol}>
              <Text style={styles.headingCardinal}>N</Text>
              <Text style={styles.headingSubVal}>{attitudeLive ? '0' : '--'}</Text>
            </View>
          </View>
        </View>

        {/* ================= RIGHT COLUMN ================= */}
        <View style={[styles.column, styles.columnRight]} pointerEvents="none">
          {/* CLIMB RATE Card */}
          <View style={[styles.card, isCompact && styles.cardCompact]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="trending-up" size={11} color="#64748B" />
              <Text style={styles.cardLabel}>CLIMB RATE</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={[styles.mainValue, isCompact && styles.mainValueCompact]}>
                {verticalSpeed != null && telemetryLive ? verticalSpeed.toFixed(1) : '--'}
              </Text>
              <Text style={styles.unitText}>m/s</Text>
            </View>
          </View>

          {/* Actual observed MAVLink traffic; packet rate is not a radio-quality percentage. */}
          <View style={[styles.card, isCompact && styles.cardCompact]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="access-point" size={11} color="#10B981" />
              <Text style={styles.cardLabel}>MAVLINK RATE</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={[styles.mainValue, isCompact && styles.mainValueCompact]}>
                {telemetryLive ? pps : '--'}
              </Text>
              {telemetryLive ? <Text style={styles.unitText}>pps</Text> : null}
            </View>
            <Text style={styles.linkStatusText}>{linkActivityLabel}</Text>
          </View>

          {/* Right spacer for joystick bounding clearance */}
          <View style={styles.joystickSpacer} />
        </View>

      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: '#EDF4FB',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudBackgroundFrame: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
  },
  hudBackground: {
    width: '100%',
    height: '100%',
  },
  backgroundWash: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(232, 241, 250, 0.16)',
  },
  cockpitGrid: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 48,
    paddingBottom: 72,
  },
  cockpitGridCompact: {
    gap: 16,
    paddingTop: 44,
    paddingBottom: 68,
  },
  column: {
    width: 104,
    gap: 6,
    zIndex: 10,
  },
  columnLeft: {
    alignItems: 'flex-start',
  },
  columnRight: {
    alignItems: 'flex-end',
  },
  joystickSpacer: {
    height: 110,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 5,
    ...glassShadow,
  },
  cardCompact: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 1,
  },
  cardLabel: {
    color: '#64748B',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2.5,
  },
  mainValue: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  mainValueCompact: {
    fontSize: 14,
  },
  unitText: {
    color: '#64748B',
    fontSize: 8.5,
    fontWeight: '800',
    marginLeft: 1.5,
  },
  linkStatusText: {
    color: '#10B981',
    fontSize: 7.5,
    fontWeight: '800',
    marginTop: 0.5,
  },

  centerInstrumentArea: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 0,
    zIndex: 20,
  },
  bezelCircle: {
    overflow: 'hidden',
    borderWidth: 5.5,
    borderColor: 'rgba(255, 255, 255, 0.96)',
    backgroundColor: '#50A8F5',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1F3251',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  movingHorizon: {
    position: 'absolute',
  },
  hiddenAttitude: {
    opacity: 0,
  },
  bezelUnavailable: {
    backgroundColor: 'rgba(100, 116, 139, 0.28)',
  },
  attitudeUnavailable: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  attitudeUnavailableText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  skyHalf: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '50%',
    backgroundColor: '#50A8F5',
  },
  groundHalf: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#69BE00',
  },
  horizonLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#FFFFFF',
    marginTop: -1.25,
  },
  pitchLadder: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 130,
    height: 16,
    gap: 7,
  },
  pitchText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    width: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pitchLine: {
    width: 44,
    height: 1.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },

  rollScaleOverlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  topZeroTriangle: {
    position: 'absolute',
    top: 5,
    width: 0,
    height: 0,
    borderLeftWidth: 4.5,
    borderRightWidth: 4.5,
    borderBottomWidth: 7,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
  rollLabel: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  rollLabelLeft: {
    left: 20,
    top: 42,
  },
  rollLabelCenter: {
    top: 14,
    alignSelf: 'center',
  },
  rollLabelRight: {
    right: 20,
    top: 42,
  },
  rollTickDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  },

  aircraftReticle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 125,
    height: 28,
    marginLeft: -62.5,
    marginTop: -14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 25,
  },
  yellowWingLeft: {
    width: 25,
    height: 3.5,
    backgroundColor: '#F59E0B',
    borderRadius: 1.75,
  },
  yellowWingRight: {
    width: 25,
    height: 3.5,
    backgroundColor: '#F59E0B',
    borderRadius: 1.75,
  },
  chevronSymbol: {
    width: 28,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chevronLeftLeg: {
    position: 'absolute',
    left: 3,
    top: 4,
    width: 12,
    height: 3.5,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-35deg' }],
    borderRadius: 1.5,
  },
  chevronRightLeg: {
    position: 'absolute',
    right: 3,
    top: 4,
    width: 12,
    height: 3.5,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '35deg' }],
    borderRadius: 1.5,
  },
  chevronBaseLine: {
    position: 'absolute',
    bottom: 2,
    width: 14,
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },

  headingPanel: {
    marginTop: -15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 13,
    paddingVertical: 4,
    paddingHorizontal: 14,
    width: 220,
    height: 40,
    zIndex: 30,
    ...glassShadow,
  },
  headingPanelCompact: {
    width: 195,
    height: 36,
    marginTop: -14,
    paddingHorizontal: 10,
  },
  headingSideCol: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
  },
  headingCardinal: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  headingSubVal: {
    color: '#94A3B8',
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: -1,
  },
  headingDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  headingCenterCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingDegreeText: {
    color: '#38BDF8',
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  headingDegreeTextCompact: {
    fontSize: 19,
  },
});
