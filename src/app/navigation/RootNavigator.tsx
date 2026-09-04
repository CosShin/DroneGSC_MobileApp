import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer, StackActions, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlyScreen } from '../screens/FlyScreen';
import { PlanScreen } from '../screens/PlanScreen';
import { VehicleScreen } from '../screens/VehicleScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { VideoScreen } from '../screens/VideoScreen';
import { BrandMenu } from '../../components/navigation/BrandMenu';
import { TopTelemetryHUD } from '../../components/hud/TopTelemetryHUD';
import { FlightAssistantPanel } from '../../components/ai/FlightAssistantPanel';
import { layers } from '../../theme/gcsTheme';
import { MainRouteName, RootStackParamList } from './navigationConfig';

export type { RootStackParamList } from './navigationConfig';
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * RootNavigator is the top-level persistent App Shell of ANITECH GCS.
 * Uses unified card stack navigation so BrandMenu remains continuously mounted
 * and accessible across all screens and overlays on iOS and Android.
 */
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectIsAiAssistantOpen, setAiAssistantOpen } from '../../store/settings/settingsSlice';

export function RootNavigator() {
  const ref = useNavigationContainerRef<RootStackParamList>();
  const [route, setRoute] = React.useState<keyof RootStackParamList>('Fly');
  const aiOpen = useAppSelector(selectIsAiAssistantOpen);
  const dispatch = useAppDispatch();
  
  const navigate = React.useCallback((name: MainRouteName) => {
    setRoute(name);
    if (!ref.isReady() || ref.getCurrentRoute()?.name === name) return;
    const targetExists = ref.getRootState()?.routes.some(existing => existing.name === name);
    if (ref.getCurrentRoute()?.name === 'Video' && !targetExists) {
      ref.dispatch(StackActions.replace(name));
      return;
    }
    ref.navigate(name, undefined, { pop: true });
  }, [ref]);

  const showTelemetryHUD = route === 'Fly' || route === 'Plan';

  return (
    <NavigationContainer 
      ref={ref} 
      onStateChange={() => setRoute((ref.getCurrentRoute()?.name as keyof RootStackParamList) ?? 'Fly')}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'right', 'bottom', 'left']}>
        <View style={styles.shell}>
          {/* Main Application Screen Stack */}
          <Stack.Navigator 
            screenOptions={{ 
              headerShown: false, 
              animation: 'fade', 
              presentation: 'card',
              contentStyle: styles.content 
            }}
          >
            <Stack.Screen name="Fly" component={FlyScreen} />
            <Stack.Screen name="Plan" component={PlanScreen} />
            <Stack.Screen name="Vehicle" component={VehicleScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Video" component={VideoScreen} />
          </Stack.Navigator>

          {/* Persistent Global Navigation, HUD & AI Assistant Overlay */}
          <View pointerEvents="box-none" style={styles.globalOverlay}>
            {showTelemetryHUD ? (
              <TopTelemetryHUD 
                showFlightViewSwitcher={route === 'Fly'} 
                onOpenAi={() => dispatch(setAiAssistantOpen(true))}
              />
            ) : null}
            <BrandMenu currentRoute={route} onNavigate={navigate} />
            <FlightAssistantPanel visible={aiOpen} onClose={() => dispatch(setAiAssistantOpen(false))} />
          </View>
        </View>
      </SafeAreaView>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#050A11' 
  },
  shell: { 
    flex: 1, 
    minWidth: 0, 
    minHeight: 0, 
    backgroundColor: 'transparent',
    position: 'relative',
  },
  content: { 
    backgroundColor: 'transparent' 
  },
  globalOverlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    zIndex: layers.brand,
    elevation: layers.brand,
  },
});
