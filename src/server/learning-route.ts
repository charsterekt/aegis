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
import { randomUUID } from "node:crypto";
import {
  appendLearning,
  loadLearnings,
  replaceLearningsAtomically,
  isLearningCategory,
  isLearningSource,
  validateLearning,
  type LearningRecord,
} from "../memory/mnemosyne-store.js";
import { pruneLearnings } from "../memory/lethe.js";

// ---------------------------------------------------------------------------
// Learning record enrichment
// ---------------------------------------------------------------------------

type EnrichedLearningResult =
  | { ok: true; record: LearningRecord }
  | { ok: false; error: string };

function readOptionalStringField(
  input: Record<string, unknown>,
  fieldName: string,
  defaultValue: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (!(fieldName in input) || input[fieldName] === undefined) {
    return { ok: true, value: defaultValue };
  }

  if (typeof input[fieldName] !== "string") {
    return { ok: false, error: `${fieldName} must be a string when provided` };
  }

  return { ok: true, value: input[fieldName] };
}

function readOptionalIssueIdField(
  input: Record<string, unknown>,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (!("issueId" in input) || input.issueId === undefined) {
    return { ok: true, value: null };
  }

  if (input.issueId === null || typeof input.issueId === "string") {
    return { ok: true, value: input.issueId };
  }

  return { ok: false, error: "issueId must be a string or null when provided" };
}

/**
 * Enrich a raw learning input from the API into a full LearningRecord.
 *
 * The orchestrator enriches the record with source, issue, timestamp, and ID
 * before appending (SPECv2 §14.4).
 */
function enrichLearningInput(
  input: Record<string, unknown>,
): EnrichedLearningResult {
  const categoryField = readOptionalStringField(input, "category", "convention");
  if (!categoryField.ok) {
    return categoryField;
  }
  if (!isLearningCategory(categoryField.value)) {
    return {
      ok: false,
      error: `invalid category "${categoryField.value}"; must be one of: convention, pattern, failure`,
    };
  }

  const contentField = readOptionalStringField(input, "content", "");
  if (!contentField.ok) {
    return contentField;
  }

  const domainField = readOptionalStringField(input, "domain", "general");
  if (!domainField.ok) {
    return domainField;
  }

  const sourceField = readOptionalStringField(input, "source", "human");
  if (!sourceField.ok) {
    return sourceField;
  }
  if (!isLearningSource(sourceField.value)) {
    return {
      ok: false,
      error: `invalid source "${sourceField.value}"; must be one of: oracle, titan, sentinel, janus, human, system`,
    };
  }

  const issueIdField = readOptionalIssueIdField(input);
  if (!issueIdField.ok) {
    return issueIdField;
  }

  return {
    ok: true,
    record: {
      id: `learn-${randomUUID()}`,
      category: categoryField.value,
      content: contentField.value,
      domain: domainField.value,
      source: sourceField.value,
      issueId: issueIdField.value,
      timestamp: new Date().toISOString(),
    },
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
  config: { max_records: number },
): { ok: boolean; recorded_at?: string; id?: string; error?: string; pruned?: number } {
  const enriched = enrichLearningInput(entry);
  if (!enriched.ok) {
    return { ok: false, error: enriched.error };
  }
  const { record } = enriched;
  const validation = validateLearning(record);
  if (validation !== true) {
    return { ok: false, error: validation };
  }

  const existingLearnings = loadLearnings(mnemosynePath);
  let prunedCount = 0;

  if (existingLearnings.length + 1 > config.max_records) {
    const { remaining, pruned } = pruneLearnings(
      [...existingLearnings, record],
      config.max_records,
    );
    prunedCount = pruned.length;
    replaceLearningsAtomically(mnemosynePath, remaining);
  } else {
    appendLearning(mnemosynePath, record);
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
