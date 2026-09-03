import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '../../store/hooks';
import { selectVideoSettings } from '../../store/settings/settingsSlice';
import { videoCapabilities } from '../../video/videoCapabilities';
import { getVideoProvider } from '../../video/VideoProvider';
import { VideoEmptyState } from './VideoEmptyState';

/** Expo-Go-safe video facade. It never imports the native UDP player. */
export const VideoStream = React.memo(function VideoStream({
  enabled = true,
  fullscreenButton = true,
  publishGlobalRuntime = false,
}: {
  enabled?: boolean;
  fullscreenButton?: boolean;
  publishGlobalRuntime?: boolean;
}) {
  const navigation = useNavigation<any>();
  const settings = useAppSelector(selectVideoSettings);

  if (!enabled) return null;
  if (settings.transport === 'NONE') {
    return <VideoEmptyState message="Choose WebRTC in Settings → Video." actionLabel="Configure" onAction={() => navigation.navigate('Settings')}/>;
  }
  if (settings.transport === 'UDP_H264') {
    return <VideoEmptyState
      title={videoCapabilities.nativeUdpH264 ? 'Native UDP player not active' : 'Development Build required'}
      message="UDP H.264 is isolated from the Expo Go path. Select WebRTC to avoid binding UDP port 5600."
      actionLabel="Video settings"
      onAction={() => navigation.navigate('Settings')}
    />;
  }
  const provider = getVideoProvider(settings.transport);
  if (!provider) {
    return <VideoEmptyState message="Choose a supported video provider in Settings → Video." actionLabel="Configure" onAction={() => navigation.navigate('Settings')}/>;
  }
  const capability = provider.getCapability();
  if (capability.support !== 'SUPPORTED') {
    return <VideoEmptyState
      title={capability.requiresDevelopmentBuild ? 'Development Build required' : 'Video provider unavailable'}
      message={capability.reason ?? `${provider.type} is unavailable on this device.`}
      actionLabel="Video settings"
      onAction={() => navigation.navigate('Settings')}
    />;
  }
  const validationError = provider.validate(settings);
  if (validationError) {
    return <VideoEmptyState message={validationError} actionLabel="Configure" onAction={() => navigation.navigate('Settings')}/>;
  }
  const Player = provider.loadPlayer();
  return <Player
    enabled={enabled}
    publishGlobalRuntime={publishGlobalRuntime}
    onOpenFullscreen={fullscreenButton ? () => navigation.navigate('Video') : undefined}
  />;
});
