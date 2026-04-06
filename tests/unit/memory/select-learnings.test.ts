/**
 * Unit tests for select-learnings — SPECv2 §14.3 retrieval contract.
 *
 * Gate: npm run test -- tests/unit/memory/select-learnings.test.ts
 */

import { describe, it, expect } from "vitest";
import { selectLearnings, formatLearningsForPrompt } from "../../../src/memory/select-learnings.js";
import type { LearningRecord } from "../../../src/memory/mnemosyne-store.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("selectLearnings", () => {
  it("returns empty array when no learnings exist", () => {
    const result = selectLearnings([], "config", { prompt_token_budget: 1000 });
    expect(result).toEqual([]);
  });

  it("returns domain-matched learnings sorted recent-first", () => {
    const learnings = [
      makeRecord({ id: "old", domain: "config", timestamp: "2026-04-01T00:00:00Z", content: "old config rule" }),
      makeRecord({ id: "new", domain: "config", timestamp: "2026-04-05T00:00:00Z", content: "new config rule" }),
      makeRecord({ id: "other", domain: "auth", timestamp: "2026-04-04T00:00:00Z", content: "auth stuff" }),
    ];

    const result = selectLearnings(learnings, "config", { prompt_token_budget: 1000 });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("new");
    expect(result[1].id).toBe("old");
  });

  it("falls back to most recent learnings when no domain match", () => {
    const learnings = [
      makeRecord({ id: "a", domain: "auth", timestamp: "2026-04-01T00:00:00Z", content: "auth rule" }),
      makeRecord({ id: "b", domain: "auth", timestamp: "2026-04-05T00:00:00Z", content: "auth rule newer" }),
    ];

    const result = selectLearnings(learnings, "config", { prompt_token_budget: 1000 });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("b"); // most recent first
    expect(result[1].id).toBe("a");
  });

  it("truncates to stay within prompt token budget", () => {
    const learnings = [
      makeRecord({ id: "1", domain: "config", timestamp: "2026-04-01T00:00:00Z", content: "a".repeat(100) }),
      makeRecord({ id: "2", domain: "config", timestamp: "2026-04-02T00:00:00Z", content: "b".repeat(100) }),
      makeRecord({ id: "3", domain: "config", timestamp: "2026-04-03T00:00:00Z", content: "c".repeat(100) }),
    ];

    // Each content is ~100 chars = ~25 tokens. Budget of 40 tokens should allow only 1.
    const result = selectLearnings(learnings, "config", { prompt_token_budget: 40 });
    expect(result).toHaveLength(1);
    // Should pick the most recent one first
    expect(result[0].id).toBe("3");
  });

  it("returns empty when budget is zero", () => {
    const learnings = [
      makeRecord({ id: "1", domain: "config", content: "something" }),
    ];

    const result = selectLearnings(learnings, "config", { prompt_token_budget: 0 });
    expect(result).toEqual([]);
  });

  it("matches domain case-insensitively", () => {
    const learnings = [
      makeRecord({ id: "1", domain: "CONFIG", content: "upper case domain" }),
      makeRecord({ id: "2", domain: "Config", content: "mixed case domain" }),
    ];

    const result = selectLearnings(learnings, "config", { prompt_token_budget: 1000 });
    expect(result).toHaveLength(2);
  });

  it("handles fallback with empty learnings array", () => {
    const result = selectLearnings([], "anything", { prompt_token_budget: 500 });
    expect(result).toEqual([]);
  });
});

describe("formatLearningsForPrompt", () => {
  it("returns empty string for no learnings", () => {
    expect(formatLearningsForPrompt([])).toBe("");
  });

  it("formats learnings with category and content", () => {
    const learnings = [
      makeRecord({ id: "1", category: "convention", content: "Use PascalCase for exports" }),
      makeRecord({ id: "2", category: "failure", content: "Tool X fails on Windows" }),
    ];

    const result = formatLearningsForPrompt(learnings);
    expect(result).toContain("## Relevant Project Learnings");
    expect(result).toContain("[convention] Use PascalCase for exports");
    expect(result).toContain("[failure] Tool X fails on Windows");
    expect(result).toContain("1.");
    expect(result).toContain("2.");
  });
});
