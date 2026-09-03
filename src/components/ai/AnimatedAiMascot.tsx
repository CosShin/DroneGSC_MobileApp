import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { aiService, type AiServiceState } from '../../services/ai/AiService';
import { speechRecognitionService } from '../../services/voice/SpeechRecognitionService';
import { aiSpeechService } from '../../services/voice/AiSpeechService';
import { radius } from '../../theme/gcsTheme';

export type MascotState =
  | 'IDLE'
  | 'READY'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'ACTION_PENDING'
  | 'SUCCESS'
  | 'ERROR'
  | 'OFFLINE';

interface Props {
  onPress?: () => void;
  onLongPress?: () => void;
  size?: number; // Visible mascot size in px, defaults to 38
  stateOverride?: MascotState;
  showStatusDot?: boolean;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Conceptual asset path with transparent background
const MASCOT_IMAGE = require('../../../assets/ai/anitech-ai-mascot.png');

export const AnimatedAiMascot = React.memo(function AnimatedAiMascot({
  onPress,
  onLongPress,
  size = 38,
  stateOverride,
  showStatusDot = true,
  interactive = true,
  style,
}: Props) {
  // 1. Subscribe to real AI, Voice, and Action states
  const [aiState, setAiState] = useState<AiServiceState>(aiService.getState());
  const [isListening, setIsListening] = useState(speechRecognitionService.getState().isRecognizing);
  const [isSpeaking, setIsSpeaking] = useState(aiSpeechService.isSpeaking);
  const [successTrigger, setSuccessTrigger] = useState(false);

  useEffect(() => {
    const unsubAi = aiService.subscribe(setAiState);
    const unsubStt = speechRecognitionService.subscribe(s => setIsListening(s.isRecognizing));
    const unsubTts = aiSpeechService.subscribe(setIsSpeaking);

    return () => {
      unsubAi();
      unsubStt();
      unsubTts();
    };
  }, []);

  // 2. Derive authoritative MascotState without inventing fake states
  const activeState: MascotState = useMemo(() => {
    if (stateOverride) return stateOverride;

    const diagStatus = aiState.diagnostics.status;
    if (diagStatus === 'OFFLINE') return 'OFFLINE';
    if (diagStatus === 'ERROR') return 'ERROR';

    if (isListening) return 'LISTENING';
    if (aiState.isThinking) return 'THINKING';
    if (isSpeaking) return 'SPEAKING';

    // Check if any flight proposal is pending confirmation
    const hasPendingAction = aiState.messages.some(
      m => m.proposal && m.proposal.state === 'WAITING_CONFIRMATION'
    );
    if (hasPendingAction) return 'ACTION_PENDING';

    if (successTrigger) return 'SUCCESS';

    return 'READY';
  }, [stateOverride, aiState, isListening, isSpeaking, successTrigger]);

  // 3. UI-thread native animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseRingAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const currentLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Stop any running loop
    if (currentLoop.current) {
      currentLoop.current.stop();
      currentLoop.current = null;
    }

    // Reset base values
    shakeAnim.setValue(0);

    switch (activeState) {
      case 'OFFLINE': {
        Animated.timing(opacityAnim, {
          toValue: 0.60,
          duration: 300,
          useNativeDriver: true,
        }).start();
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
        break;
      }

      case 'READY':
      case 'IDLE': {
        opacityAnim.setValue(1);
        // Subtle floating (0 -> -2.5px -> 0) and gentle breathing
        const floatLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, {
              toValue: -2.5,
              duration: 1400,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: 0,
              duration: 1400,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        );
        const breathLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.025,
              duration: 1400,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1.0,
              duration: 1400,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        );
        currentLoop.current = Animated.parallel([floatLoop, breathLoop]);
        currentLoop.current.start();
        break;
      }

      case 'LISTENING': {
        opacityAnim.setValue(1);
        // Slightly enlarge, pulse ring loop (1s)
        scaleAnim.setValue(1.06);
        const pulseLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseRingAnim, {
              toValue: 1,
              duration: 900,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(pulseRingAnim, {
              toValue: 0,
              duration: 100,
              useNativeDriver: true,
            }),
          ])
        );
        currentLoop.current = pulseLoop;
        currentLoop.current.start();
        break;
      }

