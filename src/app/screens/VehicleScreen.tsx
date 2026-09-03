import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CommandButton, EmptyStateCard, Panel, SectionTitle, StatusChip, TelemetryCard } from '../../components/gcs/Primitives';
import { FloatingWorkspace } from '../../components/gcs/FloatingWorkspace';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  selectSensors, 
  selectStatusTexts, 
  selectGps, 
  selectAttitude, 
  selectVelocity, 
  selectBattery 
} from '../../store/telemetry/telemetrySlice';
import { 
  selectActivePortInfo, 
  selectAutopilot, 
  selectLastHeartbeat, 
  selectPacketsPerSec, 
  selectTxPacketsPerSec,
  selectVehicleName 
} from '../../store/connection/connectionSlice';
import { selectDroneMode, selectIsArmed } from '../../store/drone/droneSlice';
import { selectConnectionConfig, setMainViewMode } from '../../store/settings/settingsSlice';
import { selectPendingCommand } from '../../store/command/commandSlice';
import { selectHomePosition, selectHomeStatus } from '../../store/home/homeSlice';
import { calculateBearingDegrees, calculateDistanceMeters, formatBearing, formatDistance } from '../../utils/geographic';
import { colors, glass, radius, spacing } from '../../theme/gcsTheme';
import { useScreenOrientation } from '../../hooks/useScreenOrientation';
import { useTruthfulTelemetry } from '../../hooks/useTruthfulTelemetry';
import { universalConnectionService } from '../../services/connection/UniversalConnectionService';
import { safetyLayer } from '../../services/command/SafetyLayer';
import { useGcsLayout } from '../../hooks/useGcsLayout';
import { VideoStream } from '../../components/video/VideoStream';
import { GlassSurface } from '../../components/gcs/GlassSurface';
import { MavlinkInspector } from '../../components/vehicle/MavlinkInspector';

type Tab = 'OVERVIEW' | 'SENSORS' | 'MAVLINK' | 'PRECISION LANDING' | 'MESSAGES';
const tabs: Tab[] = ['OVERVIEW', 'SENSORS', 'MAVLINK', 'PRECISION LANDING', 'MESSAGES'];

