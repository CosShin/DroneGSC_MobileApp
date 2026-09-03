import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { selectConnectionStatus } from '../../store/connection/connectionSlice';
import {
  selectAttitude,
  selectGps,
  selectTelemetryStale,
  selectVelocity,
} from '../../store/telemetry/telemetrySlice';
import { useGcsLayout } from '../../hooks/useGcsLayout';
import {
  buildHeadingTape,
  clampAttitude,
  formatSignedAngle,
  HEADING_TICK_WIDTH,
} from '../../utils/flightInstruments';
import { hudColors } from '../../theme/gcsTheme';

const HORIZON_SIZE = 220;

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value}</Text>
        {unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

/** Compact, non-interactive FPV instrument cluster positioned between both sticks. */
export const CompactFlightHud = React.memo(function CompactFlightHud() {
  const layout = useGcsLayout();
  const connection = useAppSelector(selectConnectionStatus);
  const stale = useAppSelector(selectTelemetryStale);
  const attitude = useAppSelector(selectAttitude);
  const gps = useAppSelector(selectGps);
  const velocity = useAppSelector(selectVelocity);

  const compact = layout.isCompactLandscape || layout.contentHeight < 430;
  const telemetryLive = connection === 'CONNECTED' && !stale;
  const hasAttitude = telemetryLive && attitude != null;

  const roll = hasAttitude ? attitude.value.roll : 0;
  const pitch = hasAttitude ? attitude.value.pitch : 0;
  const heading = hasAttitude ? attitude.value.yaw : null;
  const tape = React.useMemo(() => buildHeadingTape(heading ?? 0), [heading]);

  const altitude = telemetryLive ? gps?.value.altitude ?? null : null;
  const groundSpeed = telemetryLive ? velocity?.value.groundSpeed ?? null : null;
  const verticalSpeed = telemetryLive ? velocity?.value.verticalSpeed ?? null : null;
  const satellites = telemetryLive ? gps?.value.satellites ?? null : null;
  const pitchOffset = clampAttitude(pitch, 30) * 1.15;

  return (
    <View
      accessibilityLabel="Flight telemetry HUD"
      pointerEvents="none"
      style={[styles.shell, compact && styles.shellCompact]}
    >
      <View style={styles.compassHeader}>
        <View style={styles.liveState}>
          <View style={[styles.liveDot, !telemetryLive && styles.liveDotLost]} />
          <Text style={[styles.liveLabel, !telemetryLive && styles.liveLabelLost]}>
            {telemetryLive ? 'TELEM' : 'NO DATA'}
          </Text>
        </View>

        <View style={styles.compassWindow}>
          <View
            style={[
              styles.compassTape,
              {
                width: tape.ticks.length * HEADING_TICK_WIDTH,
                transform: [{ translateX: tape.translateX }],
              },
            ]}
          >
            {tape.ticks.map((tick, index) => (
              <View key={`${tick.value}-${index}`} style={styles.compassTick}>
                <Text style={[styles.compassTickText, tick.major && styles.compassTickMajor]}>
                  {hasAttitude ? tick.label : '--'}
                </Text>
                <View style={[styles.tickLine, tick.major && styles.tickLineMajor]} />
              </View>
            ))}
          </View>
          <View style={styles.headingIndex} />
        </View>

        <View style={styles.headingReadout}>
          <Text style={styles.headingCardinal}>{hasAttitude ? tape.cardinal : '--'}</Text>
          <Text style={styles.headingValue}>
            {hasAttitude ? `${Math.round(tape.heading).toString().padStart(3, '0')}°` : '---°'}
          </Text>
        </View>
      </View>

      <View style={styles.instrumentRow}>
        <View style={styles.metricsColumn}>
          <Metric label="ALT" value={altitude == null ? '--' : altitude.toFixed(1)} unit="m" />
          <Metric label="V/S" value={verticalSpeed == null ? '--' : verticalSpeed.toFixed(1)} unit="m/s" />
        </View>

        <View style={styles.attitudeGroup}>
          <View style={[styles.attitudeBezel, compact && styles.attitudeBezelCompact]}>
            <View
              style={[
                styles.movingHorizon,
                {
                  transform: [
                    { rotateZ: `${-clampAttitude(roll, 60)}deg` },
                    { translateY: pitchOffset },
                  ],
                },
              ]}
            >
              <View style={styles.sky} />
              <View style={styles.ground} />
              <View style={styles.horizonLine} />
              <View style={[styles.pitchLine, styles.pitchLineUp]} />
              <View style={[styles.pitchLine, styles.pitchLineDown]} />
            </View>

            <View style={styles.bankIndex} />
            <View style={styles.aircraftReference}>
              <View style={styles.aircraftWing} />
              <View style={styles.aircraftDot} />
              <View style={styles.aircraftWing} />
            </View>
          </View>

          <View style={styles.angleRow}>
            <Text style={styles.angleText}>R {hasAttitude ? formatSignedAngle(roll) : '--'}</Text>
            <View style={styles.angleDivider} />
            <Text style={styles.angleText}>P {hasAttitude ? formatSignedAngle(pitch) : '--'}</Text>
          </View>
        </View>

        <View style={styles.metricsColumn}>
          <Metric label="G/S" value={groundSpeed == null ? '--' : groundSpeed.toFixed(1)} unit="m/s" />
          <Metric label="GPS" value={satellites == null ? '--' : satellites.toString()} unit="sat" />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    width: 316,
    height: 130,
    paddingHorizontal: 9,
    paddingTop: 7,
    paddingBottom: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    shadowColor: '#3B4A5E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  shellCompact: {
    width: 292,
    height: 120,
    borderRadius: 16,
    paddingTop: 5,
    paddingBottom: 6,
  },
  compassHeader: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.18)',
  },
  liveState: {
    width: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  liveDotLost: {
    backgroundColor: '#FB7185',
  },
  liveLabel: {
    color: '#047857',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  liveLabelLost: {
    color: '#BE123C',
  },
  compassWindow: {
    flex: 1,
    height: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  compassTape: {
    height: 27,
    flexDirection: 'row',
    alignSelf: 'center',
  },
  compassTick: {
    width: HEADING_TICK_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 1,
  },
  compassTickText: {
    color: '#475569',
    fontSize: 8,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  compassTickMajor: {
    color: '#0F172A',
    fontSize: 9,
  },
  tickLine: {
    marginTop: 3,
    width: 1,
    height: 4,
    backgroundColor: 'rgba(71, 85, 105, 0.55)',
  },
  tickLineMajor: {
    height: 7,
    backgroundColor: '#334155',
  },
  headingIndex: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    marginLeft: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 0,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#10B981',
  },
  headingReadout: {
    width: 52,
    alignItems: 'flex-end',
  },
  headingCardinal: {
    color: '#047857',
    fontSize: 8,
    fontWeight: '900',
  },
  headingValue: {
    color: '#0F172A',
    fontSize: 11,
    lineHeight: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  instrumentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 5,
  },
  metricsColumn: {
    width: 64,
    gap: 5,
  },
  metric: {
    height: 31,
    justifyContent: 'center',
    paddingHorizontal: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.68)',
  },
  metricLabel: {
    color: '#047857',
    fontSize: 7,
    lineHeight: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  metricValue: {
    color: '#0F172A',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    color: '#475569',
    fontSize: 6.5,
    fontWeight: '800',
  },
  attitudeGroup: {
    width: 82,
    alignItems: 'center',
  },
  attitudeBezel: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(226, 232, 240, 0.88)',
    backgroundColor: hudColors.sky,
  },
  attitudeBezelCompact: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  movingHorizon: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: HORIZON_SIZE,
    height: HORIZON_SIZE,
    marginLeft: -HORIZON_SIZE / 2,
    marginTop: -HORIZON_SIZE / 2,
  },
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: hudColors.sky,
  },
  ground: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: hudColors.ground,
  },
  horizonLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    marginTop: -1,
    backgroundColor: '#F8FAFC',
  },
  pitchLine: {
    position: 'absolute',
    left: '50%',
    width: 22,
    height: 1,
    marginLeft: -11,
    backgroundColor: 'rgba(248, 250, 252, 0.80)',
  },
  pitchLineUp: {
    top: '44%',
  },
  pitchLineDown: {
    top: '56%',
  },
  bankIndex: {
    position: 'absolute',
    top: 3,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FBBF24',
  },
  aircraftReference: {
    width: 49,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aircraftWing: {
    width: 18,
    height: 2,
    backgroundColor: '#FBBF24',
  },
  aircraftDot: {
    width: 7,
    height: 7,
    marginHorizontal: 3,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FBBF24',
  },
  angleRow: {
    height: 13,
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  angleText: {
    color: '#334155',
    fontSize: 7,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  angleDivider: {
    width: 1,
    height: 7,
    backgroundColor: 'rgba(71, 85, 105, 0.32)',
  },
});
