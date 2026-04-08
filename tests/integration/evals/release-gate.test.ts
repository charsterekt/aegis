import path from "node:path";
import fs from "node:fs";

import { describe, expect, it } from "vitest";

import {
  createEmptyReleaseMetrics,
  type ReleaseArtifactCatalog,
  type ReleaseMetrics,
} from "../../../src/evals/compute-metrics.js";
import {
  DEFAULT_RELEASE_GATE_THRESHOLDS,
  MVP_RELEASE_CHECKLIST_PATH,
  RELEASE_GATE_CHECK_IDS,
  createReleaseGateReport,
  createPendingReleaseGateReport,
  evaluateReleaseGateReport,
} from "../../../src/evals/release-gate.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const fixturePath = path.join(
  repoRoot,
  "tests",
  "fixtures",
  "evals",
  "release-gate-contract.json",
);

const expectedEvidenceByCheck = {
  structured_artifact_compliance_100pct: [
    "single-clean-issue",
    "complex-pause",
    "decomposition",
    "clarification",
    "stale-branch-rework",
    "hard-merge-conflict",
    "janus-escalation",
    "janus-human-decision",
    "restart-during-implementation",
    "restart-during-merge",
    "polling-only",
  ],
  clarification_compliance_100pct: ["clarification"],
  restart_recovery_100pct: [
    "restart-during-implementation",
    "restart-during-merge",
  ],
  no_direct_to_main_bypasses: [
    "single-clean-issue",
    "decomposition",
    "stale-branch-rework",
    "hard-merge-conflict",
    "janus-escalation",
    "janus-human-decision",
    "restart-during-implementation",
    "restart-during-merge",
    "polling-only",
  ],
  issue_completion_rate_80pct: [
    "single-clean-issue",
    "complex-pause",
    "decomposition",
    "clarification",
    "stale-branch-rework",
    "hard-merge-conflict",
    "janus-escalation",
    "janus-human-decision",
    "restart-during-implementation",
    "restart-during-merge",
    "polling-only",
  ],
  human_interventions_within_threshold: [
    "single-clean-issue",
    "complex-pause",
    "decomposition",
    "clarification",
    "stale-branch-rework",
    "hard-merge-conflict",
    "janus-escalation",
    "janus-human-decision",
    "restart-during-implementation",
    "restart-during-merge",
    "polling-only",
  ],
  janus_minority_path: ["janus-escalation", "janus-human-decision"],
} as const;

function loadArtifactCatalog(): ReleaseArtifactCatalog {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
    artifacts: ReleaseArtifactCatalog;
  };

  return fixture.artifacts;
}

function makeReleaseMetrics(
  overrides: Partial<ReleaseMetrics> = {},
): ReleaseMetrics {
  return {
    ...createEmptyReleaseMetrics(),
    scenario_count: 11,
    direct_to_main_bypass_count: 0,
    issue_completion_rate: 0.91,
    structured_artifact_compliance_rate: 1,
    clarification_compliance_rate: 1,
    merge_conflict_rate_per_titan: 0.18,
    merge_queue_latency_ms: 120000,
    rework_loops_per_issue: 0.27,
    janus_invocation_rate_per_10_issues: 1.8,
    janus_success_rate: 1,
    messaging_token_overhead: 0.11,
    human_interventions_per_10_issues: 1.4,
    cost_per_completed_issue_usd: 2.75,
    restart_recovery_success_rate: 1,
    ...overrides,
  };
}

function findCheck(
  report: ReturnType<typeof createPendingReleaseGateReport>,
  id: (typeof RELEASE_GATE_CHECK_IDS)[number],
) {
  const check = report.checks.find((candidate) => candidate.id === id);

  expect(check).toBeDefined();

  return check!;
}

