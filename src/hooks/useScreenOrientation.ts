import * as ScreenOrientation from 'expo-screen-orientation';
import React from 'react';

export function useLandscapeLock() {
  React.useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(error => console.warn('[Orientation]', error));
  }, []);
}

export function useScreenOrientation(_mode: 'landscape' | 'flexible' = 'landscape') { useLandscapeLock(); }
