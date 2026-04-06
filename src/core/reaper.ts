/**
 * S10 — Reaper module.
 *
 * The Reaper finalizes the outcome of a finished session.
 * SPECv2 §9.7.
 *
 * This module defines the interface, result types, and outcome verification
 * contracts.  Implementation (actual stage transitions, labors cleanup,
 * merge-queue writes) belongs in the lanes.
 */

import type { DispatchRecord } from "./dispatch-state.js";
import { DispatchStage } from "./stage-transition.js";
import type { AgentEvent } from "../runtime/agent-events.js";
import type { MonitorEvent } from "./monitor.js";

export type SessionEndReason =
  | "completed"
  | "aborted"
  | "error"
  | "budget_exceeded"
  | "stuck_killed"
  | "monitor_aborted";

export type ReaperOutcome =
  | "success"
  | "artifact_failure"
  | "monitor_termination"
  | "crash";

export interface ArtifactVerification {
  issueId: string;
  caste: string;
  passed: boolean;
  checks: ArtifactCheck[];
}

export interface ArtifactCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface LaborCleanupInstruction {
  issueId: string;
  removeWorktree: boolean;
  deleteBranch: boolean;
  reason: string;
}

export interface MergeCandidateInstruction {
  issueId: string;
  candidateBranch: string;
  targetBranch: string;
  handoffArtifactPath: string;
}

export interface ReaperResult {
  issueId: string;
  outcome: ReaperOutcome;
  endReason: SessionEndReason;
  nextStage: DispatchStage;
  artifacts: ArtifactVerification;
  incrementFailure: boolean;
  resetFailures: boolean;
  laborCleanup: LaborCleanupInstruction | null;
  mergeCandidate: MergeCandidateInstruction | null;
  monitorEvents: MonitorEvent[];
}

export interface Reaper {
  reap(
    issueId: string,
    caste: string,
    endReason: SessionEndReason,
    events: AgentEvent[],
    currentRecord: DispatchRecord,
  ): ReaperResult;
  verifyOracleArtifacts(issueId: string, events: AgentEvent[]): ArtifactVerification;
  verifyTitanArtifacts(issueId: string, events: AgentEvent[]): ArtifactVerification;
  verifySentinelArtifacts(issueId: string, events: AgentEvent[]): ArtifactVerification;
}

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

export function computeNextStage(
  caste: string,
  outcome: ReaperOutcome,
  currentStage: DispatchStage,
  sentinelVerdict?: "pass" | "fail",
): DispatchStage {
  if (outcome !== "success") {
    return DispatchStage.Failed;
  }

  switch (caste) {
    case "oracle":
      return DispatchStage.Scouted;
    case "titan":
      return DispatchStage.Implemented;
    case "sentinel":
      return sentinelVerdict === "pass"
        ? DispatchStage.Complete
        : DispatchStage.Failed;
    default:
      return DispatchStage.Failed;
  }
}

export function determineLaborCleanup(
  caste: string,
  outcome: ReaperOutcome,
  issueId: string,
): LaborCleanupInstruction | null {
  if (caste === "oracle" || caste === "sentinel") {
    return null;
  }

  if (caste === "titan" && outcome === "success") {
    return {
      issueId,
      removeWorktree: false,
      deleteBranch: false,
      reason: "titan_success_preserve_for_merge_queue",
    };
  }

  if (caste === "titan") {
    return {
      issueId,
      removeWorktree: false,
      deleteBranch: false,
      reason: "titan_failure_preserve_for_diagnostics",
    };
  }

  return null;
}

/**
 * Minimal Reaper implementation for integration testing.
 * Verifies artifacts based on session events and produces a ReaperResult.
 */
export class ReaperImpl implements Reaper {
  reap(
    issueId: string,
    caste: string,
    endReason: SessionEndReason,
    events: AgentEvent[],
    currentRecord: DispatchRecord,
  ): ReaperResult {
    const artifacts = this.verifyArtifactsForCaste(issueId, caste, events);
    const outcome = this.determineOutcome(endReason, artifacts);
    const nextStage = computeNextStage(caste, outcome, currentRecord.stage);
    const laborCleanup = determineLaborCleanup(caste, outcome, issueId);

    const incrementFailure =
      outcome === "artifact_failure" ||
      outcome === "monitor_termination" ||
      outcome === "crash";

    const resetFailures = outcome === "success";

    return {
      issueId,
      outcome,
      endReason,
      nextStage,
      artifacts,
      incrementFailure,
      resetFailures,
      laborCleanup,
      mergeCandidate:
        caste === "titan" && outcome === "success"
          ? {
              issueId,
              candidateBranch: `aegis/${issueId}`,
              targetBranch: "main",
              handoffArtifactPath: `.aegis/artifacts/${issueId}/handoff.json`,
            }
          : null,
      monitorEvents: [],
    };
  }

  verifyOracleArtifacts(issueId: string, events: AgentEvent[]): ArtifactVerification {
    return this.verifyArtifactsForCaste(issueId, "oracle", events);
  }

  verifyTitanArtifacts(issueId: string, events: AgentEvent[]): ArtifactVerification {
    return this.verifyArtifactsForCaste(issueId, "titan", events);
  }

  verifySentinelArtifacts(issueId: string, events: AgentEvent[]): ArtifactVerification {
    return this.verifyArtifactsForCaste(issueId, "sentinel", events);
  }

  private verifyArtifactsForCaste(
    issueId: string,
    caste: string,
    events: AgentEvent[],
  ): ArtifactVerification {
    const checks: ArtifactCheck[] = [];

    switch (caste) {
      case "oracle": {
        const hasAssessment = events.some(
          (e) => e.type === "message" && e.text.includes("OracleAssessment"),
        );
        checks.push({
          name: "oracle_assessment",
          passed: hasAssessment,
          detail: hasAssessment
            ? "Valid OracleAssessment found in session messages"
            : "No OracleAssessment found in session output",
        });
        break;
      }
      case "titan": {
        const hasHandoff = events.some(
          (e) => e.type === "message" && e.text.includes("TitanHandoff"),
        );
        checks.push({
          name: "titan_handoff",
          passed: hasHandoff,
          detail: hasHandoff
            ? "Valid TitanHandoff artifact found"
            : "No TitanHandoff artifact found",
        });
        break;
      }
      case "sentinel": {
        const hasVerdict = events.some(
          (e) => e.type === "message" && (e.text.includes("pass") || e.text.includes("fail")),
        );
        checks.push({
          name: "sentinel_verdict",
          passed: hasVerdict,
          detail: hasVerdict
            ? "Valid Sentinel verdict found"
            : "No Sentinel verdict found",
        });
        break;
      }
      default:
        checks.push({
          name: "unknown_caste_artifacts",
          passed: false,
          detail: `Unknown caste: ${caste}`,
        });
    }

    return {
      issueId,
      caste,
      passed: checks.every((c) => c.passed),
      checks,
    };
  }

  private determineOutcome(
    endReason: SessionEndReason,
    artifacts: ArtifactVerification,
  ): ReaperOutcome {
    switch (endReason) {
      case "completed":
        return artifacts.passed ? "success" : "artifact_failure";
      case "budget_exceeded":
      case "stuck_killed":
      case "monitor_aborted":
        return "monitor_termination";
      case "aborted":
      case "error":
        return "crash";
      default:
        return "crash";
    }
  }
}
