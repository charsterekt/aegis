/**
 * Mnemosyne store — persistent JSONL append/read for project learnings.
 *
 * SPECv2 §4.4 and §14: `.aegis/mnemosyne.jsonl` stores learned codebase facts
 * such as conventions, patterns, and known local failure modes. It does NOT
 * track agent crashes, retries, or budget kills.
 *
 * Truth planes:
 * - Beads owns task truth
 * - dispatch-state.json owns orchestration truth
 * - mnemosyne.jsonl owns learned project knowledge
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ---------------------------------------------------------------------------
// Learning record model
// ---------------------------------------------------------------------------

/** Canonical learning categories. SPECv2 §14.2. */
export type LearningCategory = "convention" | "pattern" | "failure";

/** Source of the learning — agent caste or human. */
export type LearningSource = "oracle" | "titan" | "sentinel" | "janus" | "human" | "system";

/**
 * A single learning record stored in Mnemosyne.
 *
 * Fields per SPECv2 §14.2–§14.4:
 * - category: convention, pattern, or failure
 * - content: the learned fact itself
 * - domain: keyword or domain tag for retrieval matching
 * - source: which caste or human produced this learning
 * - issueId: originating Beads issue (when applicable)
 * - timestamp: ISO-8601 when the learning was recorded
 * - id: unique identifier for the record
 */
export interface LearningRecord {
  /** Unique identifier for this learning record. */
  id: string;

  /** Category: convention, pattern, or failure. */
  category: LearningCategory;

  /** The learned fact or observation. */
  content: string;

  /** Domain or keyword tag for retrieval matching. */
  domain: string;

  /** Which caste or human produced this learning. */
  source: LearningSource;

  /** Originating Beads issue identifier, when applicable. */
  issueId: string | null;

  /** ISO-8601 timestamp when this learning was recorded. */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Valid learning categories per SPECv2 §14.2. */
const VALID_CATEGORIES: Set<LearningCategory> = new Set(["convention", "pattern", "failure"]);

/** Valid learning sources. */
const VALID_SOURCES: Set<LearningSource> = new Set(["oracle", "titan", "sentinel", "janus", "human", "system"]);

/**
 * Validate that a learning record has all required fields and legal values.
 * Returns true if the record is valid, or an error string describing the issue.
 */
export function validateLearning(input: unknown): true | string {
  if (input === null || typeof input !== "object") {
    return "learning record must be a non-null object";
  }

  const rec = input as Record<string, unknown>;

  // Required fields
  const required = ["id", "category", "content", "domain", "source", "timestamp"];
  for (const field of required) {
    if (!(field in rec)) {
      return `missing required field: ${field}`;
    }
  }

  // Type checks
  if (typeof rec.id !== "string" || rec.id.trim() === "") {
    return "id must be a non-empty string";
  }
  if (typeof rec.category !== "string") {
    return "category must be a string";
  }
  if (!VALID_CATEGORIES.has(rec.category as LearningCategory)) {
    return `invalid category "${rec.category}"; must be one of: ${[...VALID_CATEGORIES].join(", ")}`;
  }
  if (typeof rec.content !== "string" || rec.content.trim() === "") {
    return "content must be a non-empty string";
  }
  if (typeof rec.domain !== "string" || rec.domain.trim() === "") {
    return "domain must be a non-empty string";
  }
  if (typeof rec.source !== "string") {
    return "source must be a string";
  }
  if (!VALID_SOURCES.has(rec.source as LearningSource)) {
    return `invalid source "${rec.source}"; must be one of: ${[...VALID_SOURCES].join(", ")}`;
  }
  if (typeof rec.timestamp !== "string") {
    return "timestamp must be a string";
  }

  // issueId is optional but must be string or null when present
  if ("issueId" in rec && rec.issueId !== null && typeof rec.issueId !== "string") {
    return "issueId must be a string or null";
  }

  return true;
}

// ---------------------------------------------------------------------------
// Write path — append-only, atomic per record
// ---------------------------------------------------------------------------

/**
 * Append a single learning record to the Mnemosyne JSONL file.
 *
 * The orchestrator enriches the record with source, issue, timestamp, and ID
 * before appending (SPECv2 §14.4). This function assumes the record is already
 * enriched and validated.
 *
 * @param filePath - absolute path to the mnemosyne.jsonl file
 * @param record - validated learning record to append
 */
export function appendLearning(filePath: string, record: LearningRecord): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Append as a single JSON line — JSONL format
  const line = JSON.stringify(record) + "\n";
  appendFileSync(filePath, line, { encoding: "utf-8" });
}

// ---------------------------------------------------------------------------
// Read path — load all records from JSONL
// ---------------------------------------------------------------------------

/**
 * Load all learning records from the Mnemosyne JSONL file.
 *
 * @param filePath - absolute path to the mnemosyne.jsonl file
 * @returns array of valid learning records; skips malformed lines silently
 */
export function loadLearnings(filePath: string): LearningRecord[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");
  const records: LearningRecord[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (validateLearning(parsed) === true) {
        records.push(parsed);
      }
      // Silently skip malformed lines per SPECv2 resilience requirements
    } catch {
      // Skip lines that are not valid JSON
    }
  }

  return records;
}

/**
 * Get the current record count in the Mnemosyne store.
 */
export function getRecordCount(filePath: string): number {
  return loadLearnings(filePath).length;
}
