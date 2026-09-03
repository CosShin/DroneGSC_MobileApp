import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { selectGps } from '../../store/telemetry/telemetrySlice';
import { selectWaypoints, selectSelectedWaypointId, addWaypoint, selectWaypoint, updateWaypoint } from '../../store/mission/missionSlice';

import { WaypointEditor } from '../../components/mission/WaypointEditor';
import { MissionControls } from '../../components/mission/MissionControls';
import { OpenStreetMap } from '../../components/map/OpenStreetMap';

export function MissionScreen() {
  const dispatch = useAppDispatch();
  const gps = useAppSelector(selectGps);
  const waypoints = useAppSelector(selectWaypoints);
  const selectedId = useAppSelector(selectSelectedWaypointId);

  const position = gps ? { latitude: gps.value.latitude, longitude: gps.value.longitude } : null;

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      
      {/* Full Screen Background Map */}
      <View style={StyleSheet.absoluteFill}>
        <OpenStreetMap
          vehiclePosition={position}
          waypoints={waypoints}
          selectedWaypointId={selectedId}
          editable
          onMapPress={({ latitude, longitude }) => dispatch(addWaypoint({ lat: latitude, lng: longitude }))}
          onWaypointPress={id => dispatch(selectWaypoint(id))}
          onWaypointMove={(id, { latitude, longitude }) => dispatch(updateWaypoint({ id, changes: { lat: latitude, lng: longitude } }))}
        />
      </View>

      {/* UI Overlay Layer */}
      <SafeAreaView style={styles.safeAreaOverlay} edges={['top', 'left', 'right', 'bottom']} pointerEvents="box-none">
        <View style={styles.topOverlay} pointerEvents="box-none">
          {/* Top Bar for Mission */}
          <View style={[
            styles.topBar,
            {
              paddingLeft: 28,
              paddingRight: 28,
            }
          ]}>
            <Text style={styles.title}>MISSION PLANNER</Text>
          </View>
        </View>
        
        {/* Editor Panel */}
        <WaypointEditor />

        {/* Mission Controls (Upload, Start, etc.) */}
        <MissionControls />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeAreaOverlay: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  topBar: {
    height: 38,
    backgroundColor: 'rgba(10, 15, 26, 0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    color: '#ffaa00',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 1,
  },
});
