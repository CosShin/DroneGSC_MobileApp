import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomActionBar } from '../../components/gcs/GcsLayout';
import { CommandButton, EmptyStateCard } from '../../components/gcs/Primitives';
import { GlassSurface } from '../../components/gcs/GlassSurface';
import { OpenStreetMap } from '../../components/map/OpenStreetMap';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  addWaypoint, 
  clearMission, 
  selectMissionItems, 
  selectRawWireItems, 
  selectSelectedItemId, 
  selectSyncProgress, 
  selectSyncStatus, 
  selectVerifyResult, 
  selectWaypoints, 
  selectItem, 
  setMissionFromDownload, 
  setRawWireItems, 
  setSyncProgress, 
  setSyncStatus, 
  setVerifyResult, 
  updateItem 
} from '../../store/mission/missionSlice';
import { selectGps } from '../../store/telemetry/telemetrySlice';
import { glass, glassShadow, layers, radius } from '../../theme/gcsTheme';
import { useScreenOrientation } from '../../hooks/useScreenOrientation';
import { universalConnectionService } from '../../services/connection/UniversalConnectionService';
import { useTruthfulTelemetry } from '../../hooks/useTruthfulTelemetry';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useGcsLayout } from '../../hooks/useGcsLayout';
import { WaypointEditor } from '../../components/mission/WaypointEditor';
import { MissionTimeline } from '../../components/mission/MissionTimeline';
import { RawMissionDebugModal } from '../../components/mission/RawMissionDebugModal';
import { compileMission } from '../../services/mission/MissionCompiler';
import { decompileMission } from '../../services/mission/MissionDecompiler';
import { validateMission, verifyRoundTrip } from '../../services/mission/MissionValidator';
import { MissionItemInt } from '../../services/mission/MissionTypes';

