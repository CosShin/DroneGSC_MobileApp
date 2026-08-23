import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WarningBanner } from '../../components/common/WarningBanner';
import { CommandControls } from '../../components/flight/CommandControls';
import { VirtualJoystick } from '../../components/joystick/VirtualJoystick';
import { joystickProcessor } from '../../services/joystick/JoystickProcessor';
import { FlightControlInput } from '../../types/joystick';
import { TopBar } from '../../components/flight/TopBar';
import { HudContainer } from '../../components/hud/HudContainer';
import { MapContainer } from '../../components/map/MapContainer';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { selectShowJoysticks, selectShowTelemetry, selectMainViewMode, toggleMainViewMode, toggleJoysticks, toggleTelemetry } from '../../store/settings/settingsSlice';
import { StatusBar } from 'expo-status-bar';

export function FlightScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [joystickStatus, setJoystickStatus] = React.useState<FlightControlInput | null>(null);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const showJoysticks = useAppSelector(selectShowJoysticks);
  const showTelemetry = useAppSelector(selectShowTelemetry);
  const mainViewMode = useAppSelector(selectMainViewMode);

  React.useEffect(() => {
    joystickProcessor.start();
    const unsubscribe = joystickProcessor.onProcessedInput(setJoystickStatus);
    return () => {
      unsubscribe();
      joystickProcessor.stop();
    };
  }, []);

  if (!isLandscape) {
    return (
      <View style={styles.safeArea}>
        <StatusBar hidden />
        <View style={styles.portraitFallback}>
          <Text style={styles.portraitBrand}>ANITECH GCS</Text>
          <Text style={styles.portraitSubtext}>Please rotate your device to landscape orientation for tactical flight control.</Text>
        </View>
      </View>
    );
  }

  // Calculate joystick size based on available height, leaving room for header and margins
  const maxJoystickSize = 160;
  const joystickSize = Math.max(Math.min(height * 0.42, width * 0.22, maxJoystickSize), 135);

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} translucent={true} />
      
      {/* Full Screen Background Layer */}
      <View style={StyleSheet.absoluteFillObject}>
        {mainViewMode === 'MAP' ? <MapContainer /> : <HudContainer />}
      </View>

      {/* UI Overlay Layer - Respects Safe Area */}
      <SafeAreaView style={styles.safeAreaOverlay} edges={['top', 'left', 'right', 'bottom']} pointerEvents="box-none">
        
        {/* Top Overlay Bar */}
        <View style={styles.topOverlay} pointerEvents="box-none">
          <TopBar />
        </View>

        {/* Floating Commands Box (Top Right, placed to the left of Altitude tape) */}
        {showTelemetry && (
          <View 
            style={[
              styles.commandsOverlay,
              { right: 68 }
            ]} 
            pointerEvents="box-none"
          >
            <CommandControls />
          </View>
        )}

        {/* Floating Left Joystick (Bottom Left, shifted inward) */}
        {showJoysticks && (
          <View 
            style={[
              styles.leftJoystickOverlay,
              { left: 135 }
            ]} 
            pointerEvents="box-none"
          >
            <VirtualJoystick 
              size={joystickSize}
              mode="THROTTLE_YAW"
              onUpdate={(x, y, active) => joystickProcessor.updateLeftStick(x, y, active)} 
            />
          </View>
        )}

        {/* Floating Right Joystick (Bottom Right, shifted inward) */}
        {showJoysticks && (
          <View 
            style={[
              styles.rightJoystickOverlay,
              { right: 135 }
            ]} 
            pointerEvents="box-none"
          >
            <VirtualJoystick 
              size={joystickSize}
              mode="PITCH_ROLL"
              onUpdate={(x, y, active) => joystickProcessor.updateRightStick(x, y, active)} 
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070a0f',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#070a0f',
  },
  safeAreaOverlay: {
    flex: 1,
  },
  portraitFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  portraitBrand: {
    color: '#38bdf8',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  portraitSubtext: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  commandsOverlay: {
    position: 'absolute',
    top: 44,
    width: 165,
    zIndex: 25,
  },
  leftJoystickOverlay: {
    position: 'absolute',
    bottom: 8,
    zIndex: 15,
    alignItems: 'center',
  },
  rightJoystickOverlay: {
    position: 'absolute',
    bottom: 8,
    zIndex: 15,
    alignItems: 'center',
  },
  joystickLabel: {
    color: 'rgba(148, 163, 184, 0.75)',
    marginTop: 6,
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 0.8,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
