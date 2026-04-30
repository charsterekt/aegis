import { renameSync } from "node:fs";

export interface RenameWithRetriesOptions {
  rename?: typeof renameSync;
  sleepMs?: (milliseconds: number) => void;
  maxAttempts?: number;
  baseDelayMs?: number;
}

function sleepSync(milliseconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function isRetryableRenameError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  const code = String((error as NodeJS.ErrnoException).code);
  return code === "EPERM" || code === "EBUSY" || code === "ENOTEMPTY";
}

export function renameWithRetries(
  temporaryPath: string,
  finalPath: string,
  options: RenameWithRetriesOptions = {},
) {
  const rename = options.rename ?? renameSync;
  const sleepMs = options.sleepMs ?? sleepSync;
  const maxAttempts = options.maxAttempts ?? 6;
  const baseDelayMs = options.baseDelayMs ?? 25;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      rename(temporaryPath, finalPath);
      return;
    } catch (error) {
      if (!isRetryableRenameError(error) || attempt === maxAttempts) {
        throw error;
      }
      sleepMs(baseDelayMs * attempt);
    }
  }
}
