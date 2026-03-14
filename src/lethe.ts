// src/lethe.ts
// Lethe — learnings pruning mechanism.
// Pure functions: takes MnemosyneRecord[] in, returns pruned MnemosyneRecord[] out.
// No I/O — caller is responsible for loading from and saving to Mnemosyne.

import type { MnemosyneRecord } from "./types.js";

/**
 * Returns true if the record count exceeds maxRecords.
 */
export function shouldPrune(records: MnemosyneRecord[], maxRecords: number): boolean {
  return records.length > maxRecords;
}

/**
 * Prunes records down to maxRecords using recency-based strategy.
 * Convention-type records get 2x longevity: their timestamp is treated as if
 * it is twice as large, making them appear newer and survive longer.
 *
 * Returns a new array (does not mutate input).
 */
export function prune(records: MnemosyneRecord[], maxRecords: number): MnemosyneRecord[] {
  if (maxRecords <= 0) return [];
  if (records.length <= maxRecords) return [...records];

  // Compute effective timestamp for sorting:
  // conventions get ts * 2 (2x longevity — treated as newer)
  const withEffective = records.map((r) => ({
    record: r,
    effectiveTs: r.type === "convention" ? r.ts * 2 : r.ts,
  }));

  // Sort descending by effectiveTs — highest (newest) first survive
  withEffective.sort((a, b) => b.effectiveTs - a.effectiveTs);

  // Keep only the top maxRecords
  return withEffective.slice(0, maxRecords).map((x) => x.record);
}
