import React from 'react';
import { ViewStyle } from 'react-native';
import { AnimatedAiMascot } from './AnimatedAiMascot';

interface Props {
  onPress: () => void;
  onLongPress?: () => void;
  compact?: boolean;
  variant?: 'pill' | 'rail';
  style?: ViewStyle;
  interactive?: boolean;
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
  interactive = true,
  variant = 'pill',
}: Props) {
  const size = variant === 'rail'
    ? (compact ? 42 : 46)
    : (compact ? 34 : 40);

  return (
    <AnimatedAiMascot
      onPress={onPress}
      onLongPress={onLongPress}
      size={size}
      showStatusDot={true}
      interactive={interactive}
      style={style}
    />
  );
});
