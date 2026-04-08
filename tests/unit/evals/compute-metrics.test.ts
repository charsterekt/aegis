import path from "node:path";
import fs from "node:fs";

import { describe, expect, it } from "vitest";

import {
  RELEASE_METRIC_KEYS,
  createEmptyReleaseMetrics,
  normalizeReleaseArtifactCatalog,
  type ReleaseArtifactCatalog,
} from "../../../src/evals/compute-metrics.js";
import { MVP_GATE_SCENARIO_IDS } from "../../../src/evals/wire-mvp-scenarios.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const fixturePath = path.join(
  repoRoot,
  "tests",
  "fixtures",
  "evals",
  "release-gate-contract.json",
);

function loadArtifactCatalog(): ReleaseArtifactCatalog {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
    artifacts: ReleaseArtifactCatalog;
  };

  return fixture.artifacts;
}

describe("S16B contract seed - compute-metrics", () => {
  it("exports the canonical release metric key set from SPECv2 section 24.7", () => {
    expect(RELEASE_METRIC_KEYS).toEqual([
      "issue_completion_rate",
      "structured_artifact_compliance_rate",
      "clarification_compliance_rate",
      "merge_conflict_rate_per_titan",
      "merge_queue_latency_ms",
      "rework_loops_per_issue",
      "janus_invocation_rate_per_10_issues",
      "janus_success_rate",
      "messaging_token_overhead",
      "human_interventions_per_10_issues",
      "cost_per_completed_issue_usd",
      "restart_recovery_success_rate",
    ]);
  });

  it("creates an empty release-metrics scaffold without precomputing any lane-owned values", () => {
    const metrics = createEmptyReleaseMetrics();

    expect(metrics.scenario_count).toBe(0);
    expect(metrics.direct_to_main_bypass_count).toBeNull();

    for (const metricKey of RELEASE_METRIC_KEYS) {
      expect(metrics[metricKey]).toBeNull();
    }
  });

  it("normalizes a full release artifact catalog into canonical MVP scenario order", () => {
    const orderedArtifacts = normalizeReleaseArtifactCatalog(loadArtifactCatalog());

    expect(orderedArtifacts.map((artifact) => artifact.scenario_id)).toEqual(
      MVP_GATE_SCENARIO_IDS,
    );
  });

  it("rejects artifact catalogs that do not cover the full MVP release suite", () => {
    const incompleteCatalog = { ...loadArtifactCatalog() };
    delete incompleteCatalog["polling-only"];

    expect(() => normalizeReleaseArtifactCatalog(incompleteCatalog)).toThrow(
      /polling-only/i,
    );
  });

  it.todo(
    "computes aggregate release metrics from the full MVP suite without depending on gate evaluation logic",
  );
});
