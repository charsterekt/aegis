import path from "node:path";
import fs from "node:fs";

import { describe, expect, it } from "vitest";

import {
  createEmptyReleaseMetrics,
  type ReleaseArtifactCatalog,
} from "../../../src/evals/compute-metrics.js";
import {
  DEFAULT_RELEASE_GATE_THRESHOLDS,
  MVP_RELEASE_CHECKLIST_PATH,
  RELEASE_GATE_CHECK_IDS,
  createPendingReleaseGateReport,
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

  it.todo(
    "evaluates the pending report into pass or fail once suite metrics and artifact evidence are available",
  );
});
