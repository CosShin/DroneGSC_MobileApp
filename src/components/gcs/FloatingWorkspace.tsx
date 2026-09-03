import React from 'react';
import { 
  BackHandler, 
  Pressable, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View, 
  ViewStyle 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { glass, glassShadow, layers, radius, spacing } from '../../theme/gcsTheme';
import { useGcsLayout } from '../../hooks/useGcsLayout';

interface Props {
  title: string;
  subtitle?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onClose: () => void;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  contentStyle?: ViewStyle;
}

export function FloatingWorkspace({ 
  title, 
  subtitle, 
  icon = 'cog-outline', 
  onClose, 
  children, 
  headerRight,
  contentStyle 
}: Props) {
  const layout = useGcsLayout();

  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const isCompact = layout.isCompactLandscape;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* 1. Translucent Backdrop allowing live Fly background to be visible */}
      <Pressable 
        accessibilityLabel="Close overlay" 
        style={styles.backdrop} 
        onPress={onClose} 
      />

      {/* 2. Floating Light Frosted Glass Workspace Panel */}
      <GlassSurface 
        fill
        variant="strong"
        intensity={76} 
        style={[
          styles.panel,
          isCompact ? styles.panelCompact : styles.panelStandard
        ]} 
        contentStyle={[styles.panelContent, contentStyle]}
      >
        {/* Workspace Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name={icon} size={isCompact ? 18 : 22} color="#2586EA" />
            </View>
            <View style={styles.titleWrap}>
              <Text numberOfLines={1} style={styles.titleText}>{title}</Text>
              {subtitle && !isCompact ? (
                <Text numberOfLines={1} style={styles.subtitleText}>{subtitle}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.headerRight}>
            {headerRight}
            <TouchableOpacity 
              accessibilityRole="button" 
              accessibilityLabel="Close"
              activeOpacity={0.7}
              style={styles.closeBtn} 
              onPress={onClose}
            >
              <MaterialCommunityIcons name="close" size={18} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Workspace Body */}
        <View style={styles.body}>
          {children}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: layers.workspace,
    elevation: layers.workspace,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 25, 40, 0.32)',
  },
  panel: {
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    overflow: 'hidden',
    ...glassShadow,
  },
  panelStandard: {
    width: '94%',
    maxWidth: 1220,
    height: '92%',
    maxHeight: 780,
  },
  panelCompact: {
    width: '96%',
    height: '95%',
  },
  panelContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 46,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 134, 234, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 134, 234, 0.25)',
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  titleText: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  subtitleText: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  body: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
});
