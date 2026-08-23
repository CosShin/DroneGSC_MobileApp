import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlightScreen } from '../screens/FlightScreen';
import { MissionScreen } from '../screens/MissionScreen';
import { SensorsScreen } from '../screens/SensorsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

type RootStackParamList = {
  Flight: undefined;
  Mission: undefined;
  Sensors: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

interface SidebarProps {
  currentRoute: keyof RootStackParamList;
  onNavigate: (screen: keyof RootStackParamList) => void;
}

function Sidebar({ currentRoute, onNavigate }: SidebarProps) {
  const insets = useSafeAreaInsets();

  const navItems: { name: keyof RootStackParamList; label: string; icon: string }[] = [
    { name: 'Flight', label: 'FLIGHT', icon: '✈️' },
    { name: 'Mission', label: 'MISSION', icon: '🗺️' },
    { name: 'Sensors', label: 'SENSORS', icon: '📡' },
  ];

  return (
    <View style={styles.sidebar}>
      {navItems.map((item) => {
        const isActive = currentRoute === item.name;
        return (
          <TouchableOpacity 
            key={item.name}
            style={[styles.navItem, isActive && styles.navItemActive]} 
            onPress={() => onNavigate(item.name)}
            activeOpacity={0.7}
          >
            {isActive && <View style={styles.activeBar} />}
            <Text style={[styles.navIcon, isActive && styles.navIconActive]}>{item.icon}</Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity 
        style={[
          styles.navItem, 
          currentRoute === 'Settings' && styles.navItemActive, 
          { marginTop: 'auto', marginBottom: 16 }
        ]} 
        onPress={() => onNavigate('Settings')}
        activeOpacity={0.7}
      >
        {currentRoute === 'Settings' && <View style={styles.activeBar} />}
        <Text style={[styles.navIcon, currentRoute === 'Settings' && styles.navIconActive]}>⚙️</Text>
      </TouchableOpacity>
    </View>
  );
}

export function RootNavigator() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [currentRoute, setCurrentRoute] = useState<keyof RootStackParamList>('Flight');

  const handleNavigate = (screen: keyof RootStackParamList) => {
    setCurrentRoute(screen);
    if (navigationRef.isReady()) {
      navigationRef.navigate(screen);
    }
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={() => {
        const route = navigationRef.getCurrentRoute();
        if (route && (route.name as keyof RootStackParamList)) {
          setCurrentRoute(route.name as keyof RootStackParamList);
        }
      }}
    >
      <View style={styles.container}>
        <View style={styles.content}>
          <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
            <Stack.Screen name="Flight" component={FlightScreen} />
            <Stack.Screen name="Mission" component={MissionScreen} />
            <Stack.Screen name="Sensors" component={SensorsScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </Stack.Navigator>
        </View>
        {currentRoute !== 'Settings' && (
          <Sidebar currentRoute={currentRoute} onNavigate={handleNavigate} />
        )}
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070a0f',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 38,
    bottom: 0,
    width: 48,
    backgroundColor: 'rgba(10, 15, 26, 0.22)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 8,
    paddingBottom: 16,
    alignItems: 'center',
    zIndex: 100,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
  },
  navItem: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.5)',
  },
  activeBar: {
    position: 'absolute',
    left: -3,
    top: 6,
    bottom: 6,
    width: 3,
    backgroundColor: '#38bdf8',
    borderRadius: 2,
  },
  navIcon: {
    fontSize: 18,
    opacity: 0.7,
  },
  navIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
});
