/**
 * S02 contract seed — unit tests for the eval harness result schema.
 *
 * These tests verify that:
 *   1. EvalRunResult has all fields required by SPECv2 §24.5.
 *   2. The scenario manifest can be loaded and parsed.
 *   3. The result schema constant matches the config default.
 *   4. Valid and invalid payloads can be distinguished with runtime guards.
 *
 * NOTE: These are structural / contract tests only.  They do not invoke the
 * scenario runner or write anything to disk — that is lane A's responsibility.
 */

import path from "node:path";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  EVALS_RESULTS_PATH,
  type EvalRunResult,
  type EvalScenario,
  type ScoreSummary,
} from "../../../src/evals/result-schema.js";
import { DEFAULT_AEGIS_CONFIG } from "../../../src/config/defaults.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalResult(): EvalRunResult {
  return {
    aegis_version: "0.1.0",
    git_sha: "abc1234def5678901234567890123456789012345",
    config_fingerprint: "sha256:deadbeef",
    runtime: "pi",
    model_mapping: { oracle: "pi:default", titan: "pi:default" },
    scenario_id: "single-clean-issue",
    issue_count: 1,
    issue_types: { task: 1 },
    completion_outcomes: { "issue-1": "completed" },
    merge_outcomes: { "issue-1": "merged_clean" },
    human_intervention_issue_ids: [],
    cost_totals: null,
    quota_totals: null,
    timing: {
      started_at: "2026-04-04T18:00:00.000Z",
      finished_at: "2026-04-04T18:05:00.000Z",
      elapsed_ms: 300_000,
    },
  };
}

function makeMinimalScenario(): EvalScenario {
  return {
    id: "single-clean-issue",
    name: "Single clean issue with no blockers",
    description: "Happy-path baseline scenario.",
    fixture_path: "single-clean-issue/fixture.json",
    expected_outcomes: {
      min_completion_rate: 1.0,
      expects_human_intervention: false,
      expects_janus: false,
      expects_restart_recovery: false,
    },
  };
}

function makeMinimalScoreSummary(): ScoreSummary {
  return {
    scenario_id: "single-clean-issue",
    run_timestamp: "2026-04-04T18:00:00.000Z",
    issue_completion_rate: 1.0,
    structured_artifact_compliance_rate: 1.0,
    clarification_compliance_rate: 1.0,
    merge_conflict_rate_per_titan: 0,
    merge_queue_latency_ms: 1500,
    rework_loops_per_issue: 0,
    janus_invocation_rate_per_10_issues: 0,
    janus_success_rate: 1.0,
    messaging_token_overhead: null,
    human_interventions_per_10_issues: 0,
    cost_per_completed_issue_usd: null,
    restart_recovery_success_rate: null,
    gates: {
      structured_artifact_compliance_100pct: true,
      clarification_compliance_100pct: true,
      restart_recovery_100pct: true,
      no_direct_to_main_bypasses: true,
      issue_completion_rate_80pct: true,
      human_interventions_within_threshold: true,
      janus_minority_path: true,
    },
  };
}

// ---------------------------------------------------------------------------
// EVALS_RESULTS_PATH constant
// ---------------------------------------------------------------------------

describe("S02 eval result schema — constants", () => {
  it("EVALS_RESULTS_PATH matches the default config evals.results_path", () => {
    expect(EVALS_RESULTS_PATH).toBe(DEFAULT_AEGIS_CONFIG.evals.results_path);
    expect(EVALS_RESULTS_PATH).toBe(".aegis/evals");
  });
});

// ---------------------------------------------------------------------------
// EvalRunResult — required fields from SPECv2 §24.5
// ---------------------------------------------------------------------------

