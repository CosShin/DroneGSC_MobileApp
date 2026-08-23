import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapView, { MapType, Marker, Polyline } from 'react-native-maps';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { selectGps, selectAttitude } from '../../store/telemetry/telemetrySlice';
import { toggleJoysticks } from '../../store/settings/settingsSlice';
import { selectWaypoints } from '../../store/mission/missionSlice';
import { DroneMarker } from './DroneMarker';

export function MapContainer() {
  const dispatch = useAppDispatch();
  const gps = useAppSelector(selectGps);
  const attitude = useAppSelector(selectAttitude);
  const waypoints = useAppSelector(selectWaypoints);
  const mapRef = useRef<MapView>(null);

  const [mapType, setMapType] = React.useState<MapType>('satellite');
  const [followDrone, setFollowDrone] = React.useState(true);

  // Auto center on drone if followDrone is enabled
  useEffect(() => {
    if (followDrone && gps && mapRef.current) {
      mapRef.current.animateCamera({
        center: {
          latitude: gps.value.latitude,
          longitude: gps.value.longitude,
        },
        heading: attitude?.value.yaw || 0,
      });
    }
  }, [gps, attitude, followDrone]);

  const toggleMapType = () => {
    setMapType(prev => (prev === 'standard' ? 'satellite' : 'standard'));
  };

  const coordinates = waypoints.map(wp => ({
    latitude: wp.lat,
    longitude: wp.lng,
  }));

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={mapType}
        initialRegion={{
          latitude: gps?.value.latitude || 10.8231, // Default to HCMC or last known
          longitude: gps?.value.longitude || 106.6297,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation={true}
        showsCompass={false}
        pitchEnabled={false}
        onPanDrag={() => setFollowDrone(false)}
      >
        {/* Mission Path (Read-only) */}
        {coordinates.length > 0 && (
          <Polyline
            coordinates={coordinates}
            strokeColor="#00ddff"
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}

        {/* Waypoints (Read-only) */}
        {waypoints.map((wp, index) => (
          <Marker
            key={wp.id}
            coordinate={{ latitude: wp.lat, longitude: wp.lng }}
          >
            <View style={styles.waypointMarker}>
              <Text style={styles.waypointText}>{index + 1}</Text>
            </View>
          </Marker>
        ))}

        {/* Drone Marker */}
        {gps && (
          <DroneMarker 
            coordinate={{ latitude: gps.value.latitude, longitude: gps.value.longitude }} 
            yaw={attitude?.value.yaw || 0} 
          />
        )}
      </MapView>

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.controlBtn, followDrone && styles.controlBtnActive]} onPress={() => setFollowDrone(true)}>
          <Text style={styles.controlText}>[C]</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={toggleMapType}>
          <Text style={styles.controlText}>{mapType === 'standard' ? 'SAT' : 'STD'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  controls: {
    position: 'absolute',
    bottom: 16,
    left: 56,
    flexDirection: 'row',
    gap: 6,
    zIndex: 20,
  },
  controlBtn: {
    backgroundColor: 'rgba(10, 15, 26, 0.82)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    height: 32,
  },
  controlBtnActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  controlText: {
    color: '#e2e8f0',
    fontWeight: 'bold',
    fontSize: 10,
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
  waypointText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
