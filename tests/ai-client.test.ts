import test from 'node:test';
import assert from 'node:assert/strict';
import { OllamaClient } from '../src/services/ai/AiClient';
import type { AiSettings } from '../src/settings/types/ai';

const localSettings: AiSettings = {
  enabled: true,
  provider: 'OLLAMA',
  host: '100.64.0.10',
  port: 11434,
  model: 'qwen3.5:9b',
  timeoutMs: 5000,
  autoConnect: true,
  enableFallback: false,
  fallbackModel: 'qwen3.5:9b',
};

const cloudSettings: AiSettings = {
  enabled: true,
  provider: 'OLLAMA',
  host: '100.64.0.10',
  port: 11434,
  model: 'gemma4:31b-cloud',
  timeoutMs: 5000,
  autoConnect: true,
  enableFallback: true,
  fallbackModel: 'qwen3.5:9b',
};

test('OllamaClient formats Base URL correctly with Wi-Fi and Tailscale addresses', () => {
  const client = new OllamaClient();
  const formatUrl = (client as any).formatBaseUrl.bind(client);

  assert.equal(formatUrl('192.168.1.100', 11434), 'http://192.168.1.100:11434');
  assert.equal(formatUrl('100.64.0.10', 11434), 'http://100.64.0.10:11434');
  assert.equal(formatUrl('http://100.64.0.10:11434/', 11434), 'http://100.64.0.10:11434');
  assert.equal(formatUrl('localhost', 11434), 'http://localhost:11434');
});

test('OllamaClient healthCheck succeeds for LOCAL model (qwen3.5:9b)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any) => {
    const urlStr = String(url);
    if (urlStr.endsWith('/api/tags')) {
      return {
        ok: true,
        json: async () => ({
          models: [{ name: 'qwen3.5:9b' }],
        }),
      } as any;
    }
    if (urlStr.endsWith('/api/chat')) {
      return {
        ok: true,
        json: async () => ({ message: { content: 'pong' } }),
      } as any;
    }
    throw new Error('Unexpected URL: ' + urlStr);
  };

  try {
    const client = new OllamaClient();
    const result = await client.healthCheck(localSettings);

    assert.equal(result.success, true);
    assert.equal(result.model, 'qwen3.5:9b');
    assert.equal(result.execution, 'LOCAL');
    assert.equal(result.errorMessage, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OllamaClient healthCheck succeeds for CLOUD model (gemma4:31b-cloud)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any) => {
    const urlStr = String(url);
    if (urlStr.endsWith('/api/tags')) {
      return {
        ok: true,
        json: async () => ({ models: [] }),
      } as any;
    }
    if (urlStr.endsWith('/api/chat')) {
      return {
        ok: true,
        json: async () => ({ message: { content: 'pong' } }),
      } as any;
    }
    throw new Error('Unexpected URL: ' + urlStr);
  };

  try {
    const client = new OllamaClient();
    const result = await client.healthCheck(cloudSettings);

    assert.equal(result.success, true);
    assert.equal(result.model, 'gemma4:31b-cloud');
    assert.equal(result.execution, 'CLOUD');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OllamaClient healthCheck reports OLLAMA CLOUD AUTH REQUIRED on 401 or signin error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any) => {
    const urlStr = String(url);
    if (urlStr.endsWith('/api/tags')) {
      return { ok: true, json: async () => ({ models: [] }) } as any;
    }
    if (urlStr.endsWith('/api/chat')) {
      return {
        ok: false,
        status: 401,
        text: async () => 'Please sign in with "ollama signin" to use cloud models',
      } as any;
    }
    throw new Error('Unexpected URL');
  };

  try {
    const client = new OllamaClient();
    const result = await client.healthCheck(cloudSettings);

    assert.equal(result.success, false);
    assert.ok(result.errorMessage?.includes('OLLAMA CLOUD AUTH REQUIRED'));
    assert.equal(result.execution, 'CLOUD');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OllamaClient healthCheck reports INTERNET / CLOUD CONNECTION FAILED on network failure to cloud', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any) => {
    const urlStr = String(url);
    if (urlStr.endsWith('/api/tags')) {
      return { ok: true, json: async () => ({ models: [] }) } as any;
    }
    if (urlStr.endsWith('/api/chat')) {
      return {
        ok: false,
        status: 502,
        text: async () => 'dial tcp: lookup cloud.ollama.com: no such host (network unreachable)',
      } as any;
    }
    throw new Error('Unexpected URL');
  };

  try {
    const client = new OllamaClient();
    const result = await client.healthCheck(cloudSettings);

    assert.equal(result.success, false);
    assert.ok(result.errorMessage?.includes('INTERNET / CLOUD CONNECTION FAILED'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OllamaClient chat parses response content correctly for cloud model', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: any, options: any) => {
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'gemma4:31b-cloud');

    return {
      ok: true,
      json: async () => ({
        model: 'gemma4:31b-cloud',
        message: {
          role: 'assistant',
          content: '✓ Preflight telemetry verified by Gemma 4. Battery at 92%. Ready.',
        },
      }),
    } as any;
  };

  try {
    const client = new OllamaClient();
    const response = await client.chat(
      [
        { role: 'system', content: 'You are ANITECH copilot.' },
        { role: 'user', content: 'Check status.' },
      ],
      cloudSettings
    );

    assert.ok(response.content.includes('Gemma 4'));
    assert.ok(response.latencyMs >= 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
