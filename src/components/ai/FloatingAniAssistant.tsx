import React from 'react';
import {
  Animated,
  Keyboard,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DraggableFloatingControl,
  type FloatingControlPosition,
} from '../common/DraggableFloatingControl';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectAiFloatingPosition,
  selectAiSettings,
  setAiFloatingPosition,
  setAiMuted,
} from '../../store/settings/settingsSlice';
import { aiService, type AiServiceState } from '../../services/ai/AiService';
import {
  speechRecognitionService,
  type SpeechRecognitionState,
} from '../../services/voice/SpeechRecognitionService';
import { aiSpeechService } from '../../services/voice/AiSpeechService';
import type { AiChatMessage } from '../../services/ai/AiTypes';
import { layers } from '../../theme/gcsTheme';
import { useGcsLayout } from '../../hooks/useGcsLayout';
import { FlightAssistantButton } from './FlightAssistantButton';
import { AiActionCard } from './cards/AiActionCard';
import {
  placePanelBesideControl,
  positionFromRatio,
  positionToRatio,
} from './floatingAniLayout';

interface Props {
  onOpenHistory: () => void;
}

const DEFAULT_PANEL_SIZE = { width: 320, height: 126 };

function latestAssistantMessage(messages: AiChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') return messages[index];
  }
  return null;
}

function cleanBubbleText(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*]\s+/gm, '• ')
    .trim();
}

function isPendingProposal(message: AiChatMessage | null) {
  const state = message?.proposal?.state;
  return Boolean(state && ![
    'SUCCESS',
    'ACKNOWLEDGED',
    'FAILED',
    'PREARM_FAILED',
    'COMMAND_DENIED',
    'TIMEOUT',
    'CANCELLED',
  ].includes(state));
}

