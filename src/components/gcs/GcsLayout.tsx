import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { glassShadow, layers, radius } from '../../theme/gcsTheme';
import { useGcsLayout } from '../../hooks/useGcsLayout';
import { GlassSurface } from './GlassSurface';

export function PageContainer({ children, style }: React.PropsWithChildren<{ style?: ViewStyle | ViewStyle[] }>) {
  const layout = useGcsLayout();
  return <View style={[styles.page, { padding: layout.contentPadding, gap: layout.cardGap }, style]}>{children}</View>;
}

export function BottomActionBar({ children, style }: React.PropsWithChildren<{ style?: ViewStyle | ViewStyle[] }>) {
  const layout = useGcsLayout();
  const barHeight = layout.isCompactLandscape ? 52 : 58;

  return (
    <View pointerEvents="box-none" style={styles.dock}>
      <GlassSurface 
        variant="strong"
        intensity={72} 
        style={[
          styles.actions, 
          { height: barHeight }, 
          style
        ]} 
        contentStyle={[
          styles.actionContent, 
          { gap: layout.isCompactLandscape ? 6 : 8, paddingHorizontal: layout.isCompactLandscape ? 8 : 12 }
        ]}
      >
        {children}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { 
    flex: 1, 
    minWidth: 0, 
    minHeight: 0 
  },
  dock: { 
    position: 'absolute', 
    left: 14, 
    right: 14, 
    bottom: 8, 
    zIndex: layers.hud, 
    alignItems: 'center' 
  },
  actions: { 
    width: '100%', 
    maxWidth: 940, 
    borderRadius: 24, 
    backgroundColor: 'rgba(255, 255, 255, 0.30)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.58)',
    ...glassShadow,
  },
  actionContent: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    height: '100%',
    paddingVertical: 4,
  },
});
