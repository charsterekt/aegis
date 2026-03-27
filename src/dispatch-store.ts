// src/dispatch-store.ts
// Dispatch store — sole owner of .aegis/dispatch-state.json.
// Only this module may read or write that file (SPEC §5.3).

import { writeFileSync, readFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { DispatchRecord, DispatchStage } from "./types.js";

const DISPATCH_STATE_FILE = ".aegis/dispatch-state.json";

// Module-level state — reset by load()
let store = new Map<string, DispatchRecord>();
let root = process.cwd();

function filePath(): string {
  return join(root, DISPATCH_STATE_FILE);
}

function defaultRecord(issueId: string, now: number): DispatchRecord {
  return {
    issue_id: issueId,
    stage: "pending",
    oracle_assessment: null,
    sentinel_verdict: null,
    failure_count: 0,
    last_failure_at: null,
    current_agent_id: null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Load dispatch state from disk. Resets module-level store.
 * Call once on orchestrator startup with the project root directory.
 * If the file does not exist, starts with an empty store.
 * If the file is corrupt, logs a warning and starts with an empty store.
 */
export function load(projectRoot: string): void {
  root = projectRoot;
  const fp = filePath();
  if (!existsSync(fp)) {
    store = new Map();
    return;
  }
  try {
    const raw = JSON.parse(readFileSync(fp, "utf8")) as unknown;
    if (!Array.isArray(raw)) {
      store = new Map();
      return;
    }
    store = new Map(
      (raw as DispatchRecord[]).map((rec) => [rec.issue_id, rec])
    );
  } catch {
    console.warn("dispatch-store: corrupt state file — starting fresh");
    store = new Map();
  }
}

/**
 * Atomically persist the current in-memory store to disk.
 * Writes to .tmp file first, then renames over target (same-directory
 * rename is atomic on POSIX and Windows NTFS — see SPEC §5.2).
 */
export function save(): void {
  const fp = filePath();
  const tmp = fp + ".tmp";
  mkdirSync(dirname(fp), { recursive: true });
  writeFileSync(tmp, JSON.stringify(Array.from(store.values()), null, 2), "utf8");
  renameSync(tmp, fp);
}

/** Return a single DispatchRecord by issue ID, or undefined if not found. */
export function get(issueId: string): DispatchRecord | undefined {
  return store.get(issueId);
}

/** Upsert a record and persist. */
export function set(issueId: string, record: DispatchRecord): void {
  store.set(issueId, record);
  save();
}

/**
 * Transition an issue to a new stage, optionally merging additional fields.
 * Creates a default record if none exists. Persists after every call.
 */
export function transition(
  issueId: string,
  newStage: DispatchStage,
  data?: Partial<DispatchRecord>
): void {
  const now = Date.now();
  const existing = store.get(issueId);
  store.set(issueId, {
    ...(existing ?? defaultRecord(issueId, now)),
    ...data,
    stage: newStage,
    updated_at: now,
  });
  save();
}

/** Increment failure_count and record the timestamp. Persists after call. */
export function recordFailure(issueId: string): void {
  const rec = store.get(issueId);
  if (!rec) return;
  store.set(issueId, {
    ...rec,
    failure_count: rec.failure_count + 1,
    last_failure_at: Date.now(),
    updated_at: Date.now(),
  });
  save();
}

/** Reset failure tracking on successful agent completion. Persists after call. */
export function resetFailures(issueId: string): void {
  const rec = store.get(issueId);
  if (!rec) return;
  store.set(issueId, {
    ...rec,
    failure_count: 0,
    last_failure_at: null,
    updated_at: Date.now(),
  });
  save();
}

/** Return all DispatchRecords as an array (for triage loop and crash recovery). */
export function all(): DispatchRecord[] {
  return Array.from(store.values());
}
