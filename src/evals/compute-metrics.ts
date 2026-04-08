import {
  MVP_GATE_SCENARIO_IDS,
  type MvpScenarioId,
} from "./wire-mvp-scenarios.js";

export const RELEASE_METRIC_KEYS = [
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
] as const;

export type ReleaseMetricKey = (typeof RELEASE_METRIC_KEYS)[number];

export interface ReleaseScenarioArtifact {
  scenario_id: MvpScenarioId;
  result_path: string;
  summary_path: string | null;
}

export type ReleaseArtifactCatalog = Record<MvpScenarioId, ReleaseScenarioArtifact>;

export type ReleaseMetricValue = number | null;

export type ReleaseMetrics = Record<ReleaseMetricKey, ReleaseMetricValue> & {
  scenario_count: number;
  direct_to_main_bypass_count: number | null;
};

export function createEmptyReleaseMetrics(): ReleaseMetrics {
  return {
    scenario_count: 0,
    direct_to_main_bypass_count: null,
    issue_completion_rate: null,
    structured_artifact_compliance_rate: null,
    clarification_compliance_rate: null,
    merge_conflict_rate_per_titan: null,
    merge_queue_latency_ms: null,
    rework_loops_per_issue: null,
    janus_invocation_rate_per_10_issues: null,
    janus_success_rate: null,
    messaging_token_overhead: null,
    human_interventions_per_10_issues: null,
    cost_per_completed_issue_usd: null,
    restart_recovery_success_rate: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateScenarioArtifact(
  scenarioId: MvpScenarioId,
  artifact: unknown,
): ReleaseScenarioArtifact {
  if (!isRecord(artifact)) {
    throw new Error(`Release artifact for ${scenarioId} must be an object`);
  }

  if (artifact["scenario_id"] !== scenarioId) {
    throw new Error(
      `Release artifact for ${scenarioId} must declare scenario_id ${scenarioId}`,
    );
  }

  if (
    typeof artifact["result_path"] !== "string"
    || artifact["result_path"].length === 0
  ) {
    throw new Error(`Release artifact for ${scenarioId} must include result_path`);
  }

  if (
    artifact["summary_path"] !== null
    && (
      typeof artifact["summary_path"] !== "string"
      || artifact["summary_path"].length === 0
    )
  ) {
    throw new Error(
      `Release artifact for ${scenarioId} must include summary_path or null`,
    );
  }

  return {
    scenario_id: scenarioId,
    result_path: artifact["result_path"],
    summary_path: artifact["summary_path"],
  };
}

export function normalizeReleaseArtifactCatalog(
  catalog: Partial<Record<MvpScenarioId, ReleaseScenarioArtifact>>,
): ReleaseScenarioArtifact[] {
  return MVP_GATE_SCENARIO_IDS.map((scenarioId) => {
    const artifact = catalog[scenarioId];

    if (!artifact) {
      throw new Error(
        `Release artifact catalog must include scenario ${scenarioId}`,
      );
    }

    return validateScenarioArtifact(scenarioId, artifact);
  });
}