describe("S16B contract seed - release gate", () => {
  it("defines the PRD release-threshold defaults without evaluating them yet", () => {
    expect(DEFAULT_RELEASE_GATE_THRESHOLDS).toEqual({
      structured_artifact_compliance_rate_min: 1,
      clarification_compliance_rate_min: 1,
      restart_recovery_success_rate_min: 1,
      direct_to_main_bypass_count_max: 0,
      issue_completion_rate_min: 0.8,
      human_interventions_per_10_issues_max: 2,
      janus_invocation_rate_per_10_issues_max: 5,
    });
  });

  it("creates a pending release report scaffold with one check per PRD gate", () => {
    const report = createPendingReleaseGateReport({
      generatedAt: "2026-04-08T19:30:00.000Z",
      artifacts: loadArtifactCatalog(),
      metrics: createEmptyReleaseMetrics(),
    });

    expect(report.generated_at).toBe("2026-04-08T19:30:00.000Z");
    expect(report.overall_status).toBe("pending");
    expect(report.checklist_path).toBe(MVP_RELEASE_CHECKLIST_PATH);
    expect(report.checks.map((check) => check.id)).toEqual(RELEASE_GATE_CHECK_IDS);

    for (const check of report.checks) {
      expect(check.status).toBe("pending");
      expect(check.metric_value).toBeNull();
      expect(check.evidence.map((evidence) => evidence.scenario_id)).toEqual(
        expectedEvidenceByCheck[check.id],
      );
    }
  });

  it("documents the static release checklist that the gate report will reference", () => {
    const checklistPath = path.join(repoRoot, MVP_RELEASE_CHECKLIST_PATH);
    const checklist = fs.readFileSync(checklistPath, "utf8");

    expect(checklist).toContain("evals/scenarios/mvp-gate.json");

    for (const checkId of RELEASE_GATE_CHECK_IDS) {
      expect(checklist).toContain(`\`${checkId}\``);
    }
  });

  it("evaluates aggregated metrics into a passing release report with evidence links", () => {
    const metrics = makeReleaseMetrics();
    const report = createReleaseGateReport({
      generatedAt: "2026-04-08T20:00:00.000Z",
      artifacts: loadArtifactCatalog(),
      metrics,
    });

    expect(report.generated_at).toBe("2026-04-08T20:00:00.000Z");
    expect(report.overall_status).toBe("pass");
    expect(report.metrics).toEqual(metrics);

    for (const check of report.checks) {
      expect(check.status).toBe("pass");
    }

    expect(findCheck(report, "issue_completion_rate_80pct")).toMatchObject({
      status: "pass",
      threshold_kind: "min",
      threshold_value: 0.8,
      metric_value: 0.91,
    });
    expect(findCheck(report, "janus_minority_path")).toMatchObject({
      status: "pass",
      threshold_kind: "max",
      threshold_value: 5,
      metric_value: 1.8,
    });
    expect(
      findCheck(report, "structured_artifact_compliance_100pct").evidence[0],
    ).toEqual(loadArtifactCatalog()["single-clean-issue"]);
  });

  it("marks individual gate checks as failed when aggregated metrics miss PRD thresholds", () => {
    const report = createReleaseGateReport({
      artifacts: loadArtifactCatalog(),
      metrics: makeReleaseMetrics({
        direct_to_main_bypass_count: 1,
        issue_completion_rate: 0.79,
        human_interventions_per_10_issues: 2.4,
        janus_invocation_rate_per_10_issues: 5.2,
      }),
    });

    expect(report.overall_status).toBe("fail");
    expect(findCheck(report, "structured_artifact_compliance_100pct").status).toBe(
      "pass",
    );
    expect(findCheck(report, "no_direct_to_main_bypasses")).toMatchObject({
      status: "fail",
      metric_value: 1,
      threshold_value: 0,
    });
    expect(findCheck(report, "issue_completion_rate_80pct")).toMatchObject({
      status: "fail",
      metric_value: 0.79,
      threshold_value: 0.8,
    });
    expect(
      findCheck(report, "human_interventions_within_threshold"),
    ).toMatchObject({
      status: "fail",
      metric_value: 2.4,
      threshold_value: 2,
    });
    expect(findCheck(report, "janus_minority_path")).toMatchObject({
      status: "fail",
      metric_value: 5.2,
      threshold_value: 5,
    });
  });

  it("keeps the report pending when required aggregate metrics are still missing", () => {
    const pending = createPendingReleaseGateReport({
      artifacts: loadArtifactCatalog(),
      metrics: makeReleaseMetrics({
        issue_completion_rate: null,
      }),
    });
    const evaluated = evaluateReleaseGateReport(pending);

    expect(evaluated.overall_status).toBe("pending");
    expect(findCheck(evaluated, "issue_completion_rate_80pct")).toMatchObject({
      status: "pending",
      metric_value: null,
      threshold_value: 0.8,
    });
    expect(findCheck(evaluated, "structured_artifact_compliance_100pct").status).toBe(
      "pass",
    );
  });
});
