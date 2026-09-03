import React from 'react';
import { ViewStyle } from 'react-native';
import { AnimatedAiMascot } from './AnimatedAiMascot';

interface Props {
  onPress: () => void;
  onLongPress?: () => void;
  compact?: boolean;
  variant?: 'pill' | 'rail';
  style?: ViewStyle;
}

/**
 * ANITECH AI Assistant Launcher Button
 * Renders the animated ANITECH AI Mascot floating glass button.
 */
export const FlightAssistantButton = React.memo(function FlightAssistantButton({
  onPress,
  onLongPress,
  compact = false,
  style,
}: Props) {
  return (
    <AnimatedAiMascot
      onPress={onPress}
      onLongPress={onLongPress}
      size={compact ? 34 : 40}
      showStatusDot={true}
      interactive={true}
      style={style}
    />
  );
});
