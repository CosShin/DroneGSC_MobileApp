import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import MapView, { MapPressEvent, Marker, Polyline } from 'react-native-maps';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { selectGps } from '../../store/telemetry/telemetrySlice';
import { selectWaypoints, selectSelectedWaypointId, addWaypoint, selectWaypoint, updateWaypoint } from '../../store/mission/missionSlice';

import { WaypointEditor } from '../../components/mission/WaypointEditor';
import { MissionControls } from '../../components/mission/MissionControls';

export function MissionScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const gps = useAppSelector(selectGps);
  const waypoints = useAppSelector(selectWaypoints);
  const selectedId = useAppSelector(selectSelectedWaypointId);

  const handleMapPress = (e: MapPressEvent) => {
    // Only add if we didn't tap a marker
    if (e.nativeEvent.action !== 'marker-press') {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      dispatch(addWaypoint({ lat: latitude, lng: longitude }));
    }
  };

  const coordinates = waypoints.map(wp => ({
    latitude: wp.lat,
    longitude: wp.lng,
  }));

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} translucent={true} />
      
      {/* Full Screen Background Map */}
      <View style={StyleSheet.absoluteFillObject}>
        <MapView
          style={styles.map}
          mapType="satellite"
          initialRegion={{
            latitude: gps?.value.latitude || 10.8231,
            longitude: gps?.value.longitude || 106.6297,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          onPress={handleMapPress}
          showsUserLocation={true}
          showsCompass={false}
          pitchEnabled={false}
        >
          {/* Mission Path */}
          {coordinates.length > 0 && (
            <Polyline
              coordinates={coordinates}
              strokeColor="#00ddff"
              strokeWidth={3}
              lineDashPattern={[5, 5]}
            />
          )}

          {/* Waypoints */}
          {waypoints.map((wp, index) => (
            <Marker
              key={wp.id}
              coordinate={{ latitude: wp.lat, longitude: wp.lng }}
              onPress={() => dispatch(selectWaypoint(wp.id))}
              draggable
              onDragEnd={(e) => {
                dispatch(updateWaypoint({
                  id: wp.id,
                  changes: {
                    lat: e.nativeEvent.coordinate.latitude,
                    lng: e.nativeEvent.coordinate.longitude
                  }
                }));
              }}
            >
              <View style={[styles.waypointMarker, selectedId === wp.id && styles.waypointSelected]}>
                <Text style={styles.waypointText}>{index + 1}</Text>
              </View>
            </Marker>
          ))}
        </MapView>
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
  map: {
    ...StyleSheet.absoluteFillObject,
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
  waypointMarker: {
    backgroundColor: '#333',
    borderColor: '#00ddff',
    borderWidth: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waypointSelected: {
    backgroundColor: '#00ddff',
    borderColor: '#fff',
    transform: [{ scale: 1.2 }],
  },
  waypointText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
