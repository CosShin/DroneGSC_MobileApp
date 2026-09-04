import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { glass } from '../../theme/gcsTheme';

export type GlassVariant = 'light' | 'medium' | 'strong';

type Props = React.PropsWithChildren<ViewProps & {
  intensity?: number;
  contentStyle?: StyleProp<ViewStyle>;
  heavy?: boolean;
  fill?: boolean;
  variant?: GlassVariant;
}>;

/** Light frosted glass surface; safe in Expo Go and native dev clients. */
export function GlassSurface({ 
  children, 
  style, 
  contentStyle, 
  intensity, 
  heavy = false, 
  fill = false, 
  variant,
  ...props 
}: Props) {
  const resolvedVariant: GlassVariant = variant ?? (heavy ? 'strong' : 'medium');
  const intensityValue = intensity ?? (
    resolvedVariant === 'light' ? glass.blurLight : resolvedVariant === 'strong' ? glass.blurStrong : glass.blurMedium
  );

  return (
    <View
      {...props}
      style={[
        styles.frame,
        resolvedVariant === 'light' ? styles.light : resolvedVariant === 'strong' ? styles.strong : styles.medium,
        fill && styles.fill,
        style,
      ]}
    >
      <BlurView
        pointerEvents="none"
        tint="extraLight"
        intensity={intensityValue}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        blurReductionFactor={Platform.OS === 'android' ? 4 : undefined}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.innerHighlight} pointerEvents="none" />
      <View style={[styles.content, fill && styles.fill, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
  },
  fill: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  light: {
    backgroundColor: glass.backgroundSubtle,
  },
  medium: {
    backgroundColor: glass.backgroundMedium,
  },
  strong: {
    backgroundColor: glass.backgroundStrong,
  },
  innerHighlight: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.34)',
  },
  content: {
    minWidth: 0,
    minHeight: 0,
  },
});
