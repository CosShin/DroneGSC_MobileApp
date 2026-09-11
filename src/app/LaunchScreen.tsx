import React from 'react';
import {
  Animated,
  Image,
  StyleSheet,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  MIN_SPLASH_DISPLAY_MS,
  MAX_SPLASH_TIMEOUT_MS,
  SPLASH_FADE_DURATION_MS,
  SPLASH_FALLBACK_BG,
} from './splashConfig';

export {
  MIN_SPLASH_DISPLAY_MS,
  MAX_SPLASH_TIMEOUT_MS,
  SPLASH_FADE_DURATION_MS,
  SPLASH_FALLBACK_BG,
};

const SPLASH_IMAGE = require('../../assets/splash/anitech-gcs-loading-landscape.jpg');

export interface LaunchScreenProps {
  ready?: boolean;
  onDismiss?: () => void;
}

export function LaunchScreen({ ready = false, onDismiss }: LaunchScreenProps) {
  const [isDismissed, setIsDismissed] = React.useState(false);
  const opacity = React.useRef(new Animated.Value(1)).current;
  const mountTimeRef = React.useRef(Date.now());
  const hasTriggeredFadeRef = React.useRef(false);

  // Hide native splash once React Native LaunchScreen decodes the landscape image
  const handleImageLoaded = React.useCallback(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  const handleImageError = React.useCallback(() => {
    // If image fails to load, ensure native splash still hides and fallback background takes over
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  const triggerDismiss = React.useCallback(() => {
    if (hasTriggeredFadeRef.current) return;
    hasTriggeredFadeRef.current = true;

    Animated.timing(opacity, {
      toValue: 0,
      duration: SPLASH_FADE_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      setIsDismissed(true);
      onDismiss?.();
    });
  }, [opacity, onDismiss]);

  React.useEffect(() => {
    // Immediate fallback in case image onLoad doesn't fire within 350ms
    const nativeHideTimer = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 350);

    return () => clearTimeout(nativeHideTimer);
  }, []);

  // When ready, ensure minimum display time is met before fading out
  React.useEffect(() => {
    if (!ready) return;

    const elapsed = Date.now() - mountTimeRef.current;
    const remainingTime = Math.max(0, MIN_SPLASH_DISPLAY_MS - elapsed);

    const timer = setTimeout(() => {
      triggerDismiss();
    }, remainingTime);

    return () => clearTimeout(timer);
  }, [ready, triggerDismiss]);

  // Safety maximum timeout: splash NEVER hangs indefinitely even if ready is never passed
  React.useEffect(() => {
    const safetyTimer = setTimeout(() => {
      triggerDismiss();
    }, MAX_SPLASH_TIMEOUT_MS);

    return () => clearTimeout(safetyTimer);
  }, [triggerDismiss]);

  if (isDismissed) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      testID="launch-screen-root"
      style={[
        styles.container,
        {
          opacity,
        },
      ]}
    >
      <Image
        source={SPLASH_IMAGE}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        fadeDuration={0}
        onLoad={handleImageLoaded}
        onError={handleImageError}
        testID="launch-screen-image"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 99999,
    backgroundColor: SPLASH_FALLBACK_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

