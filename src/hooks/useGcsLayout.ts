import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type GcsLayout = {
  screenWidth: number;
  screenHeight: number;
  contentWidth: number;
  contentHeight: number;
  isCompactLandscape: boolean;
  isStandardLandscape: boolean;
  isTabletLandscape: boolean;
  sidebarWidth: number;
  headerHeight: number;
  actionBarHeight: number;
  contentPadding: number;
  cardGap: number;
};

/** Shared landscape layout contract. Values are density-independent pixels. */
export function useGcsLayout(): GcsLayout {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompactLandscape = screenWidth < 800 || screenHeight < 390;
  const isTabletLandscape = screenWidth >= 1100 && screenHeight >= 560;
  const isStandardLandscape = !isCompactLandscape && !isTabletLandscape;
  // The cockpit shell no longer reserves permanent navigation space.
  const sidebarWidth = 0;
  const headerHeight = isCompactLandscape ? 48 : isTabletLandscape ? 64 : 54;
  const actionBarHeight = isCompactLandscape ? 44 : isTabletLandscape ? 54 : 50;
  const contentPadding = isCompactLandscape ? 6 : isTabletLandscape ? 12 : 8;
  const cardGap = isCompactLandscape ? 6 : isTabletLandscape ? 12 : 8;

  return {
    screenWidth,
    screenHeight,
    contentWidth: Math.max(0, screenWidth - insets.left - insets.right),
    contentHeight: Math.max(0, screenHeight - insets.top - insets.bottom),
    isCompactLandscape,
    isStandardLandscape,
    isTabletLandscape,
    sidebarWidth,
    headerHeight,
    actionBarHeight,
    contentPadding,
    cardGap,
  };
}
