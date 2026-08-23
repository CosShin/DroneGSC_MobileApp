import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { ConnectionManager } from './src/app/ConnectionManager';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ScreenOrientation from 'expo-screen-orientation';

export default function App() {
  useEffect(() => {
    async function lockLandscape() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (e) {
        console.warn('Screen orientation lock error:', e);
      }
    }
    lockLandscape();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <ConnectionManager />
          <RootNavigator />
          <StatusBar style="light" hidden={true} />
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