export const FloatingAniAssistant = React.memo(function FloatingAniAssistant({ onOpenHistory }: Props) {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectAiSettings);
  const storedPosition = useAppSelector(selectAiFloatingPosition);
  const currentSessionId = useAppSelector(state => state.connection.sessionId ?? null);
  const layout = useGcsLayout();
  const insets = useSafeAreaInsets();
  const windowDimensions = useWindowDimensions();
  const viewport = React.useMemo(() => ({
    width: windowDimensions.width,
    height: windowDimensions.height,
  }), [windowDimensions.height, windowDimensions.width]);
  const iconSize = layout.isCompactLandscape ? 48 : 54;
  const iconBox = React.useMemo(() => ({ width: iconSize, height: iconSize }), [iconSize]);
  const fallbackPosition = React.useMemo(() => ({
    x: insets.left + 10,
    y: insets.top + (layout.isCompactLandscape ? 96 : 106),
  }), [insets.left, insets.top, layout.isCompactLandscape]);
  const [position, setPosition] = React.useState<FloatingControlPosition>(() => positionFromRatio(
    storedPosition,
    viewport,
    iconBox,
    fallbackPosition,
  ));
  const [panelSize, setPanelSize] = React.useState(DEFAULT_PANEL_SIZE);
  const [inputOpen, setInputOpen] = React.useState(false);
  const [inputText, setInputText] = React.useState('');
  const [bubbleVisible, setBubbleVisible] = React.useState(false);
  const [bubbleMounted, setBubbleMounted] = React.useState(false);
  const [bubblePinned, setBubblePinned] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [aiState, setAiState] = React.useState<AiServiceState>(aiService.getState());
  const [sttState, setSttState] = React.useState<SpeechRecognitionState>(speechRecognitionService.getState());
  const [isSpeaking, setIsSpeaking] = React.useState(aiSpeechService.isSpeaking);

  // User Speech Transcript State
  const [userBubbleVisible, setUserBubbleVisible] = React.useState(false);
  const [userTranscript, setUserTranscript] = React.useState('');
  const [userInterimText, setUserInterimText] = React.useState('');
  const [userSpeechState, setUserSpeechState] = React.useState<'IDLE' | 'LISTENING' | 'CONFIRMING' | 'SENT' | 'EMPTY'>('IDLE');
  const [userConfidence, setUserConfidence] = React.useState<number | null>(null);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  const bubbleOpacity = React.useRef(new Animated.Value(0)).current;
  const initialMessage = latestAssistantMessage(aiState.messages);
  const displayedMessageIdRef = React.useRef(initialMessage?.id ?? null);
  const voiceCaptureActiveRef = React.useRef(false);
  const voiceTranscriptSubmittedRef = React.useRef(false);

  const message = latestAssistantMessage(aiState.messages);
  const responseText = message ? cleanBubbleText(message.content) : '';
  const panelWidth = Math.max(248, Math.min(350, viewport.width * 0.42));
  const userTextLen = Math.max(userTranscript.length, userInterimText.length);
  const baseBubbleWidth = message?.proposal || message?.structuredCard
    ? panelWidth
    : aiState.isThinking
      ? Math.min(panelWidth, 210)
      : Math.max(160, Math.min(panelWidth, 120 + Math.min(responseText.length, 130) * 1.75));

  const bubbleWidth = userBubbleVisible
    ? Math.max(baseBubbleWidth, Math.min(panelWidth, 240 + Math.min(userTextLen, 100) * 1.2))
    : baseBubbleWidth;

  const maxPanelHeight = Math.max(150, viewport.height - insets.top - insets.bottom - 24);
  const placement = placePanelBesideControl(
    position,
    iconBox,
    { width: bubbleWidth, height: Math.min(panelSize.height, maxPanelHeight) },
    viewport,
    insets,
  );

  React.useEffect(() => {
    const unsubscribeAi = aiService.subscribe(setAiState);
    const unsubscribeStt = speechRecognitionService.subscribe(setSttState);
    const unsubscribeTts = aiSpeechService.subscribe(setIsSpeaking);
    return () => {
      voiceCaptureActiveRef.current = false;
      speechRecognitionService.cancelListening();
      unsubscribeAi();
      unsubscribeStt();
      unsubscribeTts();
    };
  }, []);

  React.useEffect(() => {
    setPosition(positionFromRatio(storedPosition, viewport, iconBox, fallbackPosition));
  }, [fallbackPosition, iconBox, storedPosition, viewport]);

  React.useEffect(() => {
    if ((settings.voiceProvider || 'SYSTEM_TTS') === 'ELEVENLABS') {
      aiSpeechService.configureNeuralVoice({
        provider: 'ELEVENLABS',
        voiceId: settings.elevenLabsVoiceId,
        modelId: settings.elevenLabsModelId,
        language: settings.neuralVoiceLanguage || settings.speechLanguage,
        timeoutMs: settings.neuralVoiceTimeoutMs,
        endpointBaseUrl: settings.neuralVoiceProxyUrl || undefined,
      });
    } else {
      aiSpeechService.configureNeuralVoice(null);
    }
  }, [
    settings.elevenLabsModelId,
    settings.elevenLabsVoiceId,
    settings.neuralVoiceLanguage,
    settings.neuralVoiceProxyUrl,
    settings.neuralVoiceTimeoutMs,
    settings.speechLanguage,
    settings.voiceProvider,
  ]);

  React.useEffect(() => {
    if (!message || message.id === displayedMessageIdRef.current) return;
    displayedMessageIdRef.current = message.id;
    setInputOpen(false);
    setBubblePinned(false);
    setDetailsOpen(false);
    setBubbleVisible(true);
  }, [message]);

  // Pulse animation for recording dot
  React.useEffect(() => {
    if (userSpeechState === 'LISTENING') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.25,
            duration: 550,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 550,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [pulseAnim, userSpeechState]);

  // Empty speech auto-hide after 3 seconds
  React.useEffect(() => {
    if (userSpeechState === 'EMPTY') {
      const timer = setTimeout(() => {
        setUserBubbleVisible(false);
        setUserSpeechState('IDLE');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [userSpeechState]);

  // Mutual conversation auto-hide after 6.5s
  React.useEffect(() => {
    const isAnyActive = bubbleVisible || userBubbleVisible;
    if (
      !isAnyActive ||
      bubblePinned ||
      aiState.isThinking ||
      isSpeaking ||
      sttState.isRecognizing ||
      userSpeechState === 'CONFIRMING' ||
      isPendingProposal(message)
    ) {
      return;
    }
    const timer = setTimeout(() => {
      setBubbleVisible(false);
      setUserBubbleVisible(false);
      setUserSpeechState('IDLE');
    }, 6500);
    return () => clearTimeout(timer);
  }, [
    aiState.isThinking,
    bubblePinned,
    bubbleVisible,
    isSpeaking,
    message,
    sttState.isRecognizing,
    userBubbleVisible,
    userSpeechState,
  ]);

  const shouldShowContainer = bubbleVisible || userBubbleVisible || aiState.isThinking || sttState.isRecognizing;

  React.useEffect(() => {
    bubbleOpacity.stopAnimation();
    if (shouldShowContainer) {
      setBubbleMounted(true);
      Animated.timing(bubbleOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(bubbleOpacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setBubbleMounted(false);
    });
  }, [bubbleOpacity, shouldShowContainer]);

  const handleDragEnd = React.useCallback((nextPosition: FloatingControlPosition) => {
    setPosition(nextPosition);
    dispatch(setAiFloatingPosition(positionToRatio(nextPosition, viewport, iconBox)));
  }, [dispatch, iconBox, viewport]);

  const handleIconPress = React.useCallback(() => {
    setInputOpen(value => !value);
    setBubbleVisible(false);
    setUserBubbleVisible(false);
    setBubblePinned(false);
    setDetailsOpen(false);
  }, []);

  const handleOpenHistory = React.useCallback(() => {
    setInputOpen(false);
    onOpenHistory();
  }, [onOpenHistory]);

  const handleSend = React.useCallback(() => {
    const text = inputText.trim();
    if (!text || aiState.isThinking) return;
    setInputText('');
    setInputOpen(false);
    setBubblePinned(false);
    Keyboard.dismiss();
    void aiService.sendUserMessage(text, { source: 'text' });
  }, [aiState.isThinking, inputText]);

  const submitVoiceTranscript = React.useCallback((rawTranscript: string) => {
    const transcript = rawTranscript.trim();
    if (!transcript || voiceTranscriptSubmittedRef.current) return;
    voiceTranscriptSubmittedRef.current = true;
    voiceCaptureActiveRef.current = false;
    setInputText('');
    setInputOpen(false);
    setUserTranscript(transcript);
    setUserInterimText('');
    setUserSpeechState('SENT');
    setUserBubbleVisible(true);
    void aiService.sendUserMessage(transcript, { source: 'voice' });
  }, []);

  const handleRetry = React.useCallback(async () => {
    setUserTranscript('');
    setUserInterimText('');
    setUserConfidence(null);
    setUserSpeechState('LISTENING');
    voiceTranscriptSubmittedRef.current = false;
    voiceCaptureActiveRef.current = true;
    await aiSpeechService.stop();
    await speechRecognitionService.startListening({ lang: settings.speechLanguage || 'vi-VN' });
  }, [settings.speechLanguage]);

  const handleConfirmSend = React.useCallback(() => {
    const text = userTranscript.trim();
    if (!text || aiState.isThinking) return;
    setUserSpeechState('SENT');
    submitVoiceTranscript(text);
  }, [aiState.isThinking, submitVoiceTranscript, userTranscript]);

  const handleCloseUserBubble = React.useCallback(() => {
    if (sttState.isRecognizing) {
      speechRecognitionService.cancelListening();
    }
    voiceCaptureActiveRef.current = false;
    setUserBubbleVisible(false);
    setUserSpeechState('IDLE');
  }, [sttState.isRecognizing]);

  React.useEffect(() => {
    if (sttState.isRecognizing) {
      setUserBubbleVisible(true);
      setUserSpeechState('LISTENING');
      setUserInterimText(sttState.interimTranscript || sttState.transcript);
      setUserConfidence(sttState.confidence);
      return;
    }

    if (voiceCaptureActiveRef.current) {
      if (sttState.status === 'IDLE') {
        voiceCaptureActiveRef.current = false;
        const raw = (sttState.transcript || sttState.interimTranscript).trim();
        setUserConfidence(sttState.confidence);

        if (!raw || sttState.errorCode === 'NO_SPEECH_DETECTED') {
          setUserSpeechState('EMPTY');
          setUserTranscript('');
          setUserInterimText('');
          return;
        }

        setUserTranscript(raw);
        setUserInterimText('');

        if (settings.voiceSendMode === 'CONFIRM') {
          setUserSpeechState('CONFIRMING');
        } else {
          setUserSpeechState('SENT');
          submitVoiceTranscript(raw);
        }
      } else if (sttState.status === 'ERROR' || sttState.errorCode) {
        voiceCaptureActiveRef.current = false;
        if (sttState.errorCode === 'NO_SPEECH_DETECTED') {
          setUserSpeechState('EMPTY');
          setUserTranscript('');
          setUserInterimText('');
        }
      }
    }
  }, [settings.voiceSendMode, sttState, submitVoiceTranscript]);

  const handleMicPress = React.useCallback(async () => {
    if (aiState.isThinking) return;
    Keyboard.dismiss();
    if (sttState.isRecognizing) {
      await speechRecognitionService.stopListening();
      return;
    }
    if (sttState.status === 'PROCESSING' || sttState.status === 'REQUESTING_PERMISSION') return;

    // AUDIO INTERRUPTION SAFETY: immediately stop ongoing speech before listening
    await aiSpeechService.stop();

    voiceCaptureActiveRef.current = true;
    voiceTranscriptSubmittedRef.current = false;
    setUserTranscript('');
    setUserInterimText('');
    setUserConfidence(null);
    setUserSpeechState('LISTENING');
    setUserBubbleVisible(true);

    await speechRecognitionService.startListening({ lang: settings.speechLanguage || 'vi-VN' });
  }, [aiState.isThinking, settings.speechLanguage, sttState.isRecognizing, sttState.status]);

  const handlePanelLayout = React.useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    if (Math.abs(next.height - panelSize.height) > 1 || Math.abs(next.width - panelSize.width) > 1) {
      setPanelSize({ width: next.width, height: next.height });
    }
  }, [panelSize.height, panelSize.width]);

  const showDetailsButton = Boolean(message?.structuredCard) || responseText.length > 180;

  const isMuted = Boolean(settings.ttsMuted);

  React.useEffect(() => {
    aiSpeechService.setMuted(isMuted);
  }, [isMuted]);

  const handleToggleMute = React.useCallback(async () => {
    const nextMuted = !isMuted;
    dispatch(setAiMuted(nextMuted));
    if (nextMuted) {
      await aiSpeechService.mute();
    } else {
      aiSpeechService.unmute();
    }
  }, [dispatch, isMuted]);

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {bubbleMounted ? (
        <Animated.View
          collapsable={false}
          onLayout={handlePanelLayout}
          onTouchStart={() => setBubblePinned(true)}
          style={[
            styles.anchoredPanel,
            {
              left: placement.x,
              top: placement.y,
              width: bubbleWidth,
              maxHeight: maxPanelHeight,
              opacity: bubbleOpacity,
            },
          ]}
        >
          {/* 1. USER SPEECH BUBBLE */}
          {userBubbleVisible ? (
            <View style={styles.bubbleCard}>
              <BlurView
                pointerEvents="none"
                tint="light"
                intensity={28}
                experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
                style={[StyleSheet.absoluteFill, styles.glassBackground]}
              />
              <View style={styles.bubbleHeader}>
                <View style={styles.bubbleTitleRow}>
                  {userSpeechState === 'LISTENING' ? (
                    <Animated.View style={[styles.liveRecordingDot, { opacity: pulseAnim }]} />
                  ) : (
                    <MaterialCommunityIcons name="account" size={13} color="#36C5F0" />
                  )}
                  <Text style={styles.bubbleTitle}>
                    {userSpeechState === 'LISTENING' ? 'ĐANG NGHE...' : 'BẠN'}
                  </Text>
                  {userConfidence !== null && userSpeechState !== 'LISTENING' && userSpeechState !== 'EMPTY' ? (
                    <View style={styles.confidencePill}>
                      <Text style={styles.confidenceText}>{Math.round(userConfidence * 100)}%</Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Đóng câu hỏi người dùng"
                  hitSlop={8}
                  onPress={handleCloseUserBubble}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.userBubbleContent}>
                {userSpeechState === 'EMPTY' ? (
                  <Text style={styles.emptySpeechText}>Không nghe rõ. Hãy thử nói lại.</Text>
                ) : userSpeechState === 'CONFIRMING' ? (
                  <View style={styles.confirmWrap}>
                    <TextInput
                      style={styles.editableTranscriptInput}
                      value={userTranscript}
                      onChangeText={setUserTranscript}
                      multiline
                      placeholder="Nhập hoặc sửa câu nói..."
                      placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    />
                    <View style={styles.confirmButtonsRow}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Nói lại câu hỏi"
                        onPress={handleRetry}
                        style={styles.retryBtn}
                      >
                        <MaterialCommunityIcons name="refresh" size={13} color="#38BDF8" />
                        <Text style={styles.retryBtnText}>Nói lại</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Gửi câu hỏi cho ANI"
                        disabled={!userTranscript.trim()}
                        onPress={handleConfirmSend}
                        style={[styles.confirmSendBtn, !userTranscript.trim() && styles.disabledButton]}
                      >
                        <MaterialCommunityIcons name="send" size={12} color="#FFFFFF" />
                        <Text style={styles.confirmSendBtnText}>Gửi</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : userSpeechState === 'LISTENING' ? (
                  <Text style={[styles.userTranscriptText, styles.interimText]}>
                    {userInterimText || 'Đang lắng nghe phi công...'}
                  </Text>
                ) : (
                  <Text style={styles.userTranscriptText}>{userTranscript}</Text>
                )}
              </View>
            </View>
          ) : null}

          {/* 2. ANI RESPONSE BUBBLE */}
          {bubbleVisible || aiState.isThinking ? (
            <View style={styles.bubbleCard}>
              <BlurView
                pointerEvents="none"
                tint="light"
                intensity={28}
                experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
                style={[StyleSheet.absoluteFill, styles.glassBackground]}
              />
              <View style={styles.bubbleHeader}>
                <View style={styles.bubbleTitleRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.bubbleTitle}>ANI</Text>
                  {bubblePinned ? <Text style={styles.pinnedText}>ĐANG GIỮ</Text> : null}
                </View>
                <View style={styles.bubbleHeaderActions}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={isMuted ? 'Bật âm thanh ANI (Voice OFF)' : 'Tắt tiếng ANI (Voice ON)'}
                    hitSlop={8}
                    onPress={handleToggleMute}
                    style={[styles.headerIconButton, isMuted && styles.headerIconButtonMuted]}
                  >
                    <MaterialCommunityIcons
                      name={isMuted ? 'volume-variant-off' : 'volume-high'}
                      size={15}
                      color={isMuted ? '#EF4444' : '#36C5F0'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Đóng câu trả lời ANI"
                    hitSlop={8}
                    onPress={() => setBubbleVisible(false)}
                    style={styles.closeButton}
                  >
                    <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                style={{ maxHeight: maxPanelHeight - (userBubbleVisible ? 110 : 36) }}
                contentContainerStyle={styles.bubbleContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator={detailsOpen || Boolean(message?.proposal)}
              >
                {aiState.isThinking ? (
                  <View style={styles.thinkingRow}>
                    <MaterialCommunityIcons name="creation" size={15} color="#36C5F0" />
                    <Text style={styles.thinkingText}>ANI đang suy nghĩ...</Text>
                  </View>
                ) : message ? (
                  <>
                    {message.structuredCard && !message.proposal ? (
                      <View style={styles.telemetrySummary}>
                        <Text style={styles.summaryTitle}>{message.structuredCard.title}</Text>
                        <View style={styles.metricGrid}>
                          {(message.structuredCard.metrics || []).slice(0, detailsOpen ? 12 : 6).map(metric => (
                            <View key={metric.label} style={styles.metricRow}>
                              <Text style={styles.metricLabel}>{metric.label}</Text>
                              <Text numberOfLines={1} style={styles.metricValue}>{metric.value}</Text>
                            </View>
                          ))}
                        </View>
                        {message.structuredCard.summary ? (
                          <Text numberOfLines={detailsOpen ? undefined : 2} style={styles.summaryText}>
                            {message.structuredCard.summary}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    {(!message.structuredCard || detailsOpen || message.proposal) && responseText ? (
                      <Text numberOfLines={detailsOpen || message.proposal ? undefined : 5} style={styles.responseText}>
                        {responseText}
                      </Text>
                    ) : null}

                    {message.proposal ? (
                      <View style={styles.actionCardWrap}>
                        <AiActionCard proposal={message.proposal} currentSessionId={currentSessionId} />
                      </View>
                    ) : null}

                    {showDetailsButton && !message.proposal ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => setDetailsOpen(value => !value)}
                        style={styles.detailsButton}
                      >
                        <Text style={styles.detailsButtonText}>{detailsOpen ? 'THU GỌN' : 'CHI TIẾT'}</Text>
                        <MaterialCommunityIcons
                          name={detailsOpen ? 'chevron-up' : 'chevron-down'}
                          size={13}
                          color="#36C5F0"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </>
                ) : null}
              </ScrollView>
            </View>
          ) : null}

          <View
            pointerEvents="none"
            style={[
              styles.arrow,
              placement.opensRight ? styles.arrowLeft : styles.arrowRight,
              placement.opensDown ? styles.arrowNearTop : styles.arrowNearBottom,
            ]}
          />
        </Animated.View>
      ) : null}

      {inputOpen ? (
        <View
          style={[
            styles.composerPanel,
            {
              left: placePanelBesideControl(
                position,
                iconBox,
                { width: panelWidth, height: sttState.errorMessage ? 76 : 48 },
                viewport,
                insets,
              ).x,
              top: placePanelBesideControl(
                position,
                iconBox,
                { width: panelWidth, height: sttState.errorMessage ? 76 : 48 },
                viewport,
                insets,
              ).y,
              width: panelWidth,
            },
          ]}
        >
          <BlurView
            pointerEvents="none"
            tint="light"
            intensity={28}
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            style={[StyleSheet.absoluteFill, styles.glassBackground]}
          />
          <View style={styles.composerRow}>
            <TextInput
              autoFocus
              editable={!aiState.isThinking && !sttState.isRecognizing}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              placeholder={sttState.isRecognizing ? 'Đang lắng nghe...' : 'Hỏi ANI...'}
              placeholderTextColor="rgba(255, 255, 255, 0.70)"
              returnKeyType="send"
              style={styles.input}
            />
            {settings.voiceEnabled ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={sttState.isRecognizing ? 'Dừng nghe ANI' : 'Chạm để nói với ANI'}
                disabled={aiState.isThinking}
                onPress={handleMicPress}
                style={[styles.composerButton, sttState.isRecognizing && styles.micActive]}
              >
                <MaterialCommunityIcons
                  name={sttState.isRecognizing ? 'stop' : 'microphone-outline'}
                  size={17}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Gửi câu hỏi cho ANI"
              disabled={!inputText.trim() || aiState.isThinking}
              onPress={handleSend}
              style={[styles.composerButton, styles.sendButton, (!inputText.trim() || aiState.isThinking) && styles.disabledButton]}
            >
              <MaterialCommunityIcons name="send" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {sttState.errorMessage ? (
            <Text numberOfLines={2} style={styles.voiceError}>{sttState.errorMessage}</Text>
          ) : null}
        </View>
      ) : null}

      <DraggableFloatingControl
        initialPosition={position}
        position={position}
        onPositionChange={setPosition}
        onDragEnd={handleDragEnd}
        onPress={handleIconPress}
        onLongPress={handleOpenHistory}
        style={styles.iconLayer}
      >
        <View style={{ width: iconSize, height: iconSize }}>
          <FlightAssistantButton
            variant="rail"
            compact={layout.isCompactLandscape}
            onPress={handleIconPress}
            interactive={false}
            style={{ width: iconSize, height: iconSize }}
          />
        </View>
      </DraggableFloatingControl>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: layers.panel,
    elevation: layers.panel,
  },
  iconLayer: {
    zIndex: layers.panel + 2,
    elevation: layers.panel + 2,
  },
  anchoredPanel: {
    position: 'absolute',
    zIndex: layers.panel + 1,
    overflow: 'visible',
    gap: 6,
  },
  bubbleCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(220, 230, 236, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  glassBackground: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  bubbleHeader: {
    height: 32,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.22)',
  },
  bubbleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#36C5F0',
  },
  liveRecordingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  confidencePill: {
    backgroundColor: 'rgba(54, 197, 240, 0.20)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  confidenceText: {
    color: '#38BDF8',
    fontSize: 8.5,
    fontWeight: '800',
  },
  userBubbleContent: {
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  userTranscriptText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  interimText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontStyle: 'italic',
  },
  emptySpeechText: {
    color: '#FCA5A5',
    fontSize: 11.5,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  confirmWrap: {
    gap: 7,
  },
  editableTranscriptInput: {
    minHeight: 32,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  retryBtnText: {
    color: '#38BDF8',
    fontSize: 10.5,
    fontWeight: '800',
  },
  confirmSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#36C5F0',
  },
  confirmSendBtnText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
  },
  bubbleTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pinnedText: {
    color: '#36C5F0',
    fontSize: 8,
    fontWeight: '800',
  },
  bubbleHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  headerIconButtonMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleContent: {
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  responseText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  thinkingRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thinkingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  telemetrySummary: {
    gap: 7,
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  metricRow: {
    width: '50%',
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  metricLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 8.5,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  summaryText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    lineHeight: 14.5,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  detailsButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailsButtonText: {
    color: '#36C5F0',
    fontSize: 9,
    fontWeight: '900',
  },
  actionCardWrap: {
    marginTop: 5,
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  arrowLeft: {
    left: -8,
    borderRightWidth: 8,
    borderRightColor: 'rgba(255, 255, 255, 0.65)',
  },
  arrowRight: {
    right: -8,
    borderLeftWidth: 8,
    borderLeftColor: 'rgba(255, 255, 255, 0.65)',
  },
  arrowNearTop: {
    top: 18,
  },
  arrowNearBottom: {
    bottom: 18,
  },
  composerPanel: {
    position: 'absolute',
    minHeight: 48,
    zIndex: layers.panel + 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(220, 230, 236, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    padding: 6,
  },
  composerRow: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 34,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    fontSize: 11.5,
    fontWeight: '600',
  },
  composerButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(54, 197, 240, 0.28)',
  },
  micActive: {
    backgroundColor: '#DC2626',
  },
  sendButton: {
    backgroundColor: '#36C5F0',
  },
  disabledButton: {
    opacity: 0.35,
  },
  voiceError: {
    color: '#FCA5A5',
    fontSize: 9,
    lineHeight: 12,
    marginTop: 4,
    paddingHorizontal: 2,
  },
});
