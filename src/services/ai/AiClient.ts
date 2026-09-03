import type { AiSettings } from '../../settings/types/ai';
import type { AiTestResult } from './AiTypes';
import { getModelMetadata } from '../../settings/defaults/ai';

export interface ChatRequestMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

export interface ChatResponse {
  content: string;
  latencyMs: number;
}

export interface IAiClient {
  healthCheck(settings: AiSettings): Promise<AiTestResult>;
  chat(messages: ChatRequestMessage[], settings: AiSettings, signal?: AbortSignal): Promise<ChatResponse>;
}

export class OllamaClient implements IAiClient {
  private formatBaseUrl(host: string, port: number): string {
    let cleanHost = host.trim();
    if (!cleanHost) cleanHost = '127.0.0.1';
    
    // Support if user entered full http:// or just IP
    if (!cleanHost.startsWith('http://') && !cleanHost.startsWith('https://')) {
      cleanHost = `http://${cleanHost}`;
    }
    
    // Remove trailing slash
    cleanHost = cleanHost.replace(/\/+$/, '');
    
    // Check if port is already in host
    const hasPort = /:\d+$/.test(cleanHost);
    if (!hasPort && port) {
      return `${cleanHost}:${port}`;
    }
    return cleanHost;
  }

  async healthCheck(settings: AiSettings): Promise<AiTestResult> {
    const startTime = Date.now();
    const baseUrl = this.formatBaseUrl(settings.host, settings.port);
    const metadata = getModelMetadata(settings.model);
    const execution = metadata.execution;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(settings.timeoutMs, 12000));

    try {
      // 1. Verify Ollama endpoint reachability
      const tagsResponse = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      if (!tagsResponse.ok) {
        clearTimeout(timeoutId);
        return {
          success: false,
          latencyMs: Date.now() - startTime,
          model: settings.model,
          provider: 'OLLAMA',
          execution,
          errorMessage: `Ollama server returned HTTP ${tagsResponse.status}: ${tagsResponse.statusText}`,
        };
      }

      // 2. Perform minimal ping to verify model readiness & cloud authentication
      const pingResponse = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          model: settings.model.trim(),
          messages: [{ role: 'user', content: 'ping' }],
          stream: false,
          options: {
            num_predict: 1,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!pingResponse.ok) {
        const errorText = await pingResponse.text().catch(() => '');
        const lower = errorText.toLowerCase();

        let errorMsg = `Ollama HTTP ${pingResponse.status}`;

        if (pingResponse.status === 401 || lower.includes('sign in') || lower.includes('signin') || lower.includes('auth') || lower.includes('unauthorized')) {
          errorMsg = 'OLLAMA CLOUD AUTH REQUIRED: Run "ollama signin" on your PC.';
        } else if (pingResponse.status === 404 || lower.includes('not found') || lower.includes('unknown model')) {
          errorMsg = execution === 'CLOUD'
            ? `CLOUD MODEL UNAVAILABLE: Model '${settings.model}' not found in Ollama Cloud. Run "ollama run ${settings.model}" on PC.`
            : `LOCAL MODEL UNAVAILABLE: Model '${settings.model}' not found. Run "ollama pull ${settings.model}" on PC.`;
        } else if (lower.includes('network') || lower.includes('enotfound') || lower.includes('dial') || lower.includes('connect') || lower.includes('timeout')) {
          errorMsg = execution === 'CLOUD'
            ? 'INTERNET / CLOUD CONNECTION FAILED: Check PC internet connection and Ollama Cloud status.'
            : `Cannot connect to model: ${errorText || pingResponse.statusText}`;
        } else if (errorText) {
          errorMsg = `${errorMsg}: ${errorText}`;
        }

        return {
          success: false,
          latencyMs,
          model: settings.model,
          provider: 'OLLAMA',
          execution,
          errorMessage: errorMsg,
        };
      }

      return {
        success: true,
        latencyMs,
        model: settings.model,
        provider: 'OLLAMA',
        execution,
        serverVersion: 'Connected',
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      let errorMsg = 'Cannot reach AI server';

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMsg = execution === 'CLOUD'
            ? `Cloud model connection timed out after ${Math.min(settings.timeoutMs, 12000)}ms. Check PC internet / Tailscale.`
            : `Connection timed out after ${Math.min(settings.timeoutMs, 12000)}ms. Check IP / Wi-Fi / Tailscale.`;
        } else if (error.message.includes('Network request failed') || error.message.includes('Failed to fetch')) {
          errorMsg = `Cannot connect to ${baseUrl}. Verify Ollama is running (OLLAMA_HOST=0.0.0.0:11434) & check firewall.`;
        } else {
          errorMsg = error.message;
        }
      }

      return {
        success: false,
        latencyMs,
        model: settings.model,
        provider: 'OLLAMA',
        execution,
        errorMessage: errorMsg,
      };
    }
  }

  async chat(messages: ChatRequestMessage[], settings: AiSettings, signal?: AbortSignal): Promise<ChatResponse> {
    const startTime = Date.now();
    const baseUrl = this.formatBaseUrl(settings.host, settings.port);
    const metadata = getModelMetadata(settings.model);
    const isCloud = metadata.execution === 'CLOUD';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), settings.timeoutMs || 30000);

    const combinedSignal = signal ? this.combineSignals(signal, controller.signal) : controller.signal;

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          model: settings.model.trim(),
          messages: messages.map(m => {
            const item: any = {
              role: m.role,
              content: m.content,
            };
            if (m.images && m.images.length > 0) {
              item.images = m.images;
            }
            return item;
          }),
          stream: false,
          options: {
            temperature: 0.3, // Lower temperature for accurate flight diagnostics
          },
        }),
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const lower = errorText.toLowerCase();

        if (response.status === 401 || lower.includes('sign in') || lower.includes('signin') || lower.includes('auth') || lower.includes('unauthorized')) {
          throw new Error('OLLAMA CLOUD AUTH REQUIRED: Please run "ollama signin" on your PC.');
        }
        if (response.status === 404 || lower.includes('not found') || lower.includes('unknown model')) {
          throw new Error(isCloud
            ? `CLOUD MODEL UNAVAILABLE: Model '${settings.model}' not found in Ollama Cloud.`
            : `LOCAL MODEL UNAVAILABLE: Model '${settings.model}' not found on PC.`
          );
        }
        if (lower.includes('network') || lower.includes('enotfound') || lower.includes('dial') || lower.includes('connect')) {
          throw new Error('INTERNET / CLOUD CONNECTION FAILED: Check PC internet connection.');
        }

        throw new Error(`Ollama HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      const content = data?.message?.content;

      if (typeof content !== 'string') {
        throw new Error('Invalid response structure received from Ollama API.');
      }

      return {
        content: content.trim(),
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          if (signal?.aborted) {
            throw new Error('Request was canceled by user.');
          }
          throw new Error(`AI request timed out after ${(settings.timeoutMs / 1000).toFixed(0)}s.`);
        }
        if (error.message.includes('Network request failed') || error.message.includes('Failed to fetch')) {
          throw new Error(`Cannot reach Ollama at ${baseUrl}. Ensure PC is on same Wi-Fi/Tailscale.`);
        }
      }
      throw error;
    }
  }

  private combineSignals(s1: AbortSignal, s2: AbortSignal): AbortSignal {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (s1.aborted || s2.aborted) {
      controller.abort();
    } else {
      s1.addEventListener('abort', abort, { once: true });
      s2.addEventListener('abort', abort, { once: true });
    }
    return controller.signal;
  }
}

export const aiClient: IAiClient = new OllamaClient();
