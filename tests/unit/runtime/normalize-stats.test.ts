/**
 * S05 contract seed — unit tests for normalize-stats.
 *
 * Tests are organised by metering mode.  Each describe block validates the
 * contract that normalizeStats() and isWithinBudget() must honour once Lane B
 * (aegis-fjm.6.3) implements those functions.
 *
 * Approach:
 *   - Structural assertions (type shapes, constant values) are live tests.
 *   - Behavioural assertions that require real implementations use .todo()
 *     so they fail visibly when Lane B is ready to be filled in.
 *
 * Canonical contract: SPECv2 §8.2.2.
 */

import { describe, expect, it } from "vitest";

import {
  normalizeStats,
  isWithinBudget,
  type AuthMode,
  type MeteringCapability,
  type NormalizedBudgetStatus,
  type UsageObservation,
} from "../../../src/runtime/normalize-stats.js";
import type { AgentStats } from "../../../src/runtime/agent-runtime.js";
import type { BudgetLimit } from "../../../src/config/schema.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<AgentStats> = {}): AgentStats {
  return {
    input_tokens: 1000,
    output_tokens: 500,
    session_turns: 5,
    wall_time_sec: 120,
    ...overrides,
  };
}

function makeBudgetLimit(overrides: Partial<BudgetLimit> = {}): BudgetLimit {
  return {
    turns: 20,
    tokens: 10000,
    ...overrides,
  };
}

