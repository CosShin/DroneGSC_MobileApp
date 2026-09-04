import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

export function VideoUnavailableBackdrop({
  children,
  absolute = false,
}: {
  children: React.ReactNode;
  absolute?: boolean;
}) {
  return (
    <View style={[styles.container, absolute && styles.absolute]}>
      <Image
        source={require('../../../assets/hud-background.png')}
        resizeMode="cover"
        style={styles.image}
        accessible={false}
      />
      <View style={styles.desaturatedWash} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 100,
    overflow: 'hidden',
    backgroundColor: '#4B5563',
  },
  absolute: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
  },
  image: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0.36,
  },
  desaturatedWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(51, 65, 85, 0.62)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
});
