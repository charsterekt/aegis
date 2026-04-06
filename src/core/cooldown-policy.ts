/**
 * S10 — CooldownPolicy.
 *
 * Defines the cooldown rules for suppressing re-dispatch after repeated agent
 * failures.  SPECv2 §6.4 and §6.5:
 *   - three consecutive agent failures inside a ten-minute window trigger cooldown
 *   - cooldown suppresses immediate re-dispatch
 *   - cooldown state is persisted (in DispatchRecord.cooldownUntil)
 *   - manual restart by the user can override cooldown
 *
 * This module owns the decision logic only — no I/O.
 */

export const COOLDOWN_FAILURE_THRESHOLD = 3;
export const COOLDOWN_WINDOW_MS = 10 * 60 * 1000;
export const COOLDOWN_SUPPRESSION_MS = 30 * 60 * 1000;

export interface FailureRecord {
  timestamp: string;
  caste: string;
  reason: string;
}

export function shouldTriggerCooldown(
  consecutiveFailures: number,
  failureWindowStartMs: number | null,
  nowMs: number = Date.now(),
): boolean {
  if (consecutiveFailures < COOLDOWN_FAILURE_THRESHOLD) {
    return false;
  }
  if (failureWindowStartMs === null) {
    return true;
  }
  return (nowMs - failureWindowStartMs) <= COOLDOWN_WINDOW_MS;
}

export function computeCooldownUntil(nowMs: number = Date.now()): string {
  return new Date(nowMs + COOLDOWN_SUPPRESSION_MS).toISOString();
}

export function isInCooldown(
  cooldownUntil: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (cooldownUntil === null) {
    return false;
  }
  return nowMs < new Date(cooldownUntil).getTime();
}

export function canRedispatch(
  consecutiveFailures: number,
  cooldownUntil: string | null,
  overrideCooldown: boolean = false,
  nowMs: number = Date.now(),
): boolean {
  if (overrideCooldown) {
    return true;
  }
  if (isInCooldown(cooldownUntil, nowMs)) {
    return false;
  }
  if (consecutiveFailures >= COOLDOWN_FAILURE_THRESHOLD) {
    return false;
  }
  return true;
}

export function recordFailure(
  consecutiveFailures: number,
  failureWindowStartMs: number | null,
  nowMs: number = Date.now(),
): [number, number | null] {
  const newCount = consecutiveFailures + 1;
  const newWindowStart = failureWindowStartMs ?? nowMs;

  if (
    failureWindowStartMs !== null &&
    (nowMs - failureWindowStartMs) > COOLDOWN_WINDOW_MS
  ) {
    return [1, nowMs];
  }

  return [newCount, newWindowStart];
}

export function resetFailures(): [number, null] {
  return [0, null];
}
