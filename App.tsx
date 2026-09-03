import React from 'react';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { ConnectionManager } from './src/app/ConnectionManager';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SettingsPersistence } from './src/app/SettingsPersistence';
import { DeviceLocationProvider } from './src/hooks/useDeviceLocation';
import { useLandscapeLock } from './src/hooks/useScreenOrientation';

export default function App() {
  useLandscapeLock();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <DeviceLocationProvider>
            <ConnectionManager />
            <SettingsPersistence />
            <RootNavigator />
            <StatusBar hidden />
          </DeviceLocationProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
