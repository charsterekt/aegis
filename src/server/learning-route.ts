/**
 * Learning route handler — server-side write path for Mnemosyne.
 *
 * SPECv2 §14.4: Agents and humans can add learnings through the orchestrator
 * endpoint. The orchestrator enriches the record with source, issue, timestamp,
 * and ID before appending.
 *
 * SPECv2 §14.5: Lethe pruning runs when the configured record budget is exceeded.
 */

import { resolve } from "node:path";
import {
  appendLearning,
  loadLearnings,
  validateLearning,
  type LearningRecord,
  type LearningCategory,
  type LearningSource,
} from "../memory/mnemosyne-store.js";
import { pruneLearnings } from "../memory/lethe.js";
import type { AegisConfig } from "../config/schema.js";
import { readFileSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Learning record enrichment
// ---------------------------------------------------------------------------

/** Global counter for ID generation within this process. */
let nextLearningId = 1;

/**
 * Enrich a raw learning input from the API into a full LearningRecord.
 *
 * The orchestrator enriches the record with source, issue, timestamp, and ID
 * before appending (SPECv2 §14.4).
 */
function enrichLearningInput(
  input: Record<string, unknown>,
): LearningRecord {
  const category = (input.category ?? "convention") as LearningCategory;
  const source = (input.source ?? "human") as LearningSource;

  return {
    id: `learn-${Date.now()}-${nextLearningId++}`,
    category,
    content: (input.content ?? "") as string,
    domain: (input.domain ?? "general") as string,
    source,
    issueId: (input.issueId as string | null) ?? null,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * Handle a POST /api/learning request.
 *
 * 1. Enrich the input into a LearningRecord
 * 2. Validate the record
 * 3. Append to the Mnemosyne JSONL file
 * 4. Run Lethe pruning if the record count exceeds the configured budget
 * 5. Persist the pruned result back to the JSONL file
 *
 * @param entry - raw JSON body from the HTTP request
 * @param mnemosynePath - absolute path to the mnemosyne.jsonl file
 * @param config - the Mnemosyne config section
 * @returns result object with ok status and metadata
 */
export function handleAppendLearning(
  entry: Record<string, unknown>,
  mnemosynePath: string,
  config: { max_records: number; prompt_token_budget: number },
): { ok: boolean; recorded_at?: string; id?: string; error?: string; pruned?: number } {
  // Enrich
  const record = enrichLearningInput(entry);

  // Validate
  const validation = validateLearning(record);
  if (validation !== true) {
    return { ok: false, error: validation };
  }

  // Append
  appendLearning(mnemosynePath, record);

  // Prune if needed
  let prunedCount = 0;
  const learnings = loadLearnings(mnemosynePath);
  if (learnings.length > config.max_records) {
    const { remaining, pruned } = pruneLearnings(learnings, config.max_records);
    prunedCount = pruned.length;

    // Persist the pruned result (rewrite the file with only remaining records)
    const content = remaining.map((r) => JSON.stringify(r)).join("\n") + "\n";
    writeFileSync(mnemosynePath, content, { encoding: "utf-8" });
  }

  return {
    ok: true,
    recorded_at: record.timestamp,
    id: record.id,
    pruned: prunedCount > 0 ? prunedCount : undefined,
  };
}

/**
 * Resolve the Mnemosyne JSONL path from the project root.
 */
export function resolveMnemosynePath(root: string): string {
  return resolve(root, ".aegis", "mnemosyne.jsonl");
}
