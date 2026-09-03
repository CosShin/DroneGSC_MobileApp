export const colors = {
  background: '#F3F7FB',
  surface: 'rgba(255, 255, 255, 0.82)',
  elevated: 'rgba(245, 248, 252, 0.92)',
  border: 'rgba(180, 190, 210, 0.38)',
  borderStrong: 'rgba(150, 165, 185, 0.55)',
  
  primary: '#2586EA',
  primaryDark: '#1D64B4',
  primaryMuted: 'rgba(37, 134, 234, 0.12)',
  
  success: '#10B981',
  successMuted: 'rgba(16, 185, 129, 0.12)',
  
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.14)',
  
  danger: '#DC2626',
  dangerMuted: 'rgba(220, 38, 38, 0.14)',
  
  text: '#1E293B',
  textMuted: '#64748B',
  textDim: '#94A3B8',
  
  overlay: 'rgba(255, 255, 255, 0.92)',
  scrim: 'rgba(15, 25, 40, 0.32)',
} as const;

export const hudColors = {
  sky: '#50A8F5',
  skyGradientEnd: '#67B8F8',
  ground: '#69BE00',
  groundGradientEnd: '#58AE00',
  
  hudGlass: 'rgba(255, 255, 255, 0.65)',
  hudGlassHeavy: 'rgba(255, 255, 255, 0.85)',
  hudBorder: 'rgba(255, 255, 255, 0.85)',
  hudBorderSubtle: 'rgba(255, 255, 255, 0.60)',
  
  textDark: '#1E293B',
  textMuted: '#64748B',
  textDim: '#94A3B8',
  
  blue: '#2586EA',
  green: '#10B981',
  warning: '#F59E0B',
  danger: '#DC2626',
  
  headingPanel: 'rgba(15, 23, 42, 0.94)',
  headingBorder: 'rgba(255, 255, 255, 0.22)',
  headingGlow: '#38BDF8',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;

export const shadow = {
  card: {
    shadowColor: '#1F3251',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
} as const;

/** Light glassmorphism / white translucent cockpit palette */
export const glass = {
  background: 'rgba(255, 255, 255, 0.32)',
  backgroundHeavy: 'rgba(255, 255, 255, 0.46)',
  backgroundMedium: 'rgba(255, 255, 255, 0.32)',
  backgroundSubtle: 'rgba(255, 255, 255, 0.22)',
  backgroundStrong: 'rgba(255, 255, 255, 0.46)',
  backgroundElevated: 'rgba(245, 248, 252, 0.92)',
  
  border: 'rgba(180, 190, 210, 0.38)',
  borderLight: 'rgba(180, 190, 210, 0.28)',
  borderMedium: 'rgba(160, 170, 190, 0.48)',
  borderStrong: 'rgba(140, 155, 180, 0.60)',
  
  text: '#1E293B',
  textMuted: '#64748B',
  textDim: '#94A3B8',
  
  accent: '#2586EA',
  accentMuted: 'rgba(37, 134, 234, 0.12)',
  
  danger: 'rgba(220, 38, 38, 0.14)',
  dangerBorder: 'rgba(220, 38, 38, 0.35)',
  dangerText: '#DC2626',
  
  success: 'rgba(16, 185, 129, 0.14)',
  successBorder: 'rgba(16, 185, 129, 0.35)',
  successText: '#10B981',
  
  warning: 'rgba(245, 158, 11, 0.16)',
  warningBorder: 'rgba(245, 158, 11, 0.38)',
  warningText: '#D97706',

  blurLight: 42,
  blurMedium: 58,
  blurStrong: 76,
  radiusBar: 24,
} as const;

/** Unified z-index hierarchy contract */
export const layers = {
  background: 0,
  information: 10,
  controls: 20,
  hud: 30,
  panel: 40,
  workspace: 50,
  dialog: 60,
  brand: 80,
  dropdown: 90,
  modal: 100,
  critical: 110,
} as const;

export const glassShadow = {
  shadowColor: '#1F3251',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.10,
  shadowRadius: 24,
  elevation: 8,
} as const;