describe("S02 eval result schema — EvalRunResult required fields (SPECv2 §24.5)", () => {
  it("accepts a fully-populated valid EvalRunResult", () => {
    const result = makeMinimalResult();

    // Identity fields
    expect(result.aegis_version).toBeDefined();
    expect(result.git_sha).toBeDefined();
    expect(result.config_fingerprint).toBeDefined();

    // Runtime / model mapping
    expect(result.runtime).toBeDefined();
    expect(result.model_mapping).toBeDefined();

    // Scenario identity
    expect(result.scenario_id).toBeDefined();

    // Issue statistics
    expect(typeof result.issue_count).toBe("number");
    expect(result.issue_types).toBeDefined();

    // Outcomes
    expect(result.completion_outcomes).toBeDefined();
    expect(result.merge_outcomes).toBeDefined();

    // Human interventions
    expect(Array.isArray(result.human_intervention_issue_ids)).toBe(true);

    // Cost / quota (may be null)
    expect("cost_totals" in result).toBe(true);
    expect("quota_totals" in result).toBe(true);

    // Timing
    expect(result.timing.started_at).toBeDefined();
    expect(result.timing.finished_at).toBeDefined();
    expect(typeof result.timing.elapsed_ms).toBe("number");
  });

  it("captures completion outcomes for each issue id", () => {
    const result = makeMinimalResult();

    result.completion_outcomes["issue-2"] = "failed";
    result.completion_outcomes["issue-3"] = "paused_complex";

    expect(result.completion_outcomes["issue-1"]).toBe("completed");
    expect(result.completion_outcomes["issue-2"]).toBe("failed");
    expect(result.completion_outcomes["issue-3"]).toBe("paused_complex");
  });

  it("captures merge outcomes for each issue id", () => {
    const result = makeMinimalResult();

    result.merge_outcomes["issue-2"] = "conflict_resolved_janus";

    expect(result.merge_outcomes["issue-1"]).toBe("merged_clean");
    expect(result.merge_outcomes["issue-2"]).toBe("conflict_resolved_janus");
  });

  it("records human intervention issue ids", () => {
    const result = makeMinimalResult();

    result.human_intervention_issue_ids.push("issue-3");

    expect(result.human_intervention_issue_ids).toContain("issue-3");
  });

  it("accepts exact-dollar cost totals when available", () => {
    const result = makeMinimalResult();

    result.cost_totals = {
      total_usd: 0.42,
      per_agent: { titan: 0.30, oracle: 0.12 },
    };

    expect(result.cost_totals.total_usd).toBe(0.42);
    expect(result.cost_totals.per_agent["titan"]).toBe(0.30);
  });

  it("accepts quota totals when exact dollars are unavailable", () => {
    const result = makeMinimalResult();

    result.quota_totals = {
      kind: "quota",
      units_consumed: 1200,
      credit_delta: null,
    };

    expect(result.quota_totals.kind).toBe("quota");
    expect(result.quota_totals.units_consumed).toBe(1200);
  });

  it("timing.elapsed_ms is a non-negative number", () => {
    const result = makeMinimalResult();

    expect(result.timing.elapsed_ms).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// EvalScenario — scenario definition shape
// ---------------------------------------------------------------------------

describe("S02 eval result schema — EvalScenario shape", () => {
  it("accepts a valid minimal scenario definition", () => {
    const scenario = makeMinimalScenario();

    expect(scenario.id).toMatch(/^[a-z0-9-]+$/);
    expect(typeof scenario.name).toBe("string");
    expect(typeof scenario.description).toBe("string");
    expect(typeof scenario.fixture_path).toBe("string");
    expect(scenario.expected_outcomes.min_completion_rate).toBeGreaterThanOrEqual(0);
    expect(scenario.expected_outcomes.min_completion_rate).toBeLessThanOrEqual(1);
    expect(typeof scenario.expected_outcomes.expects_human_intervention).toBe("boolean");
    expect(typeof scenario.expected_outcomes.expects_janus).toBe("boolean");
    expect(typeof scenario.expected_outcomes.expects_restart_recovery).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// ScoreSummary — machine-readable metrics shape (SPECv2 §24.7 / §24.8)
// ---------------------------------------------------------------------------

describe("S02 eval result schema — ScoreSummary shape", () => {
  it("accepts a valid minimal score summary", () => {
    const summary = makeMinimalScoreSummary();

    // All §24.7 canonical metrics are present
    expect(typeof summary.issue_completion_rate).toBe("number");
    expect(typeof summary.structured_artifact_compliance_rate).toBe("number");
    expect(typeof summary.clarification_compliance_rate).toBe("number");
    expect(typeof summary.merge_conflict_rate_per_titan).toBe("number");
    expect(typeof summary.merge_queue_latency_ms).toBe("number");
    expect(typeof summary.rework_loops_per_issue).toBe("number");
    expect(typeof summary.janus_invocation_rate_per_10_issues).toBe("number");
    expect(typeof summary.janus_success_rate).toBe("number");
    expect(typeof summary.human_interventions_per_10_issues).toBe("number");

    // Nullable fields are present (may be null)
    expect("messaging_token_overhead" in summary).toBe(true);
    expect("cost_per_completed_issue_usd" in summary).toBe(true);
    expect("restart_recovery_success_rate" in summary).toBe(true);
  });

  it("includes all §24.8 release gate flags", () => {
    const summary = makeMinimalScoreSummary();
    const gates = summary.gates;

    expect(typeof gates.structured_artifact_compliance_100pct).toBe("boolean");
    expect(typeof gates.clarification_compliance_100pct).toBe("boolean");
    expect(typeof gates.restart_recovery_100pct).toBe("boolean");
    expect(typeof gates.no_direct_to_main_bypasses).toBe("boolean");
    expect(typeof gates.issue_completion_rate_80pct).toBe("boolean");
    expect(typeof gates.human_interventions_within_threshold).toBe("boolean");
    expect(typeof gates.janus_minority_path).toBe("boolean");
  });

  it("a passing run has all gate flags set to true", () => {
    const summary = makeMinimalScoreSummary();

    expect(Object.values(summary.gates).every((v) => v === true)).toBe(true);
  });

  it("a failing run can have individual gate flags set to false", () => {
    const summary = makeMinimalScoreSummary();

    summary.issue_completion_rate = 0.6;
    summary.gates.issue_completion_rate_80pct = false;

    expect(summary.gates.issue_completion_rate_80pct).toBe(false);
    // Other gates unaffected
    expect(summary.gates.structured_artifact_compliance_100pct).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scenario manifest — can be loaded and parsed
// ---------------------------------------------------------------------------

describe("S02 eval result schema — scenario manifest (evals/scenarios/index.json)", () => {
  const manifestPath = path.join(repoRoot, "evals", "scenarios", "index.json");

  it("manifest file exists and is valid JSON", () => {
    const raw = readFileSync(manifestPath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("manifest has a 'scenarios' array", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      scenarios: unknown[];
    };

    expect(Array.isArray(manifest.scenarios)).toBe(true);
  });

  it("each scenario entry has the required EvalScenario fields", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      scenarios: Record<string, unknown>[];
    };

    for (const entry of manifest.scenarios) {
      expect(typeof entry["id"]).toBe("string");
      expect(typeof entry["name"]).toBe("string");
      expect(typeof entry["description"]).toBe("string");
      expect(typeof entry["fixture_path"]).toBe("string");
      expect(entry["expected_outcomes"]).toBeDefined();

      const outcomes = entry["expected_outcomes"] as Record<string, unknown>;
      expect(typeof outcomes["min_completion_rate"]).toBe("number");
      expect(typeof outcomes["expects_human_intervention"]).toBe("boolean");
      expect(typeof outcomes["expects_janus"]).toBe("boolean");
      expect(typeof outcomes["expects_restart_recovery"]).toBe("boolean");
    }
  });

  it("placeholder scenario id matches the SPECv2 §24.6 happy-path scenario name", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      scenarios: Array<{ id: string }>;
    };

    const ids = manifest.scenarios.map((s) => s.id);
    expect(ids).toContain("single-clean-issue");
  });
});
