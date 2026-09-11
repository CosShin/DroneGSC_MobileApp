import type { DroneCommand } from '../../types/command';

/**
 * Command retry classification.
 *
 * Safety-critical commands (ARM, TAKEOFF, LAND, RTL, DISARM, SET_MODE)
 * must NOT be retried automatically — each attempt may cause physical
 * vehicle action. Read-only or parameter requests may be retried.
 *
 * This module does NOT perform retries. It only classifies whether a
 * given command MAY be retried, and with what limits. The caller
 * (SafetyLayer or UI) decides whether to actually retry.
 */

export type RetryCategory = 'NEVER' | 'CAUTIOUS' | 'SAFE';

export interface RetryPolicy {
  /** Whether retry is allowed at all. */
  category: RetryCategory;
  /** Maximum number of retry attempts (0 = no retry). */
  maxRetries: number;
  /** Base timeout waiting for COMMAND_ACK before considering it lost. */
  ackTimeoutMs: number;
  /** Delay between retries (if allowed). */
  retryDelayMs: number;
}

/**
 * Map of command types to their retry policies.
 *
 * NEVER:    Flight-affecting commands that must not be auto-retried.
 * CAUTIOUS: Commands that may be retried once with user awareness.
 * SAFE:     Read-only requests that can be retried transparently.
 */
const RETRY_POLICIES: Record<DroneCommand['type'], RetryPolicy> = {
  ARM:      { category: 'NEVER',    maxRetries: 0, ackTimeoutMs: 3_000, retryDelayMs: 0 },
  DISARM:   { category: 'NEVER',    maxRetries: 0, ackTimeoutMs: 3_000, retryDelayMs: 0 },
  TAKEOFF:  { category: 'NEVER',    maxRetries: 0, ackTimeoutMs: 5_000, retryDelayMs: 0 },
  LAND:     { category: 'NEVER',    maxRetries: 0, ackTimeoutMs: 5_000, retryDelayMs: 0 },
  RTL:      { category: 'NEVER',    maxRetries: 0, ackTimeoutMs: 3_000, retryDelayMs: 0 },
  SET_MODE: { category: 'CAUTIOUS', maxRetries: 1, ackTimeoutMs: 3_000, retryDelayMs: 500 },
  SET_HOME: { category: 'CAUTIOUS', maxRetries: 1, ackTimeoutMs: 3_000, retryDelayMs: 500 },
};

/**
 * Retrieve the retry policy for a command type.
 * Returns NEVER for any unrecognised command.
 */
export function getRetryPolicy(commandType: DroneCommand['type']): RetryPolicy {
  return RETRY_POLICIES[commandType] ?? {
    category: 'NEVER',
    maxRetries: 0,
    ackTimeoutMs: 3_000,
    retryDelayMs: 0,
  };
}

/**
 * Check whether a command type permits automatic retry.
 */
export function isRetryAllowed(commandType: DroneCommand['type']): boolean {
  const policy = getRetryPolicy(commandType);
  return policy.category !== 'NEVER' && policy.maxRetries > 0;
}

/**
 * Policy for read-only telemetry/parameter requests (REQUEST_MESSAGE, etc).
 * These are safe to retry transparently.
 */
export const READ_REQUEST_POLICY: RetryPolicy = {
  category: 'SAFE',
  maxRetries: 3,
  ackTimeoutMs: 2_000,
  retryDelayMs: 300,
};
