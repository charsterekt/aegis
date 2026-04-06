/**
 * Integration tests for Mnemosyne store — SPECv2 §14 write/read contract.
 *
 * Gate: npm run test -- tests/integration/memory/mnemosyne-store.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appendFileSync, existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import {
  appendLearning,
  loadLearnings,
  validateLearning,
  getRecordCount,
  type LearningRecord,
} from "../../../src/memory/mnemosyne-store.js";
import { pruneLearnings, computePruneSet } from "../../../src/memory/lethe.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_DIR = ".aegis/test-mnemosyne";
const TEST_FILE = `${TEST_DIR}/mnemosyne.jsonl`;

function makeRecord(overrides: Partial<LearningRecord> = {}): LearningRecord {
  return {
    id: overrides.id ?? "test-1",
    category: overrides.category ?? "convention",
    content: overrides.content ?? "test content",
    domain: overrides.domain ?? "config",
    source: overrides.source ?? "human",
    issueId: overrides.issueId ?? null,
    timestamp: overrides.timestamp ?? "2026-04-01T00:00:00Z",
  };
}

beforeEach(() => {
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }
  // Ensure clean file
  if (existsSync(TEST_FILE)) {
    rmSync(TEST_FILE);
  }
});

afterEach(() => {
  if (existsSync(TEST_FILE)) {
    rmSync(TEST_FILE);
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validateLearning", () => {
  it("accepts a valid learning record", () => {
    const rec = makeRecord();
    expect(validateLearning(rec)).toBe(true);
  });

  it("rejects null input", () => {
    expect(validateLearning(null)).toBe("learning record must be a non-null object");
  });

  it("rejects non-object input", () => {
    expect(validateLearning("string")).toBe("learning record must be a non-null object");
  });

  it("rejects missing required fields", () => {
    expect(validateLearning({ id: "1" })).toBe("missing required field: category");
  });

  it("rejects invalid category", () => {
    const rec = makeRecord({ category: "telemetry" as any });
    expect(validateLearning(rec)).toContain("invalid category");
  });

  it("rejects empty content", () => {
    const rec = makeRecord({ content: "" });
    expect(validateLearning(rec)).toBe("content must be a non-empty string");
  });

  it("rejects invalid source", () => {
    const rec = makeRecord({ source: "unknown" as any });
    expect(validateLearning(rec)).toContain("invalid source");
  });

  it("accepts all valid categories", () => {
    for (const cat of ["convention", "pattern", "failure"] as const) {
      const rec = makeRecord({ id: `cat-${cat}`, category: cat });
      expect(validateLearning(rec)).toBe(true);
    }
  });

  it("accepts all valid sources", () => {
    for (const src of ["oracle", "titan", "sentinel", "janus", "human", "system"] as const) {
      const rec = makeRecord({ id: `src-${src}`, source: src });
      expect(validateLearning(rec)).toBe(true);
    }
  });

  it("accepts null issueId", () => {
    const rec = makeRecord({ issueId: null });
    expect(validateLearning(rec)).toBe(true);
  });

  it("accepts string issueId", () => {
    const rec = makeRecord({ issueId: "aegis-fjm.1" });
    expect(validateLearning(rec)).toBe(true);
  });

  it("rejects non-string issueId", () => {
    const rec = makeRecord({ issueId: 123 as any });
    expect(validateLearning(rec)).toBe("issueId must be a string or null");
  });
});

describe("appendLearning and loadLearnings", () => {
  it("appends a record and loads it back", () => {
    const rec = makeRecord({ id: "persist-1", content: "use kebab-case for files" });
    appendLearning(TEST_FILE, rec);

    const loaded = loadLearnings(TEST_FILE);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("persist-1");
    expect(loaded[0].content).toBe("use kebab-case for files");
  });

  it("appends multiple records in order", () => {
    appendLearning(TEST_FILE, makeRecord({ id: "a", timestamp: "2026-04-01T00:00:00Z" }));
    appendLearning(TEST_FILE, makeRecord({ id: "b", timestamp: "2026-04-02T00:00:00Z" }));
    appendLearning(TEST_FILE, makeRecord({ id: "c", timestamp: "2026-04-03T00:00:00Z" }));

    const loaded = loadLearnings(TEST_FILE);
    expect(loaded).toHaveLength(3);
    expect(loaded.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("creates the file if it does not exist", () => {
    const rec = makeRecord({ id: "new-file" });
    appendLearning(TEST_FILE, rec);
    expect(existsSync(TEST_FILE)).toBe(true);
    expect(loadLearnings(TEST_FILE)).toHaveLength(1);
  });

  it("returns empty array for non-existent file", () => {
    const nonExistent = `${TEST_DIR}/does-not-exist.jsonl`;
    expect(loadLearnings(nonExistent)).toEqual([]);
  });

  it("silently skips malformed JSON lines", () => {
    appendFileSync(TEST_FILE, "not json\n", "utf-8");
    appendLearning(TEST_FILE, makeRecord({ id: "good" }));

    const loaded = loadLearnings(TEST_FILE);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("good");
  });

  it("silently skips records that fail validation", () => {
    appendFileSync(TEST_FILE, JSON.stringify({ id: "bad" }) + "\n", "utf-8");
    appendLearning(TEST_FILE, makeRecord({ id: "good" }));

    const loaded = loadLearnings(TEST_FILE);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("good");
  });
});

describe("getRecordCount", () => {
  it("returns 0 for non-existent file", () => {
    expect(getRecordCount(`${TEST_DIR}/nope.jsonl`)).toBe(0);
  });

  it("returns correct count for existing records", () => {
    appendLearning(TEST_FILE, makeRecord({ id: "1" }));
    appendLearning(TEST_FILE, makeRecord({ id: "2" }));
    appendLearning(TEST_FILE, makeRecord({ id: "3" }));
    expect(getRecordCount(TEST_FILE)).toBe(3);
  });
});

describe("Lethe pruning", () => {
  it("returns empty prune set when under limit", () => {
    const learnings = [
      makeRecord({ id: "1" }),
      makeRecord({ id: "2" }),
    ];
    expect(computePruneSet(learnings, 5)).toEqual([]);
  });

  it("prunes oldest records first when over limit", () => {
    const learnings = [
      makeRecord({ id: "old", timestamp: "2026-04-01T00:00:00Z" }),
      makeRecord({ id: "mid", timestamp: "2026-04-02T00:00:00Z" }),
      makeRecord({ id: "new", timestamp: "2026-04-03T00:00:00Z" }),
    ];

    const pruned = computePruneSet(learnings, 2);
    expect(pruned).toHaveLength(1);
    expect(pruned[0].id).toBe("old");
  });

  it("keeps convention records longer than non-convention", () => {
    const learnings = [
      makeRecord({ id: "conv-old", category: "convention", timestamp: "2026-04-01T00:00:00Z" }),
      makeRecord({ id: "fail-mid", category: "failure", timestamp: "2026-04-02T00:00:00Z" }),
      makeRecord({ id: "pat-new", category: "pattern", timestamp: "2026-04-03T00:00:00Z" }),
    ];

    // Need to prune 1 record. Should prune the oldest non-convention first.
    const pruned = computePruneSet(learnings, 2);
    expect(pruned).toHaveLength(1);
    expect(pruned[0].id).toBe("fail-mid"); // oldest non-convention
  });

  it("prunes conventions only after all non-convention are gone", () => {
    const learnings = [
      makeRecord({ id: "conv-1", category: "convention", timestamp: "2026-04-01T00:00:00Z" }),
      makeRecord({ id: "conv-2", category: "convention", timestamp: "2026-04-02T00:00:00Z" }),
      makeRecord({ id: "fail-1", category: "failure", timestamp: "2026-04-03T00:00:00Z" }),
    ];

    // Need to prune 2. First prune the 1 non-convention, then the oldest convention.
    const pruned = computePruneSet(learnings, 1);
    expect(pruned).toHaveLength(2);
    expect(pruned.map((r) => r.id)).toContain("fail-1");
    expect(pruned.map((r) => r.id)).toContain("conv-1");
  });

  it("prunes everything when maxRecords is 0", () => {
    const learnings = [
      makeRecord({ id: "1" }),
      makeRecord({ id: "2" }),
    ];
    const pruned = computePruneSet(learnings, 0);
    expect(pruned).toHaveLength(2);
  });

  it("pruneLearnings returns correct remaining and pruned sets", () => {
    const learnings = [
      makeRecord({ id: "1", timestamp: "2026-04-01T00:00:00Z" }),
      makeRecord({ id: "2", timestamp: "2026-04-02T00:00:00Z" }),
      makeRecord({ id: "3", timestamp: "2026-04-03T00:00:00Z" }),
    ];

    const { remaining, pruned } = pruneLearnings(learnings, 2);
    expect(remaining).toHaveLength(2);
    expect(pruned).toHaveLength(1);
    expect(pruned[0].id).toBe("1");
  });

  it("integration: append, prune, and verify remaining count", () => {
    // Append 5 records
    for (let i = 1; i <= 5; i++) {
      appendLearning(TEST_FILE, makeRecord({
        id: `rec-${i}`,
        timestamp: `2026-04-0${i}T00:00:00Z`,
        category: i % 2 === 0 ? "convention" : "failure",
      }));
    }

    expect(getRecordCount(TEST_FILE)).toBe(5);

    const loaded = loadLearnings(TEST_FILE);
    const { remaining, pruned } = pruneLearnings(loaded, 3);

    expect(pruned).toHaveLength(2);
    expect(remaining).toHaveLength(3);

    // Verify remaining records are the correct ones (not the pruned ones)
    const prunedIds = new Set(pruned.map((r) => r.id));
    for (const rec of remaining) {
      expect(prunedIds.has(rec.id)).toBe(false);
    }
  });
});

describe("Telemetry exclusion", () => {
  it("does not accept telemetry-like categories", () => {
    // Telemetry does not belong in Mnemosyne per SPECv2 §4.4
    const badCategories = ["telemetry", "crash", "timeout", "retry"];
    for (const cat of badCategories) {
      const result = validateLearning(makeRecord({ category: cat as any }));
      expect(result).toContain("invalid category");
    }
  });
});