function makeObservation(
  metering: MeteringCapability,
  auth_mode: AuthMode,
  overrides: Partial<UsageObservation> = {}
): UsageObservation {
  return {
    provider: "pi",
    auth_mode,
    metering,
    confidence: "exact",
    source: "session_stats",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Type-shape assertions (live — no implementation needed)
// ---------------------------------------------------------------------------

describe("MeteringCapability type values", () => {
  it("covers all five canonical SPECv2 §8.2.2 values", () => {
    const values: MeteringCapability[] = [
      "exact_usd",
      "credits",
      "quota",
      "stats_only",
      "unknown",
    ];
    expect(values).toHaveLength(5);
    expect(values).toContain("exact_usd");
    expect(values).toContain("credits");
    expect(values).toContain("quota");
    expect(values).toContain("stats_only");
    expect(values).toContain("unknown");
  });
});

describe("AuthMode type values", () => {
  it("covers all five canonical SPECv2 §8.2.2 values", () => {
    const values: AuthMode[] = [
      "api_key",
      "subscription",
      "workspace_subscription",
      "local",
      "unknown",
    ];
    expect(values).toHaveLength(5);
    expect(values).toContain("api_key");
    expect(values).toContain("subscription");
    expect(values).toContain("workspace_subscription");
    expect(values).toContain("local");
    expect(values).toContain("unknown");
  });
});

describe("NormalizedBudgetStatus shape", () => {
  it("carries required fields: metering, auth_mode, confidence, total_tokens, session_turns, wall_time_sec, budget_warning", () => {
    // Purely structural — build an object literal and assert the keys compile.
    const status: NormalizedBudgetStatus = {
      metering: "stats_only",
      auth_mode: "api_key",
      confidence: "estimated",
      total_tokens: 1500,
      session_turns: 5,
      wall_time_sec: 120,
      budget_warning: false,
    };
    expect(status.metering).toBe("stats_only");
    expect(status.auth_mode).toBe("api_key");
    expect(status.total_tokens).toBe(1500);
    expect(status.budget_warning).toBe(false);
  });

  it("allows optional cost/credit/quota fields to be absent", () => {
    const status: NormalizedBudgetStatus = {
      metering: "stats_only",
      auth_mode: "local",
      confidence: "estimated",
      total_tokens: 0,
      session_turns: 0,
      wall_time_sec: 0,
      budget_warning: false,
    };
    expect(status.exact_cost_usd).toBeUndefined();
    expect(status.credits_used).toBeUndefined();
    expect(status.quota_used_pct).toBeUndefined();
    expect(status.active_context_pct).toBeUndefined();
  });
});

describe("UsageObservation shape", () => {
  it("requires provider, auth_mode, metering, confidence, and source", () => {
    const obs = makeObservation("exact_usd", "api_key", {
      exact_cost_usd: 0.05,
      input_tokens: 1000,
      output_tokens: 500,
    });
    expect(obs.provider).toBe("pi");
    expect(obs.metering).toBe("exact_usd");
    expect(obs.confidence).toBe("exact");
    expect(obs.source).toBe("session_stats");
  });
});

// ---------------------------------------------------------------------------
// exact_usd metering
// ---------------------------------------------------------------------------

describe("normalizeStats — exact_usd metering", () => {
  it.todo("populates exact_cost_usd from observation");
  it.todo("sets confidence to 'exact'");
  it.todo("total_tokens equals input_tokens + output_tokens from raw stats");
  it.todo("budget_warning is false when well below limits");
  it.todo("budget_warning is true when cost approaches per_issue_cost_warning_usd");
});

// ---------------------------------------------------------------------------
// credits metering
// ---------------------------------------------------------------------------

describe("normalizeStats — credits metering", () => {
  it.todo("populates credits_used and credits_remaining from observation");
  it.todo("sets confidence to 'proxy' when no billing API is available");
  it.todo("budget_warning is true when credits_remaining is below credit_warning_floor");
  it.todo("exact_cost_usd is not set — never fabricate dollar precision");
});

// ---------------------------------------------------------------------------
// stats_only metering
// ---------------------------------------------------------------------------

describe("normalizeStats — stats_only metering", () => {
  it.todo("populates total_tokens, session_turns, wall_time_sec from raw stats");
  it.todo("sets confidence to 'estimated'");
  it.todo("leaves exact_cost_usd, credits_used, and quota_used_pct undefined");
  it.todo("budget_warning is false when tokens < budget limit");
  it.todo("budget_warning is true when tokens exceed budget limit");
});

// ---------------------------------------------------------------------------
// quota metering
// ---------------------------------------------------------------------------

describe("normalizeStats — quota metering", () => {
  it.todo("populates quota_used_pct and quota_remaining_pct from observation");
  it.todo("sets confidence to 'proxy'");
  it.todo("budget_warning is true when quota_remaining_pct is below quota_warning_floor_pct");
});

// ---------------------------------------------------------------------------
// unknown metering — conservative defaults
// ---------------------------------------------------------------------------

describe("normalizeStats — unknown metering", () => {
  it.todo("sets confidence to 'proxy'");
  it.todo("sets budget_warning to true (conservative default)");
  it.todo("does not set exact_cost_usd, credits_used, or quota_used_pct");
  it.todo("still populates total_tokens, session_turns, and wall_time_sec from raw stats");
});

// ---------------------------------------------------------------------------
// isWithinBudget
// ---------------------------------------------------------------------------

describe("isWithinBudget — turn and token limits", () => {
  it.todo("returns true when session_turns < limits.turns and total_tokens < limits.tokens");
  it.todo("returns false when session_turns >= limits.turns");
  it.todo("returns false when total_tokens >= limits.tokens");
  it.todo("returns false when both limits are exceeded");
});

describe("isWithinBudget — unknown metering conservative behaviour", () => {
  it.todo("returns false when metering is 'unknown' and budget_warning is true");
  it.todo("still checks token/turn limits even with unknown metering");
});

describe("isWithinBudget — edge cases", () => {
  it.todo("returns true when session is at exactly one less than the limit");
  it.todo("returns false when session is at exactly the limit (boundary = over)");
  it.todo("handles zero-valued stats without throwing");
});

// ---------------------------------------------------------------------------
// Function signature assertions (live — verify the stubs exist and throw the
// expected not-implemented error rather than disappearing at compile time)
// ---------------------------------------------------------------------------

describe("normalizeStats stub", () => {
  it("throws 'not implemented' until Lane B lands", () => {
    expect(() =>
      normalizeStats(makeStats(), "api_key", "exact_usd")
    ).toThrow(/not implemented/i);
  });
});

describe("isWithinBudget stub", () => {
  it("throws 'not implemented' until Lane B lands", () => {
    const status: NormalizedBudgetStatus = {
      metering: "stats_only",
      auth_mode: "api_key",
      confidence: "estimated",
      total_tokens: 1500,
      session_turns: 5,
      wall_time_sec: 120,
      budget_warning: false,
    };
    expect(() => isWithinBudget(status, makeBudgetLimit())).toThrow(
      /not implemented/i
    );
  });
});
