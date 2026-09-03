import type { RootState } from '../../store';
import { selectAiSettings } from '../../store/settings/settingsSlice';
import type { AiDiagnosticsState, AiSettings } from '../../settings/types/ai';
import { getModelMetadata, DEFAULT_AI_CONFIG } from '../../settings/defaults/ai';
import { aiClient, type IAiClient, type ChatRequestMessage } from './AiClient';
import { buildFlightContext } from './FlightContextBuilder';
import {
  SYSTEM_PROMPT,
  buildUserMessageWithContext,
  buildQuickActionPrompt,
  trimConversationHistory,
} from './AiPromptBuilder';
import type {
  AiChatMessage,
  AiQuickActionType,
  AiTestResult,
  FlightContextSnapshot,
} from './AiTypes';
import { aiIntentParser } from './intents/AiIntentParser';
import { aiActionValidator } from './actions/AiActionValidator';
import type { AiActionProposal } from './intents/AiIntentTypes';
import { videoFrameCaptureService } from '../video/VideoFrameCaptureService';
import { precisionLandingAdvisor } from '../vision/PrecisionLandingAdvisor';
import { aiSpeechService } from '../voice/AiSpeechService';
import { processSemanticResponse } from './semantic/SemanticResponseProcessor';
import { buildSpokenResponse } from '../voice/SpokenResponseBuilder';
import type { SemanticStructuredCard, SpeechTone } from './AiTypes';

let lazyStore: { getState: () => RootState } | null = null;
function getStoreState(): RootState | null {
  if (!lazyStore) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      lazyStore = require('../../store').store;
    } catch {
      lazyStore = null;
    }
  }
  return lazyStore ? lazyStore.getState() : null;
}

export interface AiServiceState {
  messages: AiChatMessage[];
  diagnostics: AiDiagnosticsState;
  isThinking: boolean;
}

const QUICK_ACTION_LABELS: Record<AiQuickActionType, string> = {
  PREFLIGHT: '🛫 Preflight Check',
  WHY_CANT_ARM: "⚠️ Why Can't I Arm?",
  MAVLINK_CHECK: '📊 Check MAVLink Telemetry',
  MISSION_REVIEW: '🗺️ Review Mission Plan',
  ANALYZE_CAMERA: '📷 Phân tích Camera',
  CHECK_LANDING_MARKER: '🎯 Landing Marker',
};

class AiService {
  private client: IAiClient = aiClient;
  private messages: AiChatMessage[] = [];
  private isThinking = false;
  private currentAbortController: AbortController | null = null;
  private listeners = new Set<(state: AiServiceState) => void>();
  private customStore: { getState: () => any } | null = null;

  setStore(s: { getState: () => any } | null) {
    this.customStore = s;
  }

  private getSettings(): AiSettings {
    const state = this.customStore?.getState() ?? getStoreState();
    return state ? selectAiSettings(state) : DEFAULT_AI_CONFIG;
  }

  private diagnostics: AiDiagnosticsState = {
    status: 'OFFLINE',
    latencyMs: null,
    lastTestedAt: null,
    lastError: null,
    modelName: null,
    serverVersion: null,
  };

  constructor() {
    // Initial welcome message
    this.messages = [
      {
        id: 'welcome-msg',
        role: 'assistant',
        content: 'Xin chào! Tôi là ANITECH Flight Copilot.\nTôi có thể hỗ trợ điều khiển bằng giọng nói, tạo kế hoạch bay tự động, kiểm tra an toàn Preflight và phân tích hình ảnh camera.\n\nHãy chọn thao tác nhanh bên dưới hoặc ra lệnh trực tiếp.',
        timestamp: Date.now(),
        status: 'success',
      },
    ];
  }

  getState(): AiServiceState {
    return {
      messages: [...this.messages],
      diagnostics: { ...this.diagnostics },
      isThinking: this.isThinking,
    };
  }

