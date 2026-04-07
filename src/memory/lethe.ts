/**
 * Lethe — pruning mechanism for Mnemosyne.
 *
 * SPECv2 §14.5: Lethe prunes Mnemosyne when the configured record budget is exceeded.
 *
 * Canonical policy:
 * - prune oldest records first
 * - keep convention records longer than ordinary items
 * - prune during REAP to avoid a separate maintenance daemon
 */

import type { LearningRecord } from "./mnemosyne-store.js";

// ---------------------------------------------------------------------------
// Pruning policy
// ---------------------------------------------------------------------------

/**
 * Compute which records to prune from the Mnemosyne store.
 *
 * Policy per SPECv2 §14.5:
 * 1. If record count <= max_records, nothing to prune.
 * 2. Otherwise, prune oldest records first.
 * 3. Convention records are kept longer: only prune them after all non-convention
 *    records have been pruned and we still exceed the limit.
 *
 * @param learnings - all current learning records, sorted by timestamp ascending
 * @param maxRecords - the configured maximum record budget
 * @returns array of records that should be pruned (oldest first)
 */
export function computePruneSet(
  learnings: LearningRecord[],
  maxRecords: number,
): LearningRecord[] {
  if (maxRecords <= 0) {
    // If budget is zero, everything gets pruned
    return [...learnings].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  const excess = learnings.length - maxRecords;
  if (excess <= 0) {
    return [];
  }

  // Sort oldest-first for pruning
  const sorted = [...learnings].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Phase 1: Prune non-convention records first
  const nonConvention: LearningRecord[] = [];
  const conventions: LearningRecord[] = [];

  for (const record of sorted) {
    if (record.category === "convention") {
      conventions.push(record);
    } else {
      nonConvention.push(record);
    }
  }

  const toPrune: LearningRecord[] = [];

  // Take from non-convention first
  for (const record of nonConvention) {
    if (toPrune.length >= excess) break;
    toPrune.push(record);
  }

  // If still need more, prune conventions
  if (toPrune.length < excess) {
    for (const record of conventions) {
      if (toPrune.length >= excess) break;
      toPrune.push(record);
    }
  }

  return toPrune;
}

/**
 * Apply pruning to a list of learnings, returning the pruned set.
 *
 * @param learnings - all current learning records
 * @param maxRecords - the configured maximum record budget
 * @returns object with { remaining, pruned } arrays
 */
export function pruneLearnings(
  learnings: LearningRecord[],
  maxRecords: number,
): { remaining: LearningRecord[]; pruned: LearningRecord[] } {
  const toPrune = computePruneSet(learnings, maxRecords);
  const pruneIds = new Set(toPrune.map((r) => r.id));

  const remaining = learnings.filter((r) => !pruneIds.has(r.id));
  return { remaining, pruned: toPrune };
}