export function VehicleScreen() {
  useScreenOrientation();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const truth = useTruthfulTelemetry();
  const layout = useGcsLayout();
  const [tab, setTab] = React.useState<Tab>('OVERVIEW');

  const vehicle = useAppSelector(selectVehicleName);
  const autopilot = useAppSelector(selectAutopilot);
  const port = useAppSelector(selectActivePortInfo);
  const heartbeat = useAppSelector(selectLastHeartbeat);
  const pps = useAppSelector(selectPacketsPerSec);
  const txPps = useAppSelector(selectTxPacketsPerSec);
  const armed = useAppSelector(selectIsArmed);
  const mode = useAppSelector(selectDroneMode);
  const sensors = useAppSelector(selectSensors);
  const messages = useAppSelector(selectStatusTexts);
  const config = useAppSelector(selectConnectionConfig);
  const pending = useAppSelector(selectPendingCommand);
  const gps = useAppSelector(selectGps);
  const attitude = useAppSelector(selectAttitude);
  const velocity = useAppSelector(selectVelocity);
  const battery = useAppSelector(selectBattery);
  const home = useAppSelector(selectHomePosition);
  const homeStatus = useAppSelector(selectHomeStatus);
  const isFocused = useIsFocused();

  const isHomeSet = homeStatus === 'SET' && home != null;
  const homeDist = isHomeSet && gps?.value.latitude != null && gps?.value.longitude != null
    ? calculateDistanceMeters(gps.value.latitude, gps.value.longitude, home.latitude, home.longitude)
    : null;
  const homeBear = isHomeSet && gps?.value.latitude != null && gps?.value.longitude != null
    ? calculateBearingDegrees(gps.value.latitude, gps.value.longitude, home.latitude, home.longitude)
    : null;

  const ready = truth.connected && !pending;

  const confirm = (label: string, run: () => void) => {
    Alert.alert(
      `Confirm ${label}`,
      `Send ${label} to the connected vehicle?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Execute', style: 'destructive', onPress: run }
      ]
    );
  };

  const getSensorHealth = (nameIncludes: string) => {
    if (!sensors?.value) return '--';
    const s = sensors.value.find(item => item.name.includes(nameIncludes));
    return s ? (s.value ?? s.health) : '--';
  };

  const getSensorTone = (nameIncludes: string): 'neutral' | 'success' | 'danger' => {
    if (!sensors?.value) return 'neutral';
    const s = sensors.value.find(item => item.name.includes(nameIncludes));
    return s ? (s.health === 'GOOD' ? 'success' : 'danger') : 'neutral';
  };

  return (
    <FloatingWorkspace
      title="Vehicle"
      subtitle="Telemetry Diagnostics & Subsystems"
      icon="quadcopter"
      onClose={() => navigation.navigate('Fly')}
      headerRight={
        <View style={styles.quickActions}>
          <CommandButton
            label={armed ? 'DISARM' : 'ARM'}
            icon={armed ? 'lock' : 'lock-open-outline'}
            tone={armed ? 'danger' : 'success'}
            filled
            style={styles.headerBtn}
            disabled={!ready}
            onPress={() => confirm(armed ? 'DISARM' : 'ARM', () => safetyLayer.executeCommand({ type: armed ? 'DISARM' : 'ARM' }))}
          />
        </View>
      }
    >
      <View style={styles.workspaceInner}>
        {/* Navigation Tabs */}
        <GlassSurface variant="medium" style={[styles.tabs, { height: layout.isCompactLandscape ? 32 : 36 }]} contentStyle={styles.tabsContent}>
          {tabs.map((item) => {
            const isActive = tab === item;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setTab(item)}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[styles.tabText, isActive && styles.tabTextActive]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </GlassSurface>

        {/* Tab Content */}
        {tab === 'MAVLINK' ? <MavlinkInspector /> : (
        <ScrollView
          style={styles.scroller}
          contentContainerStyle={[
            styles.content,
            { padding: layout.contentPadding, gap: layout.cardGap }
          ]}
        >
          {tab === 'OVERVIEW' ? (
            truth.connected ? (
              <>
                <View style={styles.rowGrid}>
                  <Panel style={styles.section}>
                    <View style={styles.titleRow}>
                      <SectionTitle>Vehicle status</SectionTitle>
                      <StatusChip value="Heartbeat active" tone="success" />
                    </View>
                    <View style={styles.vehicleBody}>
                      <View style={styles.details}>
                        <InfoRow icon="chip" label="Autopilot" value={autopilot} />
                        <InfoRow icon="access-point-network" label="Transport" value={port} />
                        <InfoRow icon="clock-outline" label="Last heartbeat" value={heartbeat ? `${Math.max(0, Date.now() - heartbeat)} ms ago` : '--'} />
                        <InfoRow icon="navigation-variant" label="Flight mode" value={mode} />
                      </View>
                      <View style={styles.vehicleVisual}>
                        <View style={styles.vehicleHalo}>
                          <MaterialCommunityIcons name="quadcopter" size={54} color="#2F80ED" />
                        </View>
                        <Text numberOfLines={1} style={styles.vehicleName}>{vehicle}</Text>
                        <Text style={styles.vehicleType}>Connected vehicle</Text>
                      </View>
                    </View>
                  </Panel>

                  <Panel style={styles.section}>
                    <SectionTitle>Health</SectionTitle>
                    <View style={styles.healthGrid}>
                      <Metric label="GPS" value={gps ? String(gps.value.satellites ?? '--') : '--'} icon="crosshairs-gps" tone={gps && (gps.value.gpsFix ?? 0) >= 3 ? 'success' : 'neutral'} caption={gps ? (gps.value.gpsFix ?? 0) >= 3 ? '3D Fix' : 'No Fix' : undefined} />
                      <Metric label="Battery" value={battery ? `${Math.round(battery.value.percentage)}%` : '--'} icon="battery-medium" tone={battery ? (battery.value.percentage < 20 ? 'danger' : 'success') : 'neutral'} caption={battery?.value.voltage != null ? `${battery.value.voltage.toFixed(1)} V` : 'Voltage unavailable'} />
                      <Metric label="MAVLink traffic" value={`RX ${pps} · TX ${txPps}`} icon="access-point" tone="primary" caption="Open packet inspector" onPress={() => setTab('MAVLINK')} />
                      <Metric label="EKF status" value={getSensorHealth('AHRS')} icon="cube-outline" tone={getSensorTone('AHRS')} caption={getSensorHealth('AHRS') === '--' ? 'Not reported' : undefined} />
                    </View>
                  </Panel>
                </View>

                <View style={styles.rowGrid}>
                  <Panel style={styles.section}>
                    <SectionTitle>Live telemetry</SectionTitle>
                    <View style={styles.telemetryGrid}>
                      <Metric label="Altitude" value={gps ? gps.value.altitude.toFixed(1) : '--'} unit="m" icon="altimeter" />
                      <Metric label="Ground speed" value={velocity ? velocity.value.groundSpeed.toFixed(1) : '--'} unit="m/s" icon="speedometer" />
                      <Metric label="Vertical speed" value={velocity?.value.verticalSpeed != null ? velocity.value.verticalSpeed.toFixed(1) : '--'} unit="m/s" icon="swap-vertical" />
                      <Metric label="Heading" value={attitude ? String(((Math.round(attitude.value.yaw) % 360) + 360) % 360).padStart(3, '0') : '--'} unit="deg" icon="compass-outline" />
                      <Metric label="Voltage" value={battery?.value.voltage != null ? battery.value.voltage.toFixed(1) : '--'} unit="V" icon="battery-charging-outline" />
                      <Metric label="Current" value={battery?.value.current != null ? battery.value.current.toFixed(1) : '--'} unit="A" icon="current-dc" />
                      <Metric label="Satellites" value={gps ? String(gps.value.satellites ?? '--') : '--'} icon="satellite-variant" />
                      <Metric label="HDOP" value={gps?.value.hdop != null ? gps.value.hdop.toFixed(1) : '--'} icon="crosshairs" />
                    </View>
                  </Panel>

                  <Panel style={styles.section}>
                    <SectionTitle>System summary</SectionTitle>
                    <SummaryRow icon="navigation-variant" label="Flight mode" value={mode} tone="primary" />
                    <SummaryRow icon="lock-outline" label="Arming status" value={armed ? 'Armed' : 'Disarmed'} tone={armed ? 'danger' : 'success'} />
                    <SummaryRow icon="compass-outline" label="Compass" value={getSensorHealth('Compass')} tone={getSensorTone('Compass')} />
                    <SummaryRow icon="axis-arrow" label="IMU" value={getSensorHealth('Gyro')} tone={getSensorTone('Gyro')} />
                    <SummaryRow icon="database-outline" label="Logging" value={getSensorHealth('Logging')} tone={getSensorTone('Logging')} />
                  </Panel>
                </View>

                {/* Home Position Panel */}
                <View style={styles.rowGrid}>
                  <Panel style={styles.section}>
                    <View style={styles.titleRow}>
                      <SectionTitle>Home position</SectionTitle>
                      <StatusChip
                        value={isHomeSet ? 'Home set' : 'Home unknown'}
                        tone={isHomeSet ? 'success' : 'neutral'}
                      />
                    </View>
                    <View style={styles.telemetryGrid}>
                      <Metric
                        label="Status"
                        value={isHomeSet ? 'VALID' : 'UNKNOWN'}
                        icon="home"
                        tone={isHomeSet ? 'success' : 'neutral'}
                      />
                      <Metric
                        label="Distance"
                        value={formatDistance(homeDist)}
                        icon="ruler"
                        tone={isHomeSet ? 'primary' : 'neutral'}
                      />
                      <Metric
                        label="Bearing"
                        value={formatBearing(homeBear)}
                        icon="compass"
                        tone={isHomeSet ? 'primary' : 'neutral'}
                      />
                      <Metric
                        label="Altitude"
                        value={isHomeSet && home.altitude != null ? `${home.altitude.toFixed(1)} m` : '--'}
                        icon="altimeter"
                      />
                    </View>
                    <View style={{ marginTop: 8, paddingHorizontal: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>
                        {isHomeSet
                          ? `Coordinates: ${home.latitude.toFixed(6)}°, ${home.longitude.toFixed(6)}°`
                          : 'Autopilot has not yet confirmed Home position.'}
                      </Text>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('Fly')}
                        style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(47, 128, 237, 0.1)', borderRadius: 6 }}
                      >
                        <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.primary }}>VIEW ON MAP</Text>
                      </TouchableOpacity>
                    </View>
                  </Panel>
                </View>
              </>
            ) : (
              <Panel style={styles.emptyPanel}>
                <EmptyStateCard
                  icon="quadcopter"
                  title="No vehicle detected"
                  description={truth.mavlinkState === 'WAITING_HEARTBEAT' ? `Transport ready (${config.type}). Waiting for MAVLink heartbeat.` : 'Connect a vehicle to see health and live telemetry.'}
                  actionLabel="Go to connection settings"
                  onAction={() => navigation.navigate('Settings')}
                />
                <TouchableOpacity style={styles.retry} onPress={() => universalConnectionService.connect(config)}>
                  <MaterialCommunityIcons name="refresh" size={15} color="#2F80ED" />
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
                <Text style={styles.transport}>
                  Transport: {config.type === 'WEBSOCKET' ? config.websocket.url : `UDP ${config.udp.localPort}`} · Last heartbeat: --
                </Text>
              </Panel>
            )
          ) : null}

          {tab === 'SENSORS' ? (
            <Panel>
              <SectionTitle>Sensor health</SectionTitle>
              {truth.connected && sensors?.value.length ? (
                sensors.value.map((sensor) => (
                  <View key={sensor.name} style={styles.sensor}>
                    <MaterialCommunityIcons
                      name="access-point"
                      size={17}
                      color={sensor.health === 'GOOD' ? colors.success : sensor.health === 'CRITICAL' ? colors.danger : colors.warning}
                    />
                    <View style={styles.sensorCopy}>
                      <Text style={styles.sensorName}>{sensor.name}</Text>
                      <Text style={styles.sensorMessage}>{sensor.message ?? sensor.value ?? '--'}</Text>
                    </View>
                    <Text style={styles.sensorValue}>{sensor.value ?? sensor.health}</Text>
                  </View>
                ))
              ) : (
                <EmptyStateCard
                  compact
                  icon="access-point-off"
                  title="Sensor data unavailable"
                  description="Sensor health appears after the vehicle sends MAVLink sensor messages."
                />
              )}
            </Panel>
          ) : null}

          {tab === 'PRECISION LANDING' ? (
            <Panel style={styles.precision}>
              <View style={styles.camera}>
                <VideoStream enabled={isFocused && tab === 'PRECISION LANDING'} />
              </View>
              <View style={styles.precisionInfo}>
                <SectionTitle>Precision landing</SectionTitle>
                <SummaryRow icon="crosshairs" label="Tag detection" value="--" />
                <SummaryRow icon="axis-arrow" label="Target offset" value="--" />
                <SummaryRow icon="lock-outline" label="Lock state" value="--" />
                <SummaryRow icon="percent-outline" label="Confidence" value="--" />
                <Text style={styles.help}>
                  Video and detector diagnostics are independent. Values stay -- until the Pi sends real detector data.
                </Text>
              </View>
            </Panel>
          ) : null}

          {tab === 'MESSAGES' ? (
            <Panel>
              <SectionTitle>Vehicle messages</SectionTitle>
              {truth.connected && messages.length ? (
                messages.map((message, index) => (
                  <View key={`${message.timestamp}-${index}`} style={styles.message}>
                    <Text style={styles.time}>{new Date(message.timestamp).toLocaleTimeString()}</Text>
                    <Text style={[styles.messageText, { color: message.severity <= 3 ? colors.danger : message.severity <= 4 ? colors.warning : colors.text }]}>
                      {message.text}
                    </Text>
                  </View>
                ))
              ) : (
                <EmptyStateCard
                  compact
                  icon="message-text-outline"
                  title="No vehicle messages"
                  description="STATUSTEXT messages will appear here when received."
                />
              )}
            </Panel>
          ) : null}
        </ScrollView>
        )}
      </View>
    </FloatingWorkspace>
  );
}

function Metric(props: React.ComponentProps<typeof TelemetryCard> & { onPress?: () => void }) {
  const layout = useGcsLayout();
  const { onPress, ...cardProps } = props;
  const metricStyle = [styles.metric, !layout.isTabletLandscape && styles.metricPhone];
  if (onPress) {
    return <TouchableOpacity style={metricStyle} onPress={onPress}><TelemetryCard {...cardProps} /></TouchableOpacity>;
  }
  const content = (
    <View style={metricStyle}>
      <TelemetryCard {...cardProps} />
    </View>
  );
  return content;
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={15} color="#2F80ED" />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SummaryRow({ icon, label, value, tone = 'neutral' }: { icon: any; label: string; value: string; tone?: 'neutral' | 'primary' | 'success' | 'danger' }) {
  const color = tone === 'primary' ? colors.primary : tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : colors.textMuted;
  return (
    <View style={styles.summaryRow}>
      <MaterialCommunityIcons name={icon} size={15} color={color} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={[styles.summaryPill, { backgroundColor: `${color}14` }]}>
        <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  workspaceInner: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBtn: {
    height: 32,
    paddingHorizontal: 10,
  },
  tabs: {
    marginHorizontal: 8,
    marginTop: 4,
    marginBottom: 2,
    flexShrink: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  tabsContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    padding: 3,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.44)',
    borderWidth: 1,
    borderColor: 'rgba(47, 128, 237, 0.45)',
  },
  tabText: {
    color: '#5D6B7E',
    fontSize: 9.5,
    fontWeight: '900',
  },
  tabTextActive: {
    color: '#2F80ED',
  },
  scroller: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    paddingBottom: 16,
  },
  rowGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  section: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  titleRow: {
    minWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  vehicleBody: {
    flexDirection: 'row',
    minHeight: 140,
  },
  details: {
    flex: 1,
    minWidth: 0,
  },
  vehicleVisual: {
    width: '38%',
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240, 244, 248, 0.85)',
    borderRadius: radius.md,
  },
  vehicleHalo: {
    width: 86,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47, 128, 237, 0.12)',
  },
  vehicleName: {
    color: '#1E2A3A',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 6,
  },
  vehicleType: {
    color: '#5D6B7E',
    fontSize: 8,
    marginTop: 2,
  },
  infoRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  infoLabel: {
    color: '#5D6B7E',
    fontSize: 7.5,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  infoValue: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
    color: '#1E2A3A',
    fontSize: 9,
    fontWeight: '800',
  },
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metric: {
    width: '23%',
    minWidth: 0,
    flexGrow: 1,
  },
  metricPhone: {
    width: '47%',
  },
  summaryRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  summaryLabel: {
    flex: 1,
    minWidth: 0,
    color: '#5D6B7E',
    fontSize: 8.5,
    fontWeight: '800',
  },
  summaryPill: {
    minWidth: 58,
    maxWidth: '48%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 8.5,
    fontWeight: '900',
  },
  emptyPanel: {
    minHeight: 240,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  retry: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: 'rgba(47, 128, 237, 0.12)',
  },
  retryText: {
    color: '#2F80ED',
    fontSize: 10,
    fontWeight: '900',
  },
  transport: {
    color: '#5D6B7E',
    fontSize: 9,
    marginTop: 10,
  },
  sensor: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  sensorCopy: {
    flex: 1,
    minWidth: 0,
  },
  sensorName: {
    color: '#1E2A3A',
    fontSize: 10,
    fontWeight: '800',
  },
  sensorMessage: {
    color: '#5D6B7E',
    fontSize: 8.5,
    marginTop: 2,
  },
  sensorValue: {
    color: '#1E2A3A',
    fontSize: 9,
    fontWeight: '800',
  },
  precision: {
    minHeight: 240,
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  camera: {
    flex: 1,
    minWidth: 0,
    alignItems: 'stretch',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(240, 244, 248, 0.85)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: glass.border,
  },
  precisionInfo: {
    flex: 1,
    minWidth: 0,
  },
  help: {
    color: '#5D6B7E',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 10,
  },
  message: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  time: {
    color: '#8A96A8',
    fontSize: 9,
  },
  messageText: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    fontWeight: '600',
  },
});
