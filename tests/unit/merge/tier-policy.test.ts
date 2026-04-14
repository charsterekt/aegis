import { describe, expect, it } from "vitest";

import { classifyMergeTier } from "../../../src/merge/tier-policy.js";

describe("classifyMergeTier", () => {
  it("classifies clean merge results as automatic T1", () => {
    expect(classifyMergeTier({
      outcome: "merged",
      attempts: 0,
      janusRetryThreshold: 2,
      janusEnabled: true,
      janusInvocations: 0,
      maxJanusInvocations: 1,
    })).toEqual({
      tier: "T1",
      action: "merge",
    });
  });

  it("keeps stale/conflict retries in automatic T2 before threshold", () => {
    expect(classifyMergeTier({
      outcome: "stale_branch",
      attempts: 1,
      janusRetryThreshold: 2,
      janusEnabled: true,
      janusInvocations: 0,
      maxJanusInvocations: 1,
    })).toEqual({
      tier: "T2",
      action: "requeue",
    });
  });

  it("escalates conflict retries to Janus at T3 once threshold is reached", () => {
    expect(classifyMergeTier({
      outcome: "conflict",
      attempts: 2,
      janusRetryThreshold: 2,
      janusEnabled: true,
      janusInvocations: 0,
      maxJanusInvocations: 1,
    })).toEqual({
      tier: "T3",
      action: "janus",
    });
  });

  it("fails T3 escalation when Janus is disabled", () => {
    expect(classifyMergeTier({
      outcome: "conflict",
      attempts: 2,
      janusRetryThreshold: 2,
      janusEnabled: false,
      janusInvocations: 0,
      maxJanusInvocations: 1,
    })).toEqual({
      tier: "T3",
      action: "fail",
    });
  });
});
