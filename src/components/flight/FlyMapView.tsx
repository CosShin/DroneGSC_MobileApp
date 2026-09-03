import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MapContainer } from '../map/MapContainer';

export const FlyMapView = React.memo(function FlyMapView() {
  return (
    <View style={styles.container}>
      <MapContainer />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050A11',
    overflow: 'hidden',
  },
});
