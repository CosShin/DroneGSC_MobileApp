import React from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoStream } from '../video/VideoStream';

interface Props {
  enabled?: boolean;
}

export const FlyVideoView = React.memo(function FlyVideoView({ enabled = true }: Props) {
  return (
    <View style={styles.container}>
      <VideoStream enabled={enabled} fullscreenButton={false} publishGlobalRuntime />
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
