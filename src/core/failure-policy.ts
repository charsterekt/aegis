const PHASE_D_FAILURE_COOLDOWN_MS = 30_000;

export function calculateFailureCooldown(timestamp: string) {
  const timestampMs = Date.parse(timestamp);
  const baseMs = Number.isFinite(timestampMs) ? timestampMs : Date.now();
  return new Date(baseMs + PHASE_D_FAILURE_COOLDOWN_MS).toISOString();
}

export function resolveFailureWindowStartMs(timestamp: string) {
  const timestampMs = Date.parse(timestamp);
  return Number.isFinite(timestampMs) ? timestampMs : Date.now();
}