      case 'THINKING': {
        opacityAnim.setValue(1);
        // Floating and gentle thinking breathing
        const thinkFloat = Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, {
              toValue: -3.5,
              duration: 800,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: 0,
              duration: 800,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ])
        );
        currentLoop.current = thinkFloat;
        currentLoop.current.start();
        break;
      }

      case 'SPEAKING': {
        opacityAnim.setValue(1);
        // Visual speech pulses (scale 1 -> 1.06 -> 1)
        const speechPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.06,
              duration: 250,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 0.98,
              duration: 250,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        );
        currentLoop.current = speechPulse;
        currentLoop.current.start();
        break;
      }

      case 'ACTION_PENDING': {
        opacityAnim.setValue(1);
        // Amber alert pulse
        const alertPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.05,
              duration: 700,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1.0,
              duration: 700,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ])
        );
        currentLoop.current = alertPulse;
        currentLoop.current.start();
        break;
      }

      case 'SUCCESS': {
        opacityAnim.setValue(1);
        Animated.sequence([
          Animated.spring(scaleAnim, {
            toValue: 1.12,
            friction: 4,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
        break;
      }

      case 'ERROR': {
        opacityAnim.setValue(1);
        // Small brief shake (does not continuously shake)
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: -4, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -3, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 3, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
        break;
      }
    }

    return () => {
      if (currentLoop.current) {
        currentLoop.current.stop();
        currentLoop.current = null;
      }
    };
  }, [activeState, floatAnim, scaleAnim, pulseRingAnim, shakeAnim, opacityAnim]);

  // Color matching for status dot & rings
  const getStatusColor = () => {
    switch (activeState) {
      case 'READY':
      case 'IDLE':
        return '#10B981'; // Green
      case 'LISTENING':
        return '#38BDF8'; // Cyan
      case 'THINKING':
        return '#818CF8'; // Indigo
      case 'SPEAKING':
        return '#2586EA'; // Blue
      case 'ACTION_PENDING':
        return '#F59E0B'; // Amber
      case 'SUCCESS':
        return '#10B981'; // Emerald
      case 'ERROR':
        return '#EF4444'; // Red
      case 'OFFLINE':
      default:
        return '#94A3B8'; // Slate
    }
  };

  // Outer container size (ensuring >= 44x44 minimum touch target)
  const containerSize = Math.max(size + 8, 44);
  const ringScale = pulseRingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.45],
  });
  const ringOpacity = pulseRingAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.8, 0.4, 0],
  });

  const content = (
    <View style={[styles.wrapper, { width: containerSize, height: containerSize }, style]}>
      {/* 1. Animated Pulse Ring for LISTENING / SPEAKING */}
      {(activeState === 'LISTENING' || activeState === 'ACTION_PENDING') && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              width: containerSize,
              height: containerSize,
              borderRadius: containerSize / 2,
              borderColor: getStatusColor(),
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
        />
      )}

      {/* 2. Frosted Glass Floating Base */}
      <View
        style={[
          styles.glassCircle,
          {
            width: containerSize,
            height: containerSize,
            borderRadius: containerSize / 2,
            borderColor: activeState === 'ACTION_PENDING' ? '#F59E0B' : 'rgba(255, 255, 255, 0.75)',
          },
        ]}
      >
        {/* 3. Animated Mascot Image */}
        <Animated.View
          style={[
            styles.mascotHolder,
            {
              transform: [
                { translateY: floatAnim },
                { translateX: shakeAnim },
                { scale: scaleAnim },
              ],
              opacity: opacityAnim,
            },
          ]}
        >
          <Image
            source={MASCOT_IMAGE}
            style={{ width: size, height: size }}
            resizeMode="contain"
          />

          {/* Thinking animated indicator badge */}
          {activeState === 'THINKING' && (
            <View style={styles.thinkingBadge}>
              <View style={[styles.thinkingDot, styles.dot1]} />
              <View style={[styles.thinkingDot, styles.dot2]} />
              <View style={[styles.thinkingDot, styles.dot3]} />
            </View>
          )}
        </Animated.View>

        {/* 4. Action Pending "!" Badge */}
        {activeState === 'ACTION_PENDING' && (
          <View style={styles.actionPendingBadge}>
            <MaterialCommunityIcons name="exclamation" size={10} color="#FFFFFF" />
          </View>
        )}

        {/* 5. Status Dot at bottom-right */}
        {showStatusDot && (
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        )}
      </View>
    </View>
  );

  if (!interactive || !onPress) {
    return content;
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="ANITECH AI Mascot Assistant"
      activeOpacity={0.78}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.touchable}
    >
      {content}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  touchable: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  glassCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 4,
  },
  mascotHolder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  actionPendingBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  thinkingBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.4)',
  },
  thinkingDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#818CF8',
  },
  dot1: { opacity: 0.5 },
  dot2: { opacity: 0.8 },
  dot3: { opacity: 1 },
});
