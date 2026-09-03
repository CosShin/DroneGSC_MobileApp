import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectAiSettings, updateAiSettings } from '../../store/settings/settingsSlice';
import { SUPPORTED_AI_MODELS, getModelMetadata } from '../../settings/defaults/ai';
import { aiService, type AiServiceState } from '../../services/ai/AiService';
import { aiSpeechService, type SpeechVoice } from '../../services/voice/AiSpeechService';
import { Panel, SectionTitle, StatusChip } from '../gcs/Primitives';
import { GlassSurface } from '../gcs/GlassSurface';
import { colors, radius, spacing } from '../../theme/gcsTheme';

export function AiSettingsSection() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectAiSettings);
  const [aiState, setAiState] = useState<AiServiceState>(aiService.getState());
  const [testing, setTesting] = useState(false);
  const [deviceVoices, setDeviceVoices] = useState<SpeechVoice[]>([]);

  useEffect(() => {
    return aiService.subscribe(setAiState);
  }, []);

  useEffect(() => {
    let isMounted = true;
    aiSpeechService.getAvailableVoices(settings.speechLanguage).then(voices => {
      if (isMounted) {
        setDeviceVoices(voices);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [settings.speechLanguage]);

  const activeMetadata = getModelMetadata(settings.model);
  const isCloud = activeMetadata.execution === 'CLOUD';

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await aiService.testConnection();
      const execLabel = res.execution || activeMetadata.execution;
      if (res.success) {
        Alert.alert(
          'AI Server Connected',
          `Successfully connected to Ollama!\nModel: ${res.model}\nExecution: ${execLabel}\nLatency: ${res.latencyMs} ms${res.errorMessage ? `\n\nNotice: ${res.errorMessage}` : ''}`
        );
      } else {
        Alert.alert(
          'AI Connection Failed',
          `Cannot reach model (${execLabel}):\n${res.errorMessage || 'Unknown error'}\n\nTips:\n• For Gemma Cloud: run "ollama signin" on PC and check PC internet\n• For Qwen Local: verify "ollama pull qwen3.5:9b"\n• Verify Ollama is running (OLLAMA_HOST=0.0.0.0:11434)\n• Check Wi-Fi/Tailscale IP and Windows Firewall`
        );
      }
    } finally {
      setTesting(false);
    }
  };

  const diag = aiState.diagnostics;
  const status = diag.status;
  const statusTone: 'success' | 'warning' | 'danger' | 'neutral' = 
    status === 'READY' ? 'success' : status === 'CONNECTING' ? 'warning' : status === 'ERROR' ? 'danger' : 'neutral';

  const rateOptions = [0.8, 0.9, 1.0, 1.1, 1.2];
  const pitchOptions = [
    { label: 'Thấp (Low)', value: 0.8 },
    { label: 'Chuẩn (Normal)', value: 1.0 },
    { label: 'Cao (High)', value: 1.2 },
  ];

  return (
    <View style={styles.container}>
      {/* 1. Main Configuration Panel */}
      <Panel>
        <SectionTitle>Local AI Flight Assistant</SectionTitle>

        {/* Enable AI Assistant Switch */}
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.label}>Enable AI Assistant</Text>
            <Text style={styles.hint}>Activate flight copilot panel and preflight quick diagnostics</Text>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={enabled => {
              dispatch(updateAiSettings({ enabled }));
            }}
            trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
            thumbColor={settings.enabled ? '#2586EA' : '#F8FAFC'}
          />
        </View>

        {/* Provider Info */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Provider Gateway</Text>
          <GlassSurface variant="medium" style={styles.providerBadge} contentStyle={styles.providerBadgeContent}>
            <MaterialCommunityIcons name="robot-outline" size={16} color="#2586EA" />
            <Text style={styles.providerText}>Ollama on PC (Port 11434 via Wi-Fi / Tailscale)</Text>
          </GlassSurface>
        </View>

        {/* Host & Port Row */}
        <View style={styles.inputGrid}>
          <View style={[styles.fieldCol, { flex: 2 }]}>
            <Text style={styles.fieldLabel}>Server Host (Wi-Fi or Tailscale IP)</Text>
            <TextInput
              style={styles.input}
              value={settings.host}
              placeholder="e.g. 192.168.1.100 or 100.x.x.x"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={host => {
                dispatch(updateAiSettings({ host: host.trim() }));
              }}
            />
          </View>

          <View style={[styles.fieldCol, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Port</Text>
            <TextInput
              style={styles.input}
              value={String(settings.port)}
              placeholder="11434"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              onChangeText={val => {
                const port = parseInt(val, 10);
                if (!isNaN(port)) dispatch(updateAiSettings({ port }));
              }}
            />
          </View>
        </View>

        {/* Model Selection */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>AI Model Selection</Text>
          <View style={styles.modelGrid}>
            {SUPPORTED_AI_MODELS.map(preset => {
              const isSelected = settings.model.trim().toLowerCase() === preset.id.toLowerCase();
              const isPresetCloud = preset.execution === 'CLOUD';

              return (
                <TouchableOpacity
                  key={preset.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`Select ${preset.label}`}
                  activeOpacity={0.78}
                  style={[styles.modelCard, isSelected && styles.modelCardSelected]}
                  onPress={() => dispatch(updateAiSettings({ model: preset.id }))}
                >
                  <View style={styles.modelHeader}>
                    <View style={styles.radioRow}>
                      <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                        {isSelected ? <View style={styles.radioInner} /> : null}
                      </View>
                      <Text style={[styles.modelTitle, isSelected && styles.modelTitleSelected]}>
                        {preset.label}
                      </Text>
                    </View>
                    <View style={[styles.badgePill, isPresetCloud ? styles.badgeCloud : styles.badgeLocal]}>
                      <MaterialCommunityIcons
                        name={isPresetCloud ? 'cloud-outline' : 'laptop'}
                        size={11}
                        color={isPresetCloud ? '#8B5CF6' : '#10B981'}
                      />
                      <Text style={[styles.badgePillText, { color: isPresetCloud ? '#8B5CF6' : '#10B981' }]}>
                        {preset.execution}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.modelDescription}>{preset.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Custom Model & Timeout */}
        <View style={styles.inputGrid}>
          <View style={[styles.fieldCol, { flex: 2 }]}>
            <Text style={styles.fieldLabel}>Active Model Identifier</Text>
            <TextInput
              style={styles.input}
              value={settings.model}
              placeholder="e.g. qwen3.5:9b or gemma4:31b-cloud"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={model => {
                dispatch(updateAiSettings({ model: model.trim() }));
              }}
            />
          </View>

          <View style={[styles.fieldCol, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Timeout (sec)</Text>
            <TextInput
              style={styles.input}
              value={String(Math.round(settings.timeoutMs / 1000))}
              placeholder="30"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              onChangeText={val => {
                const sec = parseInt(val, 10);
                if (!isNaN(sec) && sec > 0) dispatch(updateAiSettings({ timeoutMs: sec * 1000 }));
              }}
            />
          </View>
        </View>

        {/* Privacy Disclosure Notice */}
        <View style={[styles.privacyBox, isCloud ? styles.privacyBoxCloud : styles.privacyBoxLocal]}>
          <MaterialCommunityIcons
            name={isCloud ? 'cloud-lock-outline' : 'shield-check-outline'}
            size={18}
            color={isCloud ? '#8B5CF6' : '#10B981'}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.privacyTitle, { color: isCloud ? '#7C3AED' : '#059669' }]}>
              {isCloud ? 'CLOUD AI PROCESSING' : 'LOCAL AI PRIVACY'}
            </Text>
            <Text style={styles.privacyCopy}>
              {isCloud
                ? 'Flight Assistant context is processed by the selected cloud model through Ollama.'
                : 'Runs locally on your PC. No flight telemetry leaves your local network.'}
            </Text>
          </View>
        </View>

        {/* Fallback to Local AI Switch */}
        <View style={styles.fallbackRow}>
          <View style={styles.copy}>
            <Text style={styles.label}>Fallback to Local AI</Text>
            <Text style={styles.hint}>
              If the cloud model is unreachable or fails, retry once with local fallback model
            </Text>
          </View>
          <Switch
            value={settings.enableFallback}
            onValueChange={enableFallback => {
              dispatch(updateAiSettings({ enableFallback }));
            }}
            trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
            thumbColor={settings.enableFallback ? '#2586EA' : '#F8FAFC'}
          />
        </View>

        {settings.enableFallback ? (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Fallback Model</Text>
            <TextInput
              style={styles.input}
              value={settings.fallbackModel}
              placeholder="qwen3.5:9b"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={fallbackModel => {
                dispatch(updateAiSettings({ fallbackModel: fallbackModel.trim() }));
              }}
            />
          </View>
        ) : null}

        {/* Test Connection Button */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Test AI Connection"
            disabled={testing || !settings.enabled}
            style={[styles.testBtn, (testing || !settings.enabled) && styles.testBtnDisabled]}
            onPress={handleTestConnection}
          >
            {testing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFFFFF" />
            )}
            <Text style={styles.testBtnText}>
              {testing ? 'Testing Connection...' : `TEST ${activeMetadata.execution} AI CONNECTION`}
            </Text>
          </TouchableOpacity>
        </View>
      </Panel>

      {/* 2. Voice Conversation Panel */}
      <Panel>
        <SectionTitle>Voice Conversation (Push-to-Talk & TTS)</SectionTitle>

        {/* Voice Input Switch */}
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.label}>Voice Assistant (Push-to-Talk)</Text>
            <Text style={styles.hint}>Hold microphone in Copilot panel to dictate flight inquiries</Text>
          </View>
          <Switch
            value={settings.voiceEnabled}
            onValueChange={voiceEnabled => {
              dispatch(updateAiSettings({ voiceEnabled }));
            }}
            trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
            thumbColor={settings.voiceEnabled ? '#2586EA' : '#F8FAFC'}
          />
        </View>

        {/* Voice Replies Switch */}
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.label}>Voice Replies (Text-to-Speech)</Text>
            <Text style={styles.hint}>Read AI answers aloud automatically through your device speaker</Text>
          </View>
          <Switch
            value={settings.voiceRepliesEnabled}
            onValueChange={voiceRepliesEnabled => {
              dispatch(updateAiSettings({ voiceRepliesEnabled }));
            }}
            trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
            thumbColor={settings.voiceRepliesEnabled ? '#2586EA' : '#F8FAFC'}
          />
        </View>

        {/* Speech Language Selector */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Recognition & Speech Language</Text>
          <View style={styles.segmentedRow}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                settings.speechLanguage === 'vi-VN' && styles.segmentBtnSelected,
              ]}
              onPress={() => dispatch(updateAiSettings({ speechLanguage: 'vi-VN' }))}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  settings.speechLanguage === 'vi-VN' && styles.segmentBtnTextSelected,
                ]}
              >
                🇻🇳 Tiếng Việt (vi-VN)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                settings.speechLanguage === 'en-US' && styles.segmentBtnSelected,
              ]}
              onPress={() => dispatch(updateAiSettings({ speechLanguage: 'en-US' }))}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  settings.speechLanguage === 'en-US' && styles.segmentBtnTextSelected,
                ]}
              >
                🇺🇸 English (en-US)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Voice Style / Gender Selector (Giọng Nam / Nữ) */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Tông giọng AI (Voice Style)</Text>
          <View style={styles.segmentedRow}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                settings.voiceGender === 'MALE' && styles.segmentBtnSelected,
              ]}
              onPress={() => {
                const maleVoice = deviceVoices.find(v => v.gender === 'MALE');
                dispatch(updateAiSettings({
                  voiceGender: 'MALE',
                  speechPitch: 0.8, // Deep resonant male copilot voice
                  voiceIdentifier: maleVoice ? maleVoice.identifier : settings.voiceIdentifier,
                }));
              }}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  settings.voiceGender === 'MALE' && styles.segmentBtnTextSelected,
                ]}
              >
                👨 Giọng Nam
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                settings.voiceGender === 'FEMALE' && styles.segmentBtnSelected,
              ]}
              onPress={() => {
                const femaleVoice = deviceVoices.find(v => v.gender === 'FEMALE');
                dispatch(updateAiSettings({
                  voiceGender: 'FEMALE',
                  speechPitch: 1.0,
                  voiceIdentifier: femaleVoice ? femaleVoice.identifier : settings.voiceIdentifier,
                }));
              }}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  settings.voiceGender === 'FEMALE' && styles.segmentBtnTextSelected,
                ]}
              >
                👩 Giọng Nữ
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                (!settings.voiceGender || settings.voiceGender === 'DEFAULT') && styles.segmentBtnSelected,
              ]}
              onPress={() => {
                dispatch(updateAiSettings({
                  voiceGender: 'DEFAULT',
                  speechPitch: 1.0,
                }));
              }}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  (!settings.voiceGender || settings.voiceGender === 'DEFAULT') && styles.segmentBtnTextSelected,
                ]}
              >
                ⚙️ Tự động
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Device Voice Selector */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Device TTS Voice</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.voiceScrollRow}
          >
            {/* Default OS Voice option */}
            <TouchableOpacity
              style={[
                styles.voiceChip,
                settings.voiceIdentifier === null && styles.voiceChipSelected,
              ]}
              onPress={() => dispatch(updateAiSettings({ voiceIdentifier: null }))}
            >
              <Text
                style={[
                  styles.voiceChipText,
                  settings.voiceIdentifier === null && styles.voiceChipTextSelected,
                ]}
              >
                Hệ thống mặc định (Default)
              </Text>
            </TouchableOpacity>

            {/* Real device voices */}
            {deviceVoices.map(v => {
              const isSelected = settings.voiceIdentifier === v.identifier;
              const isEnhanced = v.quality === 'Enhanced';

              return (
                <TouchableOpacity
                  key={v.identifier}
                  style={[
                    styles.voiceChip,
                    isSelected && styles.voiceChipSelected,
                  ]}
                  onPress={() => {
                    const updates: any = { voiceIdentifier: v.identifier };
                    if (v.gender === 'MALE') updates.voiceGender = 'MALE';
                    else if (v.gender === 'FEMALE') updates.voiceGender = 'FEMALE';
                    dispatch(updateAiSettings(updates));
                  }}
                >
                  <Text
                    style={[
                      styles.voiceChipText,
                      isSelected && styles.voiceChipTextSelected,
                    ]}
                  >
                    {v.name}
                  </Text>
                  {v.gender === 'MALE' ? (
                    <View style={styles.maleBadge}>
                      <Text style={styles.maleBadgeText}>👨 Nam</Text>
                    </View>
                  ) : v.gender === 'FEMALE' ? (
                    <View style={styles.femaleBadge}>
                      <Text style={styles.femaleBadgeText}>👩 Nữ</Text>
                    </View>
                  ) : null}
                  {isEnhanced ? (
                    <View style={styles.enhancedBadge}>
                      <Text style={styles.enhancedBadgeText}>★ Enhanced</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {deviceVoices.length === 0 ? (
            <Text style={styles.fieldSubHint}>
              Đang sử dụng bộ đọc mặc định của hệ thống thiết bị.
            </Text>
          ) : null}
        </View>

        {/* Speech Rate Selector (0.8x / 0.9x / 1.0x / 1.1x / 1.2x) */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Voice Playback Speed (Rate)</Text>
          <View style={styles.segmentedRow}>
            {rateOptions.map(rate => (
              <TouchableOpacity
                key={rate}
                style={[
                  styles.segmentBtn,
                  settings.speechRate === rate && styles.segmentBtnSelected,
                ]}
                onPress={() => dispatch(updateAiSettings({ speechRate: rate }))}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    settings.speechRate === rate && styles.segmentBtnTextSelected,
                  ]}
                >
                  {rate === 1.0 ? '1.0x' : `${rate}x`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Speech Pitch Selector (Low / Normal / High) */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Voice Tone (Pitch)</Text>
          <View style={styles.segmentedRow}>
            {pitchOptions.map(p => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.segmentBtn,
                  settings.speechPitch === p.value && styles.segmentBtnSelected,
                ]}
                onPress={() => dispatch(updateAiSettings({ speechPitch: p.value }))}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    settings.speechPitch === p.value && styles.segmentBtnTextSelected,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Voice Style Selector (Natural / Copilot / Calm) */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Phong cách phát thanh (Voice Style)</Text>
          <View style={styles.segmentedRow}>
            {(['NATURAL', 'COPILOT', 'CALM'] as const).map(style => (
              <TouchableOpacity
                key={style}
                style={[
                  styles.segmentBtn,
                  (settings.voiceStyle || 'COPILOT') === style && styles.segmentBtnSelected,
                ]}
                onPress={() => dispatch(updateAiSettings({ voiceStyle: style }))}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    (settings.voiceStyle || 'COPILOT') === style && styles.segmentBtnTextSelected,
                  ]}
                >
                  {style === 'NATURAL' ? '🍃 Tự nhiên' : style === 'COPILOT' ? '✈️ Copilot' : '🕊️ Trầm tĩnh'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Test Speech Audio */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Test Voice Audio"
            style={[styles.testBtn, styles.testVoiceBtn]}
            onPress={() => {
              const testPhrase = settings.speechLanguage === 'vi-VN'
                ? 'Xin chào, tôi là trợ lý bay ANITECH.'
                : 'Hello, I am ANITECH flight copilot.';
              void aiSpeechService.speak(testPhrase, {
                voice: settings.voiceIdentifier,
                language: settings.speechLanguage,
                rate: settings.speechRate,
                pitch: settings.speechPitch,
                gender: settings.voiceGender,
                style: settings.voiceStyle || 'COPILOT',
                tone: 'INFORMATIVE',
              });
            }}
          >
            <MaterialCommunityIcons name="volume-high" size={16} color="#2586EA" />
            <Text style={[styles.testBtnText, { color: '#2586EA' }]}>TEST VOICE</Text>
          </TouchableOpacity>
        </View>
      </Panel>

      {/* 3. Live AI Diagnostics Panel */}
      <Panel>
        <SectionTitle>AI Diagnostics & Health</SectionTitle>

        <View style={styles.diagGrid}>
          <View style={styles.diagCard}>
            <Text style={styles.diagLabel}>Server Status</Text>
            <StatusChip value={status} tone={statusTone} />
          </View>

          <View style={styles.diagCard}>
            <Text style={styles.diagLabel}>Execution Type</Text>
            <Text style={[styles.diagVal, { color: isCloud ? '#8B5CF6' : '#10B981' }]}>
              {diag.executionType || activeMetadata.execution}
            </Text>
          </View>

          <View style={styles.diagCard}>
            <Text style={styles.diagLabel}>Response Latency</Text>
            <Text style={styles.diagVal}>
              {diag.latencyMs != null ? `${diag.latencyMs} ms` : '--'}
            </Text>
          </View>

          <View style={styles.diagCard}>
            <Text style={styles.diagLabel}>Active Model</Text>
            <Text numberOfLines={1} style={styles.diagVal}>{settings.model || '--'}</Text>
          </View>
        </View>

        {diag.lastError ? (
          <View style={styles.errorNotice}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={styles.errorNoticeText}>{diag.lastError}</Text>
          </View>
        ) : null}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(180, 190, 210, 0.25)',
  },
  fallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(180, 190, 210, 0.25)',
  },
  copy: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  hint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  fieldRow: {
    paddingVertical: 8,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  fieldSubHint: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 2,
  },
  providerBadge: {
    borderRadius: radius.md,
    height: 38,
  },
  providerBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  providerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  modelGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modelCard: {
    flex: 1,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(180, 190, 210, 0.40)',
    gap: 6,
  },
  modelCardSelected: {
    borderColor: '#2586EA',
    backgroundColor: 'rgba(239, 246, 255, 0.85)',
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#2586EA',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2586EA',
  },
  modelTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#334155',
  },
  modelTitleSelected: {
    color: '#1D4ED8',
  },
  modelDescription: {
    fontSize: 10.5,
    color: '#64748B',
    lineHeight: 15,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeLocal: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  badgeCloud: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  inputGrid: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  fieldCol: {
    gap: 5,
  },
  input: {
    height: 38,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(180, 190, 210, 0.55)',
    paddingHorizontal: 12,
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '600',
  },
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 6,
  },
  privacyBoxLocal: {
    backgroundColor: 'rgba(236, 253, 245, 0.85)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  privacyBoxCloud: {
    backgroundColor: 'rgba(245, 243, 255, 0.90)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  privacyTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  privacyCopy: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    lineHeight: 15,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  segmentBtn: {
    flex: 1,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.70)',
    borderWidth: 1,
    borderColor: 'rgba(180, 190, 210, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segmentBtnSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2586EA',
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  segmentBtnTextSelected: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  voiceScrollRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  voiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(180, 190, 210, 0.50)',
  },
  voiceChipSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2586EA',
  },
  voiceChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  voiceChipTextSelected: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  enhancedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  enhancedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  maleBadge: {
    backgroundColor: 'rgba(37, 134, 234, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  maleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  femaleBadge: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  femaleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DB2777',
  },
  buttonRow: {
    paddingTop: 12,
  },
  testBtn: {
    height: 40,
    borderRadius: radius.md,
    backgroundColor: '#2586EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  testVoiceBtn: {
    backgroundColor: 'rgba(37, 134, 234, 0.12)',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  testBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  testBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  diagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 8,
  },
  diagCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.60)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(180, 190, 210, 0.35)',
    padding: 10,
    gap: 4,
  },
  diagLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  diagVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(254, 242, 242, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: radius.md,
    padding: 10,
    marginTop: 6,
  },
  errorNoticeText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
});