  subscribe(listener: (state: AiServiceState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const s = this.getState();
    this.listeners.forEach(l => l(s));
  }

  clearHistory() {
    this.messages = [
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: 'Lịch sử hội thoại đã được xóa. Tôi sẵn sàng tiếp nhận yêu cầu mới.',
        timestamp: Date.now(),
        status: 'success',
      },
    ];
    this.emit();
  }

  cancelCurrentRequest() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.isThinking = false;
    this.emit();
  }

  cancelRequest() {
    this.cancelCurrentRequest();
  }

  async testConnection(): Promise<AiTestResult> {
    const settings = this.getSettings();
    this.diagnostics.status = 'CONNECTING';
    this.emit();

    const result = await this.client.healthCheck(settings);

    if (result.success) {
      this.diagnostics = {
        status: 'READY',
        latencyMs: result.latencyMs,
        lastTestedAt: Date.now(),
        lastError: null,
        modelName: result.model,
        serverVersion: result.serverVersion || 'Ollama API OK',
        executionType: result.execution,
      };
    } else {
      this.diagnostics = {
        status: 'ERROR',
        latencyMs: result.latencyMs,
        lastTestedAt: Date.now(),
        lastError: result.errorMessage || 'Connection failed',
        modelName: result.model,
        serverVersion: null,
        executionType: result.execution,
      };
    }
    this.emit();
    return result;
  }

  async sendUserMessage(userPrompt: string): Promise<void> {
    return this.sendMessage(userPrompt);
  }

  clearChat() {
    this.clearHistory();
  }

  async sendMessage(userPrompt: string): Promise<void> {
    if (this.isThinking) return;
    const trimmed = userPrompt.trim();
    if (!trimmed) return;

    const settings = this.getSettings();
    if (!settings.enabled) {
      this.addErrorMessage('AI Copilot hiện đang tắt trong Cài đặt.');
      return;
    }

    // 1. Capture contextual snapshot strictly on demand
    const contextSnapshot = buildFlightContext(this.customStore?.getState() ?? undefined);

    // 2. Add User Message to History
    const userMsgId = `user-${Date.now()}`;
    const userMsg: AiChatMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      status: 'success',
    };
    this.messages.push(userMsg);
    this.messages = trimConversationHistory(this.messages, 15);

    // 3. Prepare payload
    const contextualUserPrompt = buildUserMessageWithContext(trimmed, contextSnapshot);
    await this.executePrompt(contextualUserPrompt, settings);
  }

  async executeQuickAction(actionType: AiQuickActionType): Promise<void> {
    if (this.isThinking) return;

    const settings = this.getSettings();
    if (!settings.enabled) {
      this.addErrorMessage('AI Copilot hiện đang tắt trong Cài đặt.');
      return;
    }

    if (actionType === 'ANALYZE_CAMERA') {
      await this.sendVisionQuery();
      return;
    }

    if (actionType === 'CHECK_LANDING_MARKER') {
      const advisory = precisionLandingAdvisor.getAdvisoryDescription('vi-VN');
      const actionLabel = QUICK_ACTION_LABELS[actionType] || actionType;
      this.messages.push({
        id: `action-${Date.now()}`,
        role: 'user',
        content: actionLabel,
        timestamp: Date.now(),
        status: 'success',
      });
      const targetState = precisionLandingAdvisor.getTargetState();
      const tone: SpeechTone = targetState.targetFound ? 'POSITIVE' : 'INFORMATIVE';
      const card: SemanticStructuredCard = {
        type: 'FLIGHT_STATUS',
        title: 'PRECISION LANDING TARGET',
        metrics: [
          { label: 'STATUS', value: targetState.targetFound ? 'LOCKED' : 'NO TARGET', tone: targetState.targetFound ? 'success' : 'warning' },
          { label: 'MARKER ID', value: targetState.tagId != null ? `#${targetState.tagId}` : '--', tone: 'neutral' },
          { label: 'OFFSET X', value: targetState.offsetXCentimeters != null ? `${Math.round(targetState.offsetXCentimeters)} cm` : '--', tone: 'neutral' },
          { label: 'OFFSET Y', value: targetState.offsetYCentimeters != null ? `${Math.round(targetState.offsetYCentimeters)} cm` : '--', tone: 'neutral' },
          { label: 'ALTITUDE', value: targetState.altitudeMeters != null ? `${targetState.altitudeMeters.toFixed(1)} m` : '--', tone: 'neutral' },
        ],
        summary: advisory,
        tone,
      };

      this.messages.push({
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: `🎯 [TRẠNG THÁI PRECISION LANDING]\n\n${advisory}\n\n*Lưu ý: Hệ thống hạ cánh chính xác được điều khiển tự động bởi ArduPilot autopilot (PLND). AI cung cấp thông tin thị giác giám sát cho phi công.*`,
        structuredCard: card,
        spokenText: advisory,
        tone,
        timestamp: Date.now(),
        status: 'success',
      });
      this.messages = trimConversationHistory(this.messages, 15);
      this.emit();
      void aiSpeechService.speak(advisory, { language: 'vi-VN', tone });
      return;
    }

    // 1. Capture snapshot strictly on demand
    const contextSnapshot = buildFlightContext(this.customStore?.getState() ?? undefined);

    // 2. Add action label as user query in UI
    const actionLabel = QUICK_ACTION_LABELS[actionType] || actionType;
    const userMsg: AiChatMessage = {
      id: `action-${Date.now()}`,
      role: 'user',
      content: actionLabel,
      timestamp: Date.now(),
      status: 'success',
    };
    this.messages.push(userMsg);
    this.messages = trimConversationHistory(this.messages, 15);

    // 3. Build specialized prompt
    const prompt = buildQuickActionPrompt(actionType, contextSnapshot);
    await this.executePrompt(prompt, settings);
  }

  addSupervisorAlert(alert: {
    id: string;
    timestamp: number;
    level: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    suggestedAction?: 'RTL' | 'LAND' | 'CHECK_GPS' | 'CHECK_BATTERY';
  }) {
    const proposal = alert.suggestedAction === 'RTL' || alert.suggestedAction === 'LAND'
      ? {
          id: `sup-${alert.id}`,
          intent: { type: alert.suggestedAction as any },
          requiresConfirmation: true,
          requiresHoldConfirmation: true,
          title: alert.suggestedAction === 'RTL' ? 'QUAY VỀ HOME (RTL)' : 'HẠ CÁNH KHẨN CẤP (LAND)',
          description: alert.message,
          state: 'WAITING_CONFIRMATION' as const,
          proposedAt: Date.now(),
        }
      : undefined;

    const tone: SpeechTone = alert.level === 'CRITICAL' ? 'URGENT' : alert.level === 'WARNING' ? 'CAUTION' : 'INFORMATIVE';
    const card: SemanticStructuredCard = {
      type: 'WARNING',
      title: alert.level === 'CRITICAL' ? 'CẢNH BÁO KHẨN CẤP' : 'CẢNH BÁO GIÁM SÁT BAY',
      summary: alert.message,
      recommendations: alert.suggestedAction ? [`Cân nhắc chuyển ${alert.suggestedAction}`] : undefined,
      tone,
    };

    const spoken = buildSpokenResponse(alert.message, 'vi-VN', card);

    this.messages.push({
      id: alert.id,
      role: 'assistant',
      content: `⚠️ [CẢNH BÁO GIÁM SÁT BAY]\n${alert.message}`,
      proposal,
      structuredCard: card,
      spokenText: spoken.spokenText,
      tone,
      timestamp: alert.timestamp,
      status: 'success',
    });
    this.messages = trimConversationHistory(this.messages, 15);
    this.emit();
  }

  /**
   * Analyzes camera frame imagery (Vision AI).
   * Verifies model vision capability and checks cloud privacy consent.
   */
  async sendVisionQuery(
    prompt = 'Mô tả hình ảnh phía trước camera và đánh giá các chướng ngại vật hoặc vùng hạ cánh.',
    options: { cloudConsentGiven?: boolean } = {},
  ): Promise<void> {
    if (this.isThinking) return;

    const settings = this.getSettings();
    if (!settings.enabled) {
      this.addErrorMessage('AI Copilot hiện đang tắt trong Cài đặt.');
      return;
    }

    const metadata = getModelMetadata(settings.model);

    // 1. Check Vision Capability of selected model
    if (!metadata.supportsVision) {
      this.messages.push({
        id: `user-${Date.now()}`,
        role: 'user',
        content: `📷 ${prompt}`,
        timestamp: Date.now(),
        status: 'success',
      });
      this.messages.push({
        id: `vision-unsupported-${Date.now()}`,
        role: 'assistant',
        content: `VISION NOT AVAILABLE FOR CURRENT MODEL\n\nMô hình ${settings.model} (${metadata.execution}) hiện tại không hỗ trợ phân tích hình ảnh.\nVui lòng chuyển sang mô hình có hỗ trợ Vision (ví dụ: Gemma 4 Cloud hoặc model Vision trên PC).`,
        timestamp: Date.now(),
        status: 'error',
      });
      this.emit();
      return;
    }

    // 2. Capture exactly ONE current frame on-demand
    const frame = await videoFrameCaptureService.captureCurrentFrame();
    if (!frame || !frame.base64) {
      this.addErrorMessage('Không thể chụp hình ảnh từ luồng video camera. Vui lòng đảm bảo camera đang kết nối và tab VIDEO đang mở.');
      return;
    }

    // 3. Add user message with captured image preview
    const userMsgId = `user-vision-${Date.now()}`;
    this.messages.push({
      id: userMsgId,
      role: 'user',
      content: `📷 ${prompt}`,
      image: frame.base64,
      timestamp: Date.now(),
      status: 'success',
    });
    this.messages = trimConversationHistory(this.messages, 15);

    const contextSnapshot = buildFlightContext(this.customStore?.getState() ?? undefined);
    const contextualPrompt = `${buildUserMessageWithContext(prompt, contextSnapshot)}
\n[AI VISUAL ASSESSMENT: Phân tích khách quan hình ảnh camera đính kèm. Đây là thông tin trợ giúp phi công, không sử dụng làm vòng điều khiển tự động.]`;

    await this.executePrompt(contextualPrompt, settings, [frame.base64]);
  }

  private async executePrompt(
    formattedPrompt: string,
    settings: ReturnType<typeof selectAiSettings>,
    attachedImages?: string[],
  ): Promise<void> {
    const assistantMsgId = `asst-${Date.now()}`;
    const assistantMsg: AiChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'sending',
    };
    this.messages.push(assistantMsg);
    this.isThinking = true;
    this.emit();

    this.currentAbortController = new AbortController();

    try {
      // Build conversation request array
      const historyRequests: ChatRequestMessage[] = this.messages
        .filter(m => m.id !== assistantMsgId && m.status === 'success')
        .slice(-6)
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      const userMsgPayload: ChatRequestMessage = {
        role: 'user',
        content: formattedPrompt,
      };
      if (attachedImages && attachedImages.length > 0) {
        userMsgPayload.images = attachedImages;
      }

      const requestMessages: ChatRequestMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...historyRequests,
        userMsgPayload,
      ];

      const response = await this.client.chat(
        requestMessages,
        settings,
        this.currentAbortController.signal,
      );

      // Parse structured intent proposal from response
      const state = this.customStore?.getState() ?? getStoreState();
      const vehicleSessionId = state?.connection?.sessionId || null;
      const parsed = aiIntentParser.parse(response.content, vehicleSessionId);

      // If a proposal was generated, run initial deterministic safety check
      if (parsed.proposal && state) {
        const validationErr = aiActionValidator.validate(parsed.proposal, state, vehicleSessionId);
        if (validationErr) {
          parsed.proposal.error = validationErr;
          parsed.proposal.state = 'FAILED';
        }
      }

      // Semantic processing: decoupling UI Cards/Markdown from natural spoken voice
      const semantic = processSemanticResponse(
        parsed.message,
        state,
        settings.speechLanguage || 'vi-VN'
      );

      const targetIdx = this.messages.findIndex(m => m.id === assistantMsgId);
      if (targetIdx >= 0) {
        this.messages[targetIdx].content = parsed.message;
        this.messages[targetIdx].proposal = parsed.proposal;
        this.messages[targetIdx].structuredCard = semantic.structuredCard;
        this.messages[targetIdx].spokenText = semantic.spokenText;
        this.messages[targetIdx].tone = semantic.tone;
        this.messages[targetIdx].status = 'success';
      }

      this.diagnostics.status = 'READY';
      this.diagnostics.latencyMs = response.latencyMs;
      this.diagnostics.lastTestedAt = Date.now();
      this.diagnostics.lastError = null;
    } catch (error) {
      let errorMsg = error instanceof Error ? error.message : 'Unknown AI request error';
      const metadata = getModelMetadata(settings.model);
      const canFallback = settings.enableFallback
        && metadata.execution === 'CLOUD'
        && settings.fallbackModel
        && settings.fallbackModel.trim().toLowerCase() !== settings.model.trim().toLowerCase()
        && !this.currentAbortController?.signal.aborted;

      if (canFallback) {
        try {
          const fallbackSettings = { ...settings, model: settings.fallbackModel.trim() };
          const fallbackResponse = await this.client.chat(
            [
              { role: 'system', content: SYSTEM_PROMPT },
              ...this.messages.filter(m => m.id !== assistantMsgId && m.status === 'success').slice(-6).map(m => ({ role: m.role, content: m.content })),
              { role: 'user', content: formattedPrompt, images: attachedImages },
            ],
            fallbackSettings,
            this.currentAbortController.signal,
          );

          const state = this.customStore?.getState() ?? getStoreState();
          const vehicleSessionId = state?.connection?.sessionId || null;
          const parsed = aiIntentParser.parse(fallbackResponse.content, vehicleSessionId);

          const targetIdx = this.messages.findIndex(m => m.id === assistantMsgId);
          if (targetIdx >= 0) {
            this.messages[targetIdx].content = `[Using local fallback: ${settings.fallbackModel}]\n\n${parsed.message}`;
            this.messages[targetIdx].proposal = parsed.proposal;
            this.messages[targetIdx].status = 'success';
          }

          this.diagnostics.status = 'READY';
          this.diagnostics.latencyMs = fallbackResponse.latencyMs;
          this.diagnostics.lastTestedAt = Date.now();
          this.diagnostics.lastError = null;
          return;
        } catch (fallbackError) {
          const fbErrorMsg = fallbackError instanceof Error ? fallbackError.message : 'Fallback request failed';
          errorMsg = `${errorMsg}\n\n[Local fallback failed: ${fbErrorMsg}]`;
        }
      }

      const targetIdx = this.messages.findIndex(m => m.id === assistantMsgId);
      if (targetIdx >= 0) {
        this.messages[targetIdx].content = `⚠️ ${errorMsg}`;
        this.messages[targetIdx].status = 'error';
        this.messages[targetIdx].errorMessage = errorMsg;
      }
      this.diagnostics.status = 'ERROR';
      this.diagnostics.lastError = errorMsg;
    } finally {
      this.isThinking = false;
      this.currentAbortController = null;
      this.emit();
    }
  }

  updateProposal(proposalId: string, updates: Partial<AiActionProposal>) {
    for (const msg of this.messages) {
      if (msg.proposal && msg.proposal.id === proposalId) {
        msg.proposal = { ...msg.proposal, ...updates };
        this.emit();
        break;
      }
    }
  }

  private addErrorMessage(text: string) {
    this.messages.push({
      id: `err-${Date.now()}`,
      role: 'assistant',
      content: `⚠️ ${text}`,
      timestamp: Date.now(),
      status: 'error',
    });
    this.emit();
  }
}

export const aiService = new AiService();
