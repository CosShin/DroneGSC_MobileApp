import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Marker } from 'react-native-maps';

interface Props {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  yaw: number;
}

export function DroneMarker({ coordinate, yaw }: Props) {
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} flat={true} rotation={yaw}>
      <View style={styles.markerContainer}>
        {/* We can use a simple triangle/drone shape using CSS for now */}
        <View style={styles.droneBody}>
          <View style={styles.droneNose} />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  droneBody: {
    width: 20,
    height: 20,
    backgroundColor: '#ffaa00',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  droneNose: {
    width: 4,
    height: 10,
    backgroundColor: '#fff',
    position: 'absolute',
    top: -6,
    borderRadius: 2,
  },
});
