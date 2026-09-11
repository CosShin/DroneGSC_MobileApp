import React from 'react';
import { StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { ConnectionManager } from './src/app/ConnectionManager';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SettingsPersistence } from './src/app/SettingsPersistence';
import { LaunchScreen } from './src/app/LaunchScreen';
import { DeviceLocationProvider } from './src/hooks/useDeviceLocation';
import { useLandscapeLock } from './src/hooks/useScreenOrientation';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useAppSelector } from './src/store/hooks';
import { selectSettingsHydrated } from './src/store/settings/settingsSlice';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

import { AppBootStatus } from './src/app/splashConfig';
export type { AppBootStatus };

function AppContent() {
  const hydrated = useAppSelector(selectSettingsHydrated);
  const [bootStatus, setBootStatus] = React.useState<AppBootStatus>('STARTING');
  const [splashDismissed, setSplashDismissed] = React.useState(false);

  React.useEffect(() => {
    void SystemUI.setBackgroundColorAsync('#071722').catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (!hydrated) {
      setBootStatus('LOADING_SETTINGS');
    } else {
      setBootStatus('INITIALIZING_SERVICES');
      const timer = setTimeout(() => {
        setBootStatus('READY');
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [hydrated]);

  // Safety boot timer ensures splash never blocks the app indefinitely
  React.useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setBootStatus((prev) => (prev !== 'READY' ? 'READY' : prev));
    }, 5000);
    return () => clearTimeout(safetyTimer);
  }, []);

  return (
    <DeviceLocationProvider>
      <ConnectionManager />
      <SettingsPersistence />
      <RootNavigator />
      {!splashDismissed ? (
        <LaunchScreen
          ready={bootStatus === 'READY'}
          onDismiss={() => setSplashDismissed(true)}
        />
      ) : null}
      <StatusBar hidden />
    </DeviceLocationProvider>
  );
}

export default function App() {
  useLandscapeLock();
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Provider store={store}>
          <AppContent />
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#071722',
  },
});
