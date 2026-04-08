import {
  type ReleaseArtifactCatalog,
  type ReleaseMetrics,
  createEmptyReleaseMetrics,
  normalizeReleaseArtifactCatalog,
} from "./compute-metrics.js";
import type { MvpScenarioId } from "./wire-mvp-scenarios.js";

export const MVP_RELEASE_CHECKLIST_PATH = "docs/mvp-release-checklist.md" as const;

export const RELEASE_GATE_CHECK_IDS = [
  "structured_artifact_compliance_100pct",
  "clarification_compliance_100pct",
  "restart_recovery_100pct",
  "no_direct_to_main_bypasses",
  "issue_completion_rate_80pct",
  "human_interventions_within_threshold",
  "janus_minority_path",
] as const;

export type ReleaseGateCheckId = (typeof RELEASE_GATE_CHECK_IDS)[number];

export interface ReleaseGateThresholds {
  structured_artifact_compliance_rate_min: number;
  clarification_compliance_rate_min: number;
  restart_recovery_success_rate_min: number;
  direct_to_main_bypass_count_max: number;
  issue_completion_rate_min: number;
  human_interventions_per_10_issues_max: number;
  janus_invocation_rate_per_10_issues_max: number;
}

export const DEFAULT_RELEASE_GATE_THRESHOLDS = {
  structured_artifact_compliance_rate_min: 1,
  clarification_compliance_rate_min: 1,
  restart_recovery_success_rate_min: 1,
  direct_to_main_bypass_count_max: 0,
  issue_completion_rate_min: 0.8,
  human_interventions_per_10_issues_max: 2,
  janus_invocation_rate_per_10_issues_max: 5,
} as const satisfies ReleaseGateThresholds;

export type ReleaseGateStatus = "pending" | "pass" | "fail";

export interface ReleaseEvidenceLink {
  scenario_id: MvpScenarioId;
  result_path: string;
  summary_path: string | null;
}

export interface ReleaseGateCheck {
  id: ReleaseGateCheckId;
  label: string;
  metric_key:
    | keyof ReleaseMetrics
    | "direct_to_main_bypass_count";
  threshold_kind: "min" | "max";
  threshold_value: number;
  status: ReleaseGateStatus;
  metric_value: number | null;
  evidence: ReleaseEvidenceLink[];
}

export interface ReleaseGateReport {
  generated_at: string | null;
  overall_status: ReleaseGateStatus;
  checklist_path: string;
  thresholds: ReleaseGateThresholds;
  metrics: ReleaseMetrics;
  checks: ReleaseGateCheck[];
}

const CHECK_LABELS: Record<ReleaseGateCheckId, string> = {
  structured_artifact_compliance_100pct:
    "Structured artifact compliance is 100%.",
  clarification_compliance_100pct:
    "Clarification compliance is 100% on intentionally ambiguous scenarios.",
  restart_recovery_100pct:
    "Restart recovery succeeds on every designated restart scenario.",
  no_direct_to_main_bypasses:
    "No scenario bypasses the merge queue and lands directly on main.",
  issue_completion_rate_80pct:
    "Issue completion rate is at least 80% across the MVP suite.",
  human_interventions_within_threshold:
    "Human interventions stay at or below 2 per 10 completed issues.",
  janus_minority_path:
    "Janus remains a minority path across the MVP suite.",
};

const CHECK_EVIDENCE_SCENARIOS: Record<
  ReleaseGateCheckId,
  readonly MvpScenarioId[]
> = {
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
};

const CHECK_METRIC_KEYS: Record<
  ReleaseGateCheckId,
  keyof ReleaseMetrics
> = {
  structured_artifact_compliance_100pct:
    "structured_artifact_compliance_rate",
  clarification_compliance_100pct: "clarification_compliance_rate",
  restart_recovery_100pct: "restart_recovery_success_rate",
  no_direct_to_main_bypasses: "direct_to_main_bypass_count",
  issue_completion_rate_80pct: "issue_completion_rate",
  human_interventions_within_threshold:
    "human_interventions_per_10_issues",
  janus_minority_path: "janus_invocation_rate_per_10_issues",
};

const CHECK_THRESHOLD_KINDS: Record<
  ReleaseGateCheckId,
  "min" | "max"
> = {
  structured_artifact_compliance_100pct: "min",
  clarification_compliance_100pct: "min",
  restart_recovery_100pct: "min",
  no_direct_to_main_bypasses: "max",
  issue_completion_rate_80pct: "min",
  human_interventions_within_threshold: "max",
  janus_minority_path: "max",
};

function getThresholdValue(
  checkId: ReleaseGateCheckId,
  thresholds: ReleaseGateThresholds,
): number {
  switch (checkId) {
    case "structured_artifact_compliance_100pct":
      return thresholds.structured_artifact_compliance_rate_min;
    case "clarification_compliance_100pct":
      return thresholds.clarification_compliance_rate_min;
    case "restart_recovery_100pct":
      return thresholds.restart_recovery_success_rate_min;
    case "no_direct_to_main_bypasses":
      return thresholds.direct_to_main_bypass_count_max;
    case "issue_completion_rate_80pct":
      return thresholds.issue_completion_rate_min;
    case "human_interventions_within_threshold":
      return thresholds.human_interventions_per_10_issues_max;
    case "janus_minority_path":
      return thresholds.janus_invocation_rate_per_10_issues_max;
  }
}

function buildEvidence(
  checkId: ReleaseGateCheckId,
  artifacts: ReleaseArtifactCatalog,
): ReleaseEvidenceLink[] {
  return CHECK_EVIDENCE_SCENARIOS[checkId].map((scenarioId) => {
    const artifact = artifacts[scenarioId];
    return {
      scenario_id: artifact.scenario_id,
      result_path: artifact.result_path,
      summary_path: artifact.summary_path,
    };
  });
}

export interface CreatePendingReleaseGateReportOptions {
  generatedAt?: string | null;
  checklistPath?: string;
  thresholds?: ReleaseGateThresholds;
  metrics?: ReleaseMetrics;
  artifacts: Partial<ReleaseArtifactCatalog>;
}

export function createPendingReleaseGateReport(
  options: CreatePendingReleaseGateReportOptions,
): ReleaseGateReport {
  const normalizedArtifacts = normalizeReleaseArtifactCatalog(options.artifacts);
  const artifacts = Object.fromEntries(
    normalizedArtifacts.map((artifact) => [artifact.scenario_id, artifact]),
  ) as ReleaseArtifactCatalog;
  const thresholds = options.thresholds ?? DEFAULT_RELEASE_GATE_THRESHOLDS;
  const metrics = options.metrics ?? createEmptyReleaseMetrics();

  const checks = RELEASE_GATE_CHECK_IDS.map((checkId) => {
    const metricKey = CHECK_METRIC_KEYS[checkId];

    return {
      id: checkId,
      label: CHECK_LABELS[checkId],
      metric_key: metricKey,
      threshold_kind: CHECK_THRESHOLD_KINDS[checkId],
      threshold_value: getThresholdValue(checkId, thresholds),
      status: "pending" as const,
      metric_value: metrics[metricKey],
      evidence: buildEvidence(checkId, artifacts),
    };
  });

  return {
    generated_at: options.generatedAt ?? null,
    overall_status: "pending",
    checklist_path: options.checklistPath ?? MVP_RELEASE_CHECKLIST_PATH,
    thresholds,
    metrics,
    checks,
  };
}
