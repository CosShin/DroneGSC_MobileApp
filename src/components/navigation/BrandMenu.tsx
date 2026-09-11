import React from 'react';
import { 
  Animated, 
  BackHandler, 
  Image, 
  Platform, 
  Pressable, 
  StyleProp,
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  ViewStyle,
  View 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassSurface } from '../gcs/GlassSurface';
import { MAIN_NAV_ITEMS, MainRouteName, RootStackParamList } from '../../app/navigation/navigationConfig';
import { glass, glassShadow, layers, radius } from '../../theme/gcsTheme';

type Props = {
  currentRoute: keyof RootStackParamList;
  onNavigate: (route: MainRouteName) => void;
};

export function BrandLogoButton({ open, onPress, style }: { open: boolean; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const [imgError, setImgError] = React.useState(false);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={open ? 'Close navigation' : 'Open navigation'}
      accessibilityState={{ expanded: open }}
      activeOpacity={0.82}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      onPress={onPress}
      style={[styles.logoButton, style, open && styles.logoButtonOpen]}
    >
      <BlurView
        pointerEvents="none"
        tint="extraLight"
        intensity={68}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={StyleSheet.absoluteFill}
      />
      {!imgError ? (
        <Image 
          source={require('../../../assets/logo.png')} 
          style={styles.logoImage} 
          resizeMode="contain"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={styles.fallbackLogo}>
          <Text style={styles.fallbackText}>A</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function NavigationPopover({
  currentRoute,
  progress,
  onNavigate,
  style,
}: Props & { progress: Animated.Value; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View
      pointerEvents="auto"
      style={[
        styles.popoverWrap,
        style,
        {
          opacity: progress,
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        }
      ]}
    >
      <GlassSurface fill heavy intensity={68} style={styles.popover} contentStyle={styles.popoverContent}>
        <View style={styles.brandHeading}>
          <Text style={styles.brandName}>ANITECH</Text>
          <Text style={styles.brandProduct}>GROUND CONTROL</Text>
        </View>
        {MAIN_NAV_ITEMS.map((item) => {
          const active = currentRoute === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              accessibilityRole="menuitem"
              accessibilityLabel={`Open ${item.label}`}
              accessibilityState={{ selected: active }}
              onPress={() => onNavigate(item.name)}
              style={[styles.menuItem, active && styles.menuItemActive]}
            >
              <View style={[styles.itemIcon, active && styles.itemIconActive]}>
                <MaterialCommunityIcons 
                  name={item.icon} 
                  size={20} 
                  color={active ? '#2586EA' : glass.textMuted} 
                />
              </View>
              <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>
                {item.label}
              </Text>
              {active ? (
                <View style={styles.activeDot} />
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={17} color={glass.textDim} />
              )}
            </TouchableOpacity>
          );
        })}
      </GlassSurface>
    </Animated.View>
  );
}

export function BrandMenu({ currentRoute, onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);
  const progress = React.useRef(new Animated.Value(0)).current;
  const left = insets.left - 45;
  const top = insets.top + 4;

  const close = React.useCallback(() => setOpen(false), []);
  
  React.useEffect(() => {
    Animated.timing(progress, { 
      toValue: open ? 1 : 0, 
      duration: open ? 210 : 160, 
      useNativeDriver: true 
    }).start();
  }, [open, progress]);

  React.useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { 
      close(); 
      return true; 
    });
    return () => subscription.remove();
  }, [close, open]);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || !open || typeof document === 'undefined') return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, open]);

  const navigate = React.useCallback((route: MainRouteName) => {
    close();
    onNavigate(route);
  }, [close, onNavigate]);

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {open ? (
        <Pressable 
          accessibilityLabel="Close navigation" 
          style={styles.backdrop} 
          onPress={close} 
        />
      ) : null}
      {open ? (
        <NavigationPopover 
          currentRoute={currentRoute} 
          onNavigate={navigate} 
          progress={progress} 
          style={{ top: top + 60, left }}
        />
      ) : null}
      <BrandLogoButton open={open} onPress={() => setOpen(value => !value)} style={{ top, left }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    zIndex: layers.brand + 10, 
    elevation: layers.brand + 10,
  },
  backdrop: { 
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(15, 25, 40, 0.20)' 
  },
  logoButton: {
    position: 'absolute', 
    top: 10, 
    left: 14, 
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.32)', 
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)', 
    zIndex: layers.brand + 15,
    overflow: 'hidden',
    ...glassShadow,
  },
  logoButtonOpen: { 
    borderColor: '#2586EA',
    backgroundColor: 'rgba(255, 255, 255, 0.46)',
  },
  logoImage: { 
    width: 41,
    height: 41,
    borderRadius: 20.5,
  },
  fallbackLogo: {
    width: 41,
    height: 41,
    borderRadius: 20.5,
    backgroundColor: '#2586EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  popoverWrap: { 
    position: 'absolute', 
    top: 60, 
    left: 14, 
    width: 240, 
    zIndex: layers.brand + 20,
    elevation: layers.brand + 20,
  },
  popover: { 
    borderRadius: radius.lg, 
    backgroundColor: 'rgba(255, 255, 255, 0.36)',
    borderWidth: 1,
    borderColor: 'rgba(180, 190, 210, 0.60)',
    ...glassShadow 
  },
  popoverContent: { 
    padding: 10 
  },
  brandHeading: { 
    paddingHorizontal: 10, 
    paddingTop: 6, 
    paddingBottom: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  brandName: { 
    color: '#1E2A3A', 
    fontSize: 13, 
    fontWeight: '900', 
    letterSpacing: 1.2 
  },
  brandProduct: { 
    color: '#2586EA', 
    fontSize: 8, 
    fontWeight: '800', 
    letterSpacing: 1.2, 
    marginTop: 2 
  },
  menuItem: { 
    height: 44, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    paddingHorizontal: 8, 
    marginTop: 4, 
    borderRadius: radius.md, 
    borderWidth: 1, 
    borderColor: 'transparent' 
  },
  menuItemActive: { 
    backgroundColor: 'rgba(37, 134, 234, 0.12)', 
    borderColor: 'rgba(37, 134, 234, 0.35)' 
  },
  itemIcon: { 
    width: 30, 
    height: 30, 
    borderRadius: 8, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(0, 0, 0, 0.04)' 
  },
  itemIconActive: { 
    backgroundColor: 'rgba(37, 134, 234, 0.15)' 
  },
  itemLabel: { 
    flex: 1, 
    color: '#64748B', 
    fontSize: 12, 
    fontWeight: '800' 
  },
  itemLabelActive: { 
    color: '#1E2A3A',
    fontWeight: '900',
  },
  activeDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: '#2586EA' 
  },
});
