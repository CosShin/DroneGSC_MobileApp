import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MapContainer } from '../map/MapContainer';

interface Props {
  active?: boolean;
}

export const FlyMapView = React.memo(function FlyMapView({ active = true }: Props) {
  return (
    <View style={styles.container}>
      <MapContainer active={active} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: '#050A11',
    overflow: 'hidden',
  },
});
