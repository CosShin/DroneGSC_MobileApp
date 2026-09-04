import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { selectAiSettings } from '../../store/settings/settingsSlice';
import { getModelMetadata } from '../../settings/defaults/ai';
import { aiService, type AiServiceState } from '../../services/ai/AiService';
import { speechRecognitionService, type SpeechRecognitionState } from '../../services/voice/SpeechRecognitionService';
import { aiSpeechService } from '../../services/voice/AiSpeechService';
import { AnimatedAiMascot } from './AnimatedAiMascot';
import { AiQuickActions } from './AiQuickActions';
import { AiMessageList } from './AiMessageList';
import { layers, radius } from '../../theme/gcsTheme';
import { useGcsLayout } from '../../hooks/useGcsLayout';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentSessionId?: string | null;
  onViewOnMap?: () => void;
}

export const FlightAssistantPanel = React.memo(function FlightAssistantPanel({
  visible,
  onClose,
  currentSessionId,
  onViewOnMap,
}: Props) {
  const layout = useGcsLayout();
  const aiSettings = useAppSelector(selectAiSettings);

  const [aiState, setAiState] = useState<AiServiceState>(aiService.getState());
  const [sttState, setSttState] = useState<SpeechRecognitionState>(speechRecognitionService.getState());
  const [isSpeaking, setIsSpeaking] = useState(aiSpeechService.isSpeaking);
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  const lastSpokenMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubAi = aiService.subscribe(setAiState);
    const unsubStt = speechRecognitionService.subscribe(setSttState);
    const unsubTts = aiSpeechService.subscribe(setIsSpeaking);

    return () => {
      unsubAi();
      unsubStt();
      unsubTts();
    };
  }, []);

  // Cleanup on close
  useEffect(() => {
    if (!visible) {
      void aiSpeechService.stop();
      speechRecognitionService.cancelListening();
      setIsMinimized(false);
    }
  }, [visible]);

  // Voice reply trigger when AI message arrives (decoupled spoken response)
  useEffect(() => {
    if (!aiSettings.voiceRepliesEnabled || !visible) return;

    const msgs = aiState.messages;
    if (msgs.length === 0) return;

    const lastMsg = msgs[msgs.length - 1];
    if (
      lastMsg.role === 'assistant' &&
      lastMsg.status === 'success' &&
      lastMsg.id !== lastSpokenMsgIdRef.current &&
      lastMsg.content.trim() &&
      !lastMsg.content.startsWith('Xin chào!')
    ) {
      lastSpokenMsgIdRef.current = lastMsg.id;
      // Use decoupled spoken text with deterministic tone and voice style
      const textToSpeak = lastMsg.spokenText || lastMsg.content;
      void aiSpeechService.speak(textToSpeak, {
        voice: aiSettings.voiceIdentifier,
        language: aiSettings.speechLanguage || 'vi-VN',
        rate: aiSettings.speechRate || 1.0,
        pitch: aiSettings.speechPitch || 1.0,
        gender: aiSettings.voiceGender,
        tone: lastMsg.tone || 'NORMAL',
        style: aiSettings.voiceStyle || 'COPILOT',
      });
    }
  }, [
    aiState.messages,
    aiSettings.voiceRepliesEnabled,
    aiSettings.speechLanguage,
    aiSettings.speechRate,
    aiSettings.speechPitch,
    aiSettings.voiceIdentifier,
    aiSettings.voiceGender,
    aiSettings.voiceStyle,
    visible,
  ]);

  if (!visible) return null;

  // Minimized mode: renders floating animated mascot that restores panel on tap
  if (isMinimized) {
    return (
      <View style={styles.minimizedContainer} pointerEvents="box-none">
        <AnimatedAiMascot
          size={38}
          onPress={() => setIsMinimized(false)}
          showStatusDot={true}
        />
      </View>
    );
  }

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || aiState.isThinking) return;
    setInputText('');
    Keyboard.dismiss();
    void aiService.sendUserMessage(text);
  };

  const handleQuickAction = (type: any) => {
    Keyboard.dismiss();
    if (type === 'ANALYZE_CAMERA') {
      void aiService.sendVisionQuery();
    } else if (type === 'CHECK_LANDING_MARKER') {
      void aiService.executeQuickAction(type);
    } else {
      void aiService.executeQuickAction(type);
    }
  };

  const handlePressInMic = async () => {
    if (aiState.isThinking) return;
    Keyboard.dismiss();
    await aiSpeechService.stop();
    await speechRecognitionService.startListening({
      lang: aiSettings.speechLanguage || 'vi-VN',
    });
  };

  const handlePressOutMic = async () => {
    if (!sttState.isRecognizing) return;
    const finalTranscript = await speechRecognitionService.stopListening();
    if (finalTranscript && finalTranscript.trim()) {
      setInputText('');
      void aiService.sendUserMessage(finalTranscript.trim());
    }
  };

  // Header data: Model · Status · Latency
  const modelMeta = getModelMetadata(aiSettings.model);
  const modelLabel = modelMeta.label || aiSettings.model;
  const status = aiState.diagnostics.status;
  const statusText = status === 'READY' ? 'Ready' : status === 'CONNECTING' ? 'Connecting' : status === 'ERROR' ? 'Error' : 'Offline';
  const latencyText = aiState.diagnostics.latencyMs != null ? `${(aiState.diagnostics.latencyMs / 1000).toFixed(1)}s` : '';
  const headerSubtitle = `${modelLabel} · ${statusText}${latencyText ? ` · ${latencyText}` : ''}`;

  // Landscape target: approximately 34–40% screen width
  const panelWidth = Math.max(340, Math.min(layout.contentWidth * 0.38, 410));

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Floating Glass Panel */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.panelWrapper,
          { width: panelWidth },
          layout.isCompactLandscape && styles.panelWrapperCompact,
        ]}
      >
        <View style={styles.panelCard}>
          <BlurView
            pointerEvents="none"
            tint="extraLight"
            intensity={Platform.OS === 'ios' ? 78 : 65}
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            style={StyleSheet.absoluteFill}
          />

          {/* 1. Header: [ mascot ] ANITECH Copilot / Subtitle, Right: [min] [clear] [close] */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <AnimatedAiMascot size={26} interactive={false} showStatusDot={false} />
              <View style={styles.headerTextCol}>
                <Text style={styles.headerTitle}>ANITECH Copilot</Text>
                <Text numberOfLines={1} style={styles.headerSubtitle}>
                  {headerSubtitle}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {/* Minimize button */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Minimize panel"
                style={styles.headerIconBtn}
                onPress={() => setIsMinimized(true)}
              >
                <MaterialCommunityIcons name="window-minimize" size={13} color="#64748B" />
              </TouchableOpacity>

              {/* Clear chat button */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Clear chat"
                style={styles.headerIconBtn}
                onPress={() => aiService.clearChat()}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={13} color="#64748B" />
              </TouchableOpacity>

              {/* Close button */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close panel"
                style={styles.headerIconBtn}
                onPress={onClose}
              >
                <MaterialCommunityIcons name="close" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. Compact Quick Actions (Single Row Chip Scroll) */}
          <AiQuickActions
            disabled={aiState.isThinking || sttState.isRecognizing}
            onSelectAction={handleQuickAction}
          />

          {/* 3. Messages List */}
          <View style={styles.messagesContainer}>
            <AiMessageList
              messages={aiState.messages}
              isThinking={aiState.isThinking}
              currentSessionId={currentSessionId}
              onViewOnMap={onViewOnMap}
            />
          </View>

          {/* 4. Bottom Compact Composer: [ 🎤 ] [ Hỏi Copilot... ] [ ➤ ] */}
          <View style={styles.composerContainer}>
            {/* Live voice transcript preview above composer while listening */}
            {sttState.isRecognizing && (
              <View style={styles.listeningPreview}>
                <View style={styles.pulseDot} />
                <Text style={styles.listeningPreviewText} numberOfLines={1}>
                  {sttState.interimTranscript || 'Đang lắng nghe phi công... Hãy nói câu lệnh'}
                </Text>
              </View>
            )}

            <View style={styles.composerBar}>
              {/* Mic PTT Button */}
              {aiSettings.voiceEnabled ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Hold to speak"
                  activeOpacity={0.75}
                  onPressIn={handlePressInMic}
                  onPressOut={handlePressOutMic}
                  disabled={aiState.isThinking}
                  style={[
                    styles.micBtn,
                    sttState.isRecognizing && styles.micBtnActive,
                    aiState.isThinking && styles.micBtnDisabled,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={sttState.isRecognizing ? 'microphone' : 'microphone-outline'}
                    size={16}
                    color={sttState.isRecognizing ? '#FFFFFF' : '#2586EA'}
                  />
                </TouchableOpacity>
              ) : null}

              {/* Text Input */}
              <TextInput
                style={styles.textInput}
                placeholder={sttState.isRecognizing ? 'Đang nhận dạng...' : 'Hỏi Copilot...'}
                placeholderTextColor="#94A3B8"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                editable={!aiState.isThinking && !sttState.isRecognizing}
              />

              {/* Stop Speaking Button (when TTS is active) */}
              {isSpeaking ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Stop speaking"
                  onPress={() => void aiSpeechService.stop()}
                  style={styles.stopSpeakingBtn}
                >
                  <MaterialCommunityIcons name="volume-off" size={14} color="#EF4444" />
                </TouchableOpacity>
              ) : null}

              {/* Send Button or Stop Thinking Button */}
              {aiState.isThinking ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Cancel request"
                  onPress={() => aiService.cancelCurrentRequest()}
                  style={[styles.sendBtn, styles.cancelBtn]}
                >
                  <MaterialCommunityIcons name="stop" size={13} color="#DC2626" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  onPress={handleSend}
                  disabled={!inputText.trim()}
                  style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                >
                  <MaterialCommunityIcons name="send" size={13} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
});

const styles = StyleSheet.create({
  overlayRoot: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    zIndex: layers.modal,
    elevation: layers.modal,
  },
  backdrop: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(15, 25, 40, 0.15)',
  },
  minimizedContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    zIndex: layers.modal,
    elevation: layers.modal,
  },
  panelWrapper: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    right: 12,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 8,
  },
  panelWrapperCompact: {
    top: 6,
    bottom: 6,
    right: 8,
  },
  panelCard: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.90)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    marginRight: 6,
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  composerContainer: {
    paddingHorizontal: 8,
    paddingBottom: 6,
    paddingTop: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.60)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.04)',
  },
  listeningPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 134, 234, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(37, 134, 234, 0.3)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  listeningPreviewText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
    fontStyle: 'italic',
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(37, 134, 234, 0.25)',
  },
  micBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(37, 134, 234, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: '#DC2626',
  },
  micBtnDisabled: {
    opacity: 0.4,
  },
  textInput: {
    flex: 1,
    fontSize: 11.5,
    color: '#1E293B',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  stopSpeakingBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2586EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  cancelBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
});
