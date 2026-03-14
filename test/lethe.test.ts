// test/lethe.test.ts
import { describe, it, expect } from "vitest";
import { prune, shouldPrune } from "../src/lethe.js";
import type { MnemosyneRecord } from "../src/types.js";

function makeRecord(overrides: Partial<MnemosyneRecord> = {}): MnemosyneRecord {
  return {
    id: "l-default",
    type: "pattern",
    domain: "typescript",
    text: "Default record",
    source: "titan-1",
    issue: "aegis-001",
    ts: 1000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// shouldPrune()
// ---------------------------------------------------------------------------
describe("shouldPrune()", () => {
  it("returns false when count is under max", () => {
    const records = [makeRecord({ id: "l-1" }), makeRecord({ id: "l-2" })];
    expect(shouldPrune(records, 5)).toBe(false);
  });

  it("returns false when count is exactly at max", () => {
    const records = [makeRecord({ id: "l-1" }), makeRecord({ id: "l-2" })];
    expect(shouldPrune(records, 2)).toBe(false);
  });

  it("returns true when count exceeds max", () => {
    const records = [makeRecord({ id: "l-1" }), makeRecord({ id: "l-2" }), makeRecord({ id: "l-3" })];
    expect(shouldPrune(records, 2)).toBe(true);
  });

  it("returns false for empty array", () => {
    expect(shouldPrune([], 0)).toBe(false);
    expect(shouldPrune([], 5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// prune()
// ---------------------------------------------------------------------------
describe("prune()", () => {
  it("returns all records when count is under max", () => {
    const records = [makeRecord({ id: "l-1", ts: 1000 }), makeRecord({ id: "l-2", ts: 2000 })];
    const result = prune(records, 5);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toContain("l-1");
    expect(result.map((r) => r.id)).toContain("l-2");
  });

  it("returns all records when count equals max", () => {
    const records = [makeRecord({ id: "l-1" }), makeRecord({ id: "l-2" })];
    const result = prune(records, 2);
    expect(result).toHaveLength(2);
  });

  it("removes oldest records when over max", () => {
    const records = [
      makeRecord({ id: "l-old", ts: 100, type: "pattern" }),
      makeRecord({ id: "l-mid", ts: 500, type: "pattern" }),
      makeRecord({ id: "l-new", ts: 900, type: "pattern" }),
    ];
    const result = prune(records, 2);
    expect(result).toHaveLength(2);
    // Oldest (ts=100) should be dropped
    expect(result.map((r) => r.id)).not.toContain("l-old");
    expect(result.map((r) => r.id)).toContain("l-new");
    expect(result.map((r) => r.id)).toContain("l-mid");
  });

  it("gives convention records 2x longevity over pattern/failure records", () => {
    // A convention at ts=300 has effectiveTs=600, which beats a pattern at ts=500 (effectiveTs=500).
    // So the convention survives even though its raw timestamp is older.
    const records = [
      makeRecord({ id: "l-conv", ts: 300, type: "convention" }),   // effectiveTs = 600 → survives
      makeRecord({ id: "l-pat", ts: 500, type: "pattern" }),        // effectiveTs = 500 → survives
      makeRecord({ id: "l-fail", ts: 400, type: "failure" }),       // effectiveTs = 400 → pruned
    ];
    const result = prune(records, 2);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toContain("l-conv");
    expect(result.map((r) => r.id)).toContain("l-pat");
    expect(result.map((r) => r.id)).not.toContain("l-fail");
  });

  it("convention at older timestamp beats newer pattern with 2x longevity", () => {
    // conv ts=600 → effectiveTs=1200
    // pattern ts=700 → effectiveTs=700
    // failure ts=800 → effectiveTs=800
    // Keep 1: conv survives (effectiveTs 1200 > 800 > 700)
    const records = [
      makeRecord({ id: "l-conv", ts: 600, type: "convention" }),
      makeRecord({ id: "l-pat", ts: 700, type: "pattern" }),
      makeRecord({ id: "l-fail", ts: 800, type: "failure" }),
    ];
    const result = prune(records, 1);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("l-conv");
  });

  it("preserves newest records regardless of type when no convention advantage applies", () => {
    const records = [
      makeRecord({ id: "l-1", ts: 100, type: "pattern" }),
      makeRecord({ id: "l-2", ts: 200, type: "pattern" }),
      makeRecord({ id: "l-3", ts: 300, type: "pattern" }),
      makeRecord({ id: "l-4", ts: 400, type: "pattern" }),
    ];
    const result = prune(records, 2);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toContain("l-3");
    expect(result.map((r) => r.id)).toContain("l-4");
  });

  it("handles empty input", () => {
    expect(prune([], 5)).toEqual([]);
    expect(prune([], 0)).toEqual([]);
  });

  it("handles max=0 (returns empty array)", () => {
    const records = [makeRecord({ id: "l-1" }), makeRecord({ id: "l-2" })];
    expect(prune(records, 0)).toEqual([]);
  });

  it("handles max=1 (keeps only top record)", () => {
    const records = [
      makeRecord({ id: "l-old", ts: 100, type: "pattern" }),
      makeRecord({ id: "l-new", ts: 999, type: "pattern" }),
    ];
    const result = prune(records, 1);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("l-new");
  });

  it("does not mutate the original array", () => {
    const records = [
      makeRecord({ id: "l-1", ts: 100 }),
      makeRecord({ id: "l-2", ts: 200 }),
      makeRecord({ id: "l-3", ts: 300 }),
    ];
    const original = [...records];
    prune(records, 2);
    expect(records).toHaveLength(original.length);
    expect(records[0]!.id).toBe("l-1");
  });

  it("returns a new array (does not return same reference)", () => {
    const records = [makeRecord({ id: "l-1" })];
    const result = prune(records, 5);
    expect(result).not.toBe(records);
  });
});