export function PlanScreen() {
  useScreenOrientation();
  const dispatch = useAppDispatch();
  const truth = useTruthfulTelemetry();
  const device = useDeviceLocation();
  const layout = useGcsLayout();

  const items = useAppSelector(selectMissionItems);
  const waypoints = useAppSelector(selectWaypoints);
  const selectedId = useAppSelector(selectSelectedItemId);
  const syncStatus = useAppSelector(selectSyncStatus);
  const rawWireItems = useAppSelector(selectRawWireItems);
  const verifyResult = useAppSelector(selectVerifyResult);
  const gps = useAppSelector(selectGps);

  const [fitRequest, setFitRequest] = useState(0);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [rawModalVisible, setRawModalVisible] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const transferActiveRef = React.useRef(false);
  const vehiclePosition = gps && (gps.value.gpsFix ?? 0) >= 3 
    ? { latitude: gps.value.latitude, longitude: gps.value.longitude } 
    : null;
  const position = vehiclePosition ?? device.position;

  // Derived mission statistics
  const geoItems = items.filter(it => it.lat !== undefined && it.lng !== undefined);
  const totalDistance = React.useMemo(() => {
    let sum = 0;
    for (let i = 1; i < geoItems.length; i++) {
      sum += haversine(geoItems[i - 1].lat!, geoItems[i - 1].lng!, geoItems[i].lat!, geoItems[i].lng!);
    }
    return sum;
  }, [geoItems]);

  const altitudes = items.filter(it => it.alt !== undefined).map(it => it.alt!);
  const maxAlt = altitudes.length ? Math.max(...altitudes) : 0;
  const minAlt = altitudes.length ? Math.min(...altitudes) : 0;
  const avgSpeed = items.length ? items.reduce((s, it) => s + (it.speed ?? 5), 0) / items.length : 5;
  const estimatedSeconds = avgSpeed > 0 ? Math.round(totalDistance / avgSpeed) : 0;

  const syncing = syncStatus === 'SYNCING';
  const panelWidth = layout.isCompactLandscape 
    ? Math.min(320, layout.contentWidth * 0.40) 
    : Math.min(390, Math.max(320, layout.contentWidth * 0.32));

  // Upload with Validation and Compiler
  const handleUpload = async () => {
    if (syncing || transferActiveRef.current) return;

    // 1. Mission Validation
    const validation = validateMission(items);
    if (!validation.valid) {
      const firstErr = validation.errors[0];
      Alert.alert('Mission Validation Error', firstErr.message);
      if (firstErr.itemId) dispatch(selectItem(firstErr.itemId));
      return;
    }

    // 2. Compile High-Level Items to Wire MAVLink Items
    const wireItems = compileMission(items);
    dispatch(setRawWireItems(wireItems));

    transferActiveRef.current = true;
    dispatch(setSyncStatus('SYNCING'));
    dispatch(setSyncProgress(0));

    try {
      await universalConnectionService.uploadMission(wireItems, p => dispatch(setSyncProgress(p)));
      dispatch(setSyncStatus('SYNCED'));
      Alert.alert('Mission Uploaded', `Successfully transferred ${wireItems.length} MAVLink mission items to vehicle.`);
    } catch (error) {
      dispatch(setSyncStatus('ERROR'));
      Alert.alert('Mission Upload Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      transferActiveRef.current = false;
    }
  };

  // Download with Decompiler
  const handleDownload = async () => {
    if (syncing || transferActiveRef.current) return;
    transferActiveRef.current = true;
    dispatch(setSyncStatus('SYNCING'));
    dispatch(setSyncProgress(0));

    try {
      const downloadedWireItems = await universalConnectionService.downloadMission(p => dispatch(setSyncProgress(p)));
      const decompiledEditorItems = decompileMission(downloadedWireItems);
      dispatch(setMissionFromDownload({
        editorItems: decompiledEditorItems,
        wireItems: downloadedWireItems,
      }));
      Alert.alert('Mission Downloaded', `Successfully reconstructed ${decompiledEditorItems.length} mission items from autopilot.`);
    } catch (error) {
      dispatch(setSyncStatus('ERROR'));
      Alert.alert('Mission Download Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      transferActiveRef.current = false;
    }
  };

  // Round-trip verification
  const handleVerify = async () => {
    if (!truth.connected || isVerifying) return;
    setIsVerifying(true);

    try {
      const wireItems = compileMission(items);
      await universalConnectionService.uploadMission(wireItems);
      const downloadedWireItems = await universalConnectionService.downloadMission();
      const verification = verifyRoundTrip(wireItems, downloadedWireItems);
      
      dispatch(setVerifyResult(verification));
      dispatch(setRawWireItems(downloadedWireItems));
      setRawModalVisible(true);
    } catch (error) {
      Alert.alert('Verification Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear Mission?',
      truth.connected ? 'Clear autopilot vehicle mission and local plan?' : 'Clear local mission plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              if (truth.connected) await universalConnectionService.clearVehicleMission();
              dispatch(clearMission());
            } catch (error) {
              Alert.alert('Clear Failed', error instanceof Error ? error.message : 'Unknown error');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      {/* 1. Interactive Map Layer */}
      <View style={styles.mapLayer}>
        <OpenStreetMap
          vehiclePosition={vehiclePosition}
          phonePosition={device.position ? { latitude: device.position.latitude, longitude: device.position.longitude, accuracy: device.position.accuracy } : null}
          waypoints={waypoints}
          selectedWaypointId={selectedId}
          editable
          fitRequest={fitRequest}
          onMapPress={point => dispatch(addWaypoint({ lat: point.latitude, lng: point.longitude }))}
          onWaypointPress={id => dispatch(selectItem(id))}
          onWaypointMove={(id, point) => dispatch(updateItem({ id, changes: { lat: point.latitude, lng: point.longitude } }))}
        />
      </View>

      {/* 2. Top Location Indicator Pill */}
      <View pointerEvents="none" style={styles.mapHintWrap}>
        <GlassSurface heavy intensity={60} style={styles.mapHint} contentStyle={styles.mapHintContent}>
          <MaterialCommunityIcons 
            name={vehiclePosition ? 'quadcopter' : device.position ? 'cellphone-marker' : 'map-marker-off-outline'} 
            size={14} 
            color="#2586EA" 
          />
          <Text numberOfLines={1} style={styles.hint}>
            {vehiclePosition ? 'VEHICLE GPS LOCATION' : device.position ? 'PHONE LOCATION' : 'TAP MAP TO PLACE WAYPOINTS'}
          </Text>
        </GlassSurface>
      </View>

      {/* 3. Floating Mission Planner Panel */}
      {!panelCollapsed ? (
        <GlassSurface
          fill
          heavy
          intensity={64}
          style={[
            styles.missionPanel,
            { width: panelWidth, bottom: layout.isCompactLandscape ? 72 : 82 },
          ]}
          contentStyle={styles.missionContent}
        >
          {/* Panel Top Header */}
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderTitleRow}>
              <MaterialCommunityIcons name="map-marker-path" size={17} color="#2586EA" />
              <Text style={styles.panelTitle}>MISSION PLAN</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{items.length} items</Text>
              </View>
            </View>

            <View style={styles.headerRightActions}>
              <TouchableOpacity
                accessibilityLabel="Open raw MAVLink debug"
                style={styles.rawBtn}
                onPress={() => {
                  if (!rawWireItems.length) {
                    dispatch(setRawWireItems(compileMission(items)));
                  }
                  setRawModalVisible(true);
                }}
              >
                <MaterialCommunityIcons name="code-json" size={15} color="#2586EA" />
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityLabel="Collapse mission panel"
                style={styles.collapse}
                onPress={() => setPanelCollapsed(true)}
              >
                <MaterialCommunityIcons name="chevron-right" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Panel Scrollable Content (Timeline or Item Editor) */}
          <ScrollView
            style={styles.panelScroll}
            contentContainerStyle={styles.panelScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedId ? (
              <WaypointEditor />
            ) : items.length ? (
              <>
                <MissionTimeline />
                {/* Summary Box */}
                <View style={styles.statsSummary}>
                  <StatItem label="ITEMS" value={`${items.length}`} />
                  <StatItem label="DIST" value={totalDistance >= 1000 ? `${(totalDistance / 1000).toFixed(2)} km` : `${Math.round(totalDistance)} m`} />
                  <StatItem label="TIME" value={`${Math.floor(estimatedSeconds / 60)}:${String(estimatedSeconds % 60).padStart(2, '0')}`} />
                  <StatItem label="MAX ALT" value={`${maxAlt.toFixed(0)} m`} />
                </View>
              </>
            ) : (
              <View style={styles.emptyWrap}>
                <EmptyStateCard
                  compact
                  icon="map-marker-plus-outline"
                  title="Mission is empty"
                  description="Tap anywhere on the map or use quick add to create items."
                />
                <MissionTimeline />
              </View>
            )}
          </ScrollView>
        </GlassSurface>
      ) : (
        <TouchableOpacity
          accessibilityLabel="Open mission panel"
          style={styles.expandPanel}
          onPress={() => setPanelCollapsed(false)}
        >
          <MaterialCommunityIcons name="clipboard-text-outline" size={17} color="#2586EA" />
          <Text style={styles.expandText}>MISSION ({items.length})</Text>
        </TouchableOpacity>
      )}

      {/* 4. Bottom Command Toolbar */}
      <BottomActionBar>
        <CommandButton
          label={syncing ? 'SYNCING' : layout.isCompactLandscape ? 'DOWN' : 'DOWNLOAD'}
          icon="download"
          style={styles.action}
          disabled={!truth.connected || syncing}
          onPress={handleDownload}
        />
        <CommandButton
          label={syncing ? 'SYNCING' : layout.isCompactLandscape ? 'UP' : 'UPLOAD'}
          icon="upload"
          tone="primary"
          style={styles.action}
          disabled={!truth.connected || !items.length || syncing}
          onPress={handleUpload}
        />
        <CommandButton
          label="VERIFY"
          icon="check-decagram-outline"
          style={styles.action}
          disabled={!truth.connected || !items.length || isVerifying}
          onPress={handleVerify}
        />
        <CommandButton
          label="CLEAR"
          icon="delete-sweep-outline"
          tone="danger"
          style={styles.action}
          disabled={syncing || (!items.length && !truth.connected)}
          onPress={handleClear}
        />
        <CommandButton
          label={layout.isCompactLandscape ? 'FIT' : 'FIT ROUTE'}
          icon="fit-to-screen-outline"
          style={styles.action}
          disabled={!waypoints.length}
          onPress={() => setFitRequest(v => v + 1)}
        />
        <CommandButton
          label={layout.isCompactLandscape ? 'SAVE' : 'SAVE MISSION'}
          icon="content-save-outline"
          tone="primary"
          style={styles.action}
          disabled={!items.length}
          onPress={async () => {
            await AsyncStorage.setItem('anitech-gcs:saved-mission-items', JSON.stringify(items));
            Alert.alert('Mission Saved', 'Mission plan saved locally on this device.');
          }}
        />
      </BottomActionBar>

      {/* 5. Raw MAVLink Diagnostics & Verification Modal */}
      <RawMissionDebugModal
        visible={rawModalVisible}
        onClose={() => setRawModalVisible(false)}
        wireItems={rawWireItems}
        verificationResult={verifyResult}
        onVerify={truth.connected ? handleVerify : undefined}
        isVerifying={isVerifying}
      />
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text numberOfLines={1} style={styles.statLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.statValue}>{value}</Text>
    </View>
  );
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#050A11',
    overflow: 'hidden',
  },
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: layers.background,
  },
  mapHintWrap: {
    position: 'absolute',
    top: 56,
    left: 80,
    right: 80,
    zIndex: layers.information,
    alignItems: 'center',
  },
  mapHint: {
    height: 32,
    maxWidth: 390,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: glass.border,
    ...glassShadow,
  },
  mapHintContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  hint: {
    flexShrink: 1,
    color: '#1E2A3A',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  missionPanel: {
    position: 'absolute',
    top: 56,
    right: 14,
    zIndex: layers.panel,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    ...glassShadow,
  },
  missionContent: {
    flex: 1,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
  },
  panelHeader: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    marginBottom: 6,
  },
  panelHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  panelTitle: {
    color: '#1E293B',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  countBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(37, 134, 234, 0.12)',
  },
  countBadgeText: {
    color: '#2586EA',
    fontSize: 8.5,
    fontWeight: '900',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rawBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(37, 134, 234, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapse: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandPanel: {
    position: 'absolute',
    top: 56,
    right: 14,
    zIndex: layers.panel,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    ...glassShadow,
  },
  expandText: {
    color: '#1E293B',
    fontSize: 9.5,
    fontWeight: '900',
  },
  panelScroll: {
    flex: 1,
  },
  panelScrollContent: {
    paddingBottom: 6,
    gap: 6,
  },
  emptyWrap: {
    gap: 6,
  },
  statsSummary: {
    flexDirection: 'row',
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(240, 245, 252, 0.85)',
  },
  statBox: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 6.5,
    fontWeight: '800',
  },
  statValue: {
    color: '#1E293B',
    fontSize: 8.5,
    fontWeight: '900',
    marginTop: 1,
  },
  action: {
    flex: 1,
    minWidth: 0,
    maxWidth: 180,
    height: '82%',
  },
});
