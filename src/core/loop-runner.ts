import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadConfig } from "../config/load-config.js";
import { loadDispatchState, saveDispatchState } from "./dispatch-state.js";
import { dispatchReadyWork } from "./dispatcher.js";
import { monitorActiveWork } from "./monitor.js";
import { pollReadyWork } from "./poller.js";
import { reapFinishedWork } from "./reaper.js";
import { triageReadyWork } from "./triage.js";
import { createTrackerClient } from "../tracker/create-tracker.js";
import type { AgentRuntime } from "../runtime/agent-runtime.js";
import { createAgentRuntime } from "../runtime/scripted-agent-runtime.js";
import { createCasteRuntime } from "../runtime/create-caste-runtime.js";
import { writePhaseLog } from "./phase-log.js";
import { autoEnqueueImplementedIssuesForMerge } from "../merge/auto-enqueue.js";
import { runCasteCommand } from "./caste-runner.js";
import {
  calculateFailureCooldown,
  resolveFailureWindowStartMs,
} from "./failure-policy.js";
import { parseSentinelVerdict } from "../castes/sentinel/sentinel-parser.js";
import { parseTitanArtifact } from "../castes/titan/titan-parser.js";
import { applyScopeExpansion } from "./control-plane-policy.js";

export type LoopPhase = "poll" | "dispatch" | "monitor" | "reap";

export interface LoopPhaseResult {
  phase: LoopPhase;
  readyIssueIds?: string[];
  dispatched?: string[];
  skipped?: Array<{ issueId: string; reason: string }>;
  warnings?: string[];
  killList?: string[];
  readyToReap?: string[];
  completed?: string[];
  failed?: string[];
}

export interface RunLoopPhaseOptions {
  runtime?: AgentRuntime;
  sessionProvenanceId?: string;
  launchPreMergeReview?: (input: {
    root: string;
    issueId: string;
    timestamp: string;
  }) => Promise<void>;
}

const ACTIVE_PRE_MERGE_REVIEWS = new Set<string>();
const TRACKER_CLOSED_RECOVERY_STAGES = new Set([
  "rework_required",
  "blocked_on_child",
  "failed_operational",
]);

function createDefaultRuntime(root: string) {
  const config = loadConfig(root);
  return createAgentRuntime(config.runtime);
}

interface DispatchPipelineResult {
  dispatchState: ReturnType<typeof loadDispatchState>;
  readyIssueIds: string[];
  dispatched: string[];
  skipped: Array<{ issueId: string; reason: string }>;
  failed: string[];
}

function readPolicyArtifact(root: string, artifactRef: string | null | undefined) {
  if (!artifactRef) {
    return null;
  }

  const artifactPath = path.join(root, artifactRef);
  if (!existsSync(artifactPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(artifactPath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isResolvedPolicyBlockerReady(input: {
  root: string;
  readyIssueIds: Set<string>;
  record: ReturnType<typeof loadDispatchState>["records"][string];
}) {
  const { record } = input;
  if (
    record.stage !== "blocked_on_child"
    && record.stage !== "failed_operational"
    || !input.readyIssueIds.has(record.issueId)
    || !record.blockedByIssueId
    || !record.policyArtifactRef
  ) {
    return false;
  }

  const artifact = readPolicyArtifact(input.root, record.policyArtifactRef);
  return artifact?.["outcome"] !== "rejected"
    && artifact?.["childIssueId"] === record.blockedByIssueId;
}

function isRejectedBlockerChainReady(input: {
  root: string;
  readyIssueIds: Set<string>;
  record: ReturnType<typeof loadDispatchState>["records"][string];
}) {
  const { record } = input;
  if (
    record.runningAgent
    || !input.readyIssueIds.has(record.issueId)
    || !record.policyArtifactRef
  ) {
    return false;
  }

  const artifact = readPolicyArtifact(input.root, record.policyArtifactRef);
  return artifact?.["outcome"] === "rejected"
    && artifact?.["rejectionReason"] === "blocker_chain_not_allowed";
}

function toFreshScoutRecord(
  record: ReturnType<typeof loadDispatchState>["records"][string],
  timestamp: string,
) {
  return {
    ...record,
    stage: "pending" as const,
    runningAgent: null,
    blockedByIssueId: null,
    policyArtifactRef: null,
    oracleAssessmentRef: null,
    oracleReady: null,
    oracleDecompose: null,
    oracleBlockers: null,
    fileScope: null,
    reviewFeedbackRef: null,
    titanHandoffRef: null,
    titanClarificationRef: null,
    sentinelVerdictRef: null,
    janusArtifactRef: null,
    cooldownUntil: null,
    updatedAt: timestamp,
  };
}

function recoverResolvedPolicyBlockedParents(input: {
  root: string;
  dispatchState: ReturnType<typeof loadDispatchState>;
  readyIssueIds: string[];
  timestamp: string;
}) {
  const readyIssueIds = new Set(input.readyIssueIds);
  let changed = false;
  const records = Object.fromEntries(
    Object.entries(input.dispatchState.records).map(([issueId, record]) => {
      if (!isResolvedPolicyBlockerReady({
        root: input.root,
        readyIssueIds,
        record,
      }) && !isRejectedBlockerChainReady({
        root: input.root,
        readyIssueIds,
        record,
      })) {
        return [issueId, record];
      }

      changed = true;
      writePhaseLog(input.root, {
        timestamp: input.timestamp,
        phase: "triage",
        issueId,
        action: "resolved_policy_blocker_recovered",
        outcome: "implemented",
        detail: JSON.stringify({
          blockedByIssueId: record.blockedByIssueId,
          policyArtifactRef: record.policyArtifactRef,
          nextStage: "pending",
        }),
      });

      return [issueId, toFreshScoutRecord(record, input.timestamp)];
    }),
  );

  return {
    changed,
    state: changed
      ? {
          schemaVersion: input.dispatchState.schemaVersion,
          records,
        }
      : input.dispatchState,
  };
}

async function recoverClosedTrackerRecords(input: {
  root: string;
  tracker: ReturnType<typeof createTrackerClient>;
  dispatchState: ReturnType<typeof loadDispatchState>;
  timestamp: string;
}) {
  let changed = false;
  const records = { ...input.dispatchState.records };

  for (const [issueId, record] of Object.entries(input.dispatchState.records)) {
    if (
      record.runningAgent !== null
      || !TRACKER_CLOSED_RECOVERY_STAGES.has(record.stage)
    ) {
      continue;
    }

    let issueStatus: string;
    try {
      issueStatus = (await input.tracker.getIssue(issueId, input.root)).status;
    } catch {
      continue;
    }

    if (issueStatus !== "closed") {
      continue;
    }

    changed = true;
    records[issueId] = {
      ...record,
      stage: "complete",
      runningAgent: null,
      cooldownUntil: null,
      updatedAt: input.timestamp,
    };
    writePhaseLog(input.root, {
      timestamp: input.timestamp,
      phase: "dispatch",
      issueId,
      action: "closed_tracker_record_recovered",
      outcome: "complete",
      detail: JSON.stringify({ trackerStatus: issueStatus }),
    });
  }

  return {
    changed,
    state: changed
      ? {
          schemaVersion: input.dispatchState.schemaVersion,
          records,
        }
      : input.dispatchState,
  };
}

async function runDispatchPipeline(
  root: string,
  runtime: AgentRuntime,
  sessionProvenanceId: string,
  timestamp: string,
): Promise<DispatchPipelineResult> {
  const config = loadConfig(root);
  const tracker = createTrackerClient();
  let dispatchState = loadDispatchState(root);
  const snapshot = await pollReadyWork({
    dispatchState,
    tracker,
    root,
  });

  writePhaseLog(root, {
    timestamp,
    phase: "poll",
    issueId: "_all",
    action: "poll_ready_work",
    outcome: "ok",
    detail: snapshot.readyIssues.map((issue) => issue.id).join(","),
  });

  const recoveredClosedRecords = await recoverClosedTrackerRecords({
    root,
    tracker,
    dispatchState,
    timestamp,
  });
  dispatchState = recoveredClosedRecords.state;
  if (recoveredClosedRecords.changed) {
    saveDispatchState(root, dispatchState);
  }

  const recoveredBlockedParents = recoverResolvedPolicyBlockedParents({
    root,
    dispatchState,
    readyIssueIds: snapshot.readyIssues.map((issue) => issue.id),
    timestamp,
  });
  dispatchState = recoveredBlockedParents.state;
  if (recoveredBlockedParents.changed) {
    saveDispatchState(root, dispatchState);
  }

  const recoveredPolicyChildScopes = await recoverFailedPolicyBlockerScopeRecords({
    root,
    tracker,
    dispatchState,
    readyIssueIds: snapshot.readyIssues.map((issue) => issue.id),
    timestamp,
  });
  dispatchState = recoveredPolicyChildScopes.state;
  if (recoveredPolicyChildScopes.changed) {
    saveDispatchState(root, dispatchState);
  }

  const recoveredDirtyTitanWork = recoverDirtyFailedTitanRecords({
    root,
    dispatchState,
    readyIssueIds: snapshot.readyIssues.map((issue) => issue.id),
    timestamp,
  });
  dispatchState = recoveredDirtyTitanWork.state;
  if (recoveredDirtyTitanWork.changed) {
    saveDispatchState(root, dispatchState);
  }

  const recoveredTitanIssues = snapshot.readyIssues
    .map((issue) => issue.id)
    .filter((issueId) => recoverFailedTitanRecord(root, issueId, timestamp));
  if (recoveredTitanIssues.length > 0) {
    dispatchState = loadDispatchState(root);
  }

  const triage = triageReadyWork({
    readyIssues: snapshot.readyIssues,
    dispatchState,
    config,
    now: timestamp,
  });

  writePhaseLog(root, {
    timestamp,
    phase: "triage",
    issueId: "_all",
    action: "triage_ready_work",
    outcome: "ok",
    detail: triage.dispatchable.map((item) => item.issueId).join(","),
  });

  const dispatchResult = await dispatchReadyWork({
    dispatchState,
    decisions: triage.dispatchable,
    runtime,
    root,
    sessionProvenanceId,
    now: timestamp,
  });
  saveDispatchState(root, dispatchResult.state);

  return {
    dispatchState: dispatchResult.state,
    readyIssueIds: snapshot.readyIssues.map((issue) => issue.id),
    dispatched: dispatchResult.dispatched,
    skipped: triage.skipped,
    failed: dispatchResult.failed,
  };
}

async function runMonitorPipeline(
  root: string,
  runtime: AgentRuntime,
  timestamp: string,
  dispatchState = loadDispatchState(root),
) {
  const config = loadConfig(root);

  return monitorActiveWork({
    dispatchState,
    runtime,
    thresholds: {
      stuck_warning_seconds: config.thresholds.stuck_warning_seconds,
      stuck_kill_seconds: config.thresholds.stuck_kill_seconds,
    },
    root,
    now: timestamp,
  });
}

async function runReapPipeline(
  root: string,
  runtime: AgentRuntime,
  timestamp: string,
  issueIds: string[],
  dispatchState = loadDispatchState(root),
) {
  const reapResult = await reapFinishedWork({
    dispatchState,
    runtime,
    issueIds,
    root,
    now: timestamp,
  });
  saveDispatchState(root, reapResult.state);
  return reapResult;
}

function markRecordReviewing(root: string, issueId: string, timestamp: string) {
  const dispatchState = loadDispatchState(root);
  const record = dispatchState.records[issueId];
  if (!record || (record.stage !== "implemented" && record.stage !== "reviewing")) {
    return false;
  }

  saveDispatchState(root, {
    schemaVersion: dispatchState.schemaVersion,
    records: {
      ...dispatchState.records,
      [issueId]: {
        ...record,
        stage: "reviewing",
        updatedAt: timestamp,
      },
    },
  });

  return true;
}

function markRecordReviewingWithAgent(input: {
  root: string;
  issueId: string;
  timestamp: string;
  sessionProvenanceId: string;
  sessionId: string;
  startedAt: string;
}) {
  const dispatchState = loadDispatchState(input.root);
  const record = dispatchState.records[input.issueId];
  if (!record || (record.stage !== "implemented" && record.stage !== "reviewing")) {
    return false;
  }

  saveDispatchState(input.root, {
    schemaVersion: dispatchState.schemaVersion,
    records: {
      ...dispatchState.records,
      [input.issueId]: {
        ...record,
        stage: "reviewing",
        runningAgent: {
          caste: "sentinel",
          sessionId: input.sessionId,
          startedAt: input.startedAt,
        },
        cooldownUntil: null,
        sessionProvenanceId: input.sessionProvenanceId,
        updatedAt: input.timestamp,
      },
    },
  });

  return true;
}

function resolveDurableSentinelRef(root: string, issueId: string, currentRef: string | null) {
  const candidates = [
    currentRef,
    path.join(".aegis", "sentinel", `${issueId}.json`),
  ].filter((entry): entry is string => entry !== null);

  return candidates.find((candidate) => existsSync(path.join(root, candidate))) ?? null;
}

function readDurableSentinelVerdict(root: string, artifactRef: string) {
  const payload = JSON.parse(readFileSync(path.join(root, artifactRef), "utf8")) as Record<string, unknown>;

  return parseSentinelVerdict(JSON.stringify({
    verdict: payload["verdict"],
    reviewSummary: payload["reviewSummary"],
    blockingFindings: payload["blockingFindings"],
    advisories: payload["advisories"],
    touchedFiles: payload["touchedFiles"],
    contractChecks: payload["contractChecks"],
  }));
}

function recoverReviewingRecord(root: string, issueId: string, timestamp: string) {
  const dispatchState = loadDispatchState(root);
  const record = dispatchState.records[issueId];
  if (!record || record.stage !== "reviewing") {
    return false;
  }

  const sentinelVerdictRef = resolveDurableSentinelRef(root, issueId, record.sentinelVerdictRef);
  if (!sentinelVerdictRef) {
    return false;
  }

  const verdict = readDurableSentinelVerdict(root, sentinelVerdictRef);
  const reviewStage = verdict.verdict === "pass" ? "queued_for_merge" : "rework_required";
  saveDispatchState(root, {
    schemaVersion: dispatchState.schemaVersion,
    records: {
      ...dispatchState.records,
      [issueId]: {
        ...record,
        stage: reviewStage,
        runningAgent: null,
        sentinelVerdictRef,
        reviewFeedbackRef: sentinelVerdictRef,
        updatedAt: timestamp,
      },
    },
  });

  writePhaseLog(root, {
    timestamp,
    phase: "dispatch",
    issueId,
    action: "sentinel_review_recovered",
    outcome: reviewStage,
    detail: JSON.stringify({
      blockingFindingCount: verdict.blockingFindings.length,
      advisoryCount: verdict.advisories.length,
    }),
  });

  return true;
}

function resolveDurableTitanRef(root: string, issueId: string, currentRef: string | null) {
  const candidates = [
    currentRef,
    path.join(".aegis", "titan", `${issueId}.json`),
  ].filter((entry): entry is string => entry !== null);

  return candidates.find((candidate) => existsSync(path.join(root, candidate))) ?? null;
}

function readDurableTitanArtifact(root: string, artifactRef: string) {
  const payload = JSON.parse(readFileSync(path.join(root, artifactRef), "utf8")) as Record<string, unknown>;

  return parseTitanArtifact(JSON.stringify({
    outcome: payload["outcome"],
    summary: payload["summary"],
    files_changed: payload["files_changed"],
    tests_and_checks_run: payload["tests_and_checks_run"],
    known_risks: payload["known_risks"],
    follow_up_work: payload["follow_up_work"],
    mutation_proposal: payload["mutation_proposal"],
  }));
}

function isRecoverableTitanArtifact(root: string, artifactRef: string) {
  try {
    const artifact = readDurableTitanArtifact(root, artifactRef);
    if (artifact.mutation_proposal) {
      return false;
    }

    if (artifact.outcome === "success") {
      return true;
    }

    return artifact.outcome === "already_satisfied"
      && artifact.files_changed.length === 0
      && artifact.tests_and_checks_run.length > 0;
  } catch {
    return false;
  }
}

function recoverFailedTitanRecord(root: string, issueId: string, timestamp: string) {
  const dispatchState = loadDispatchState(root);
  const record = dispatchState.records[issueId];
  if (!record || record.stage !== "failed_operational") {
    return false;
  }

  const titanHandoffRef = resolveDurableTitanRef(root, issueId, record.titanHandoffRef ?? null);
  if (!titanHandoffRef || !isRecoverableTitanArtifact(root, titanHandoffRef)) {
    return false;
  }

  saveDispatchState(root, {
    schemaVersion: dispatchState.schemaVersion,
    records: {
      ...dispatchState.records,
      [issueId]: {
        ...record,
        stage: "implemented",
        runningAgent: null,
        lastCompletedCaste: "titan",
        titanHandoffRef,
        consecutiveFailures: 0,
        cooldownUntil: null,
        updatedAt: timestamp,
      },
    },
  });

  writePhaseLog(root, {
    timestamp,
    phase: "dispatch",
    issueId,
    action: "titan_handoff_recovered",
    outcome: "implemented",
    detail: JSON.stringify({ titanHandoffRef }),
  });

  return true;
}

function normalizeScopeFile(candidate: string) {
  return candidate.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function normalizeFileScope(files: string[]) {
  const normalized = [...new Set(
    files
      .map((entry) => normalizeScopeFile(entry))
      .filter((entry) => entry.length > 0),
  )].sort();

  return normalized.length > 0 ? { files: normalized } : null;
}

function isPolicyCreatedBlockerDescription(description: string | null | undefined) {
  return typeof description === "string"
    && description.includes("Policy proposal:")
    && description.includes("Fingerprint:")
    && description.includes("Scope evidence:");
}

function readSentinelCreateBlockerFinding(root: string, ref: string | null | undefined) {
  if (!ref) {
    return null;
  }

  const artifactPath = path.join(root, ref);
  if (!existsSync(artifactPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(artifactPath, "utf8")) as Record<string, unknown>;
    const artifact = parseSentinelVerdict(JSON.stringify({
      verdict: raw["verdict"],
      reviewSummary: raw["reviewSummary"],
      blockingFindings: raw["blockingFindings"],
      advisories: raw["advisories"],
      touchedFiles: raw["touchedFiles"],
      contractChecks: raw["contractChecks"],
    }));
    return artifact.blockingFindings.find((finding) =>
      finding.route === "create_blocker" && finding.required_files.length > 0
    ) ?? null;
  } catch {
    return null;
  }
}

function fingerprintScopeExpansion(issueId: string, finding: {
  finding_kind: string;
  summary: string;
  required_files: string[];
}) {
  return `${issueId}-${finding.finding_kind}-${finding.required_files.map((entry) => normalizeScopeFile(entry)).sort().join("-")}`
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "scope-expansion";
}

function hasNewScope(current: string[], expanded: string[]) {
  const currentSet = new Set(current.map((entry) => normalizeScopeFile(entry)));
  return expanded.some((entry) => !currentSet.has(normalizeScopeFile(entry)));
}

function extractGitStatusPath(line: string) {
  const rawPath = line.length > 3 ? line.slice(3).trim() : "";
  if (rawPath.length === 0) {
    return null;
  }

  return normalizeScopeFile(
    rawPath.includes(" -> ")
      ? line.split(" -> ").at(-1)?.trim() ?? rawPath
      : rawPath,
  );
}

function readDirtyLaborFiles(laborPath: string) {
  const result = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: laborPath,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    return null;
  }

  const files = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map((line) => extractGitStatusPath(line))
    .filter((entry): entry is string => entry !== null)
    .sort();

  return files.length > 0 ? files : null;
}

async function recoverFailedPolicyBlockerScopeRecords(input: {
  root: string;
  tracker: ReturnType<typeof createTrackerClient>;
  dispatchState: ReturnType<typeof loadDispatchState>;
  readyIssueIds: string[];
  timestamp: string;
}) {
  const readyIssueIds = new Set(input.readyIssueIds);
  let changed = false;
  const records = { ...input.dispatchState.records };

  for (const [issueId, record] of Object.entries(input.dispatchState.records)) {
    if (
      !readyIssueIds.has(issueId)
      || record.stage !== "failed_operational"
      || record.runningAgent !== null
      || record.fileScope === null
      || !record.reviewFeedbackRef
    ) {
      continue;
    }

    const finding = readSentinelCreateBlockerFinding(input.root, record.reviewFeedbackRef);
    if (!finding) {
      continue;
    }

    let issueDescription: string | null;
    try {
      issueDescription = (await input.tracker.getIssue(issueId, input.root)).description;
    } catch {
      continue;
    }
    if (!isPolicyCreatedBlockerDescription(issueDescription)) {
      continue;
    }

    const expandedScope = normalizeFileScope([
      ...record.fileScope.files,
      ...finding.required_files,
    ]);
    if (!expandedScope || !hasNewScope(record.fileScope.files, expandedScope.files)) {
      continue;
    }

    const policyResult = await applyScopeExpansion({
      root: input.root,
      tracker: input.tracker,
      issueId,
      originCaste: "router",
      findingKind: finding.finding_kind,
      summary: finding.summary,
      previousScope: record.fileScope.files,
      expandedScope: expandedScope.files,
      fingerprint: fingerprintScopeExpansion(issueId, finding),
      now: input.timestamp,
    });

    changed = true;
    records[issueId] = {
      ...record,
      stage: policyResult.parentStage,
      runningAgent: null,
      blockedByIssueId: null,
      policyArtifactRef: policyResult.policyArtifactRef,
      fileScope: policyResult.fileScope,
      failureTranscriptRef: null,
      consecutiveFailures: 0,
      cooldownUntil: null,
      updatedAt: input.timestamp,
    };
    writePhaseLog(input.root, {
      timestamp: input.timestamp,
      phase: "triage",
      issueId,
      action: "policy_blocker_scope_expanded",
      outcome: "rework_required",
      detail: JSON.stringify({
        reviewFeedbackRef: record.reviewFeedbackRef,
        policyArtifactRef: policyResult.policyArtifactRef,
        expandedScope: expandedScope.files,
      }),
    });
  }

  return {
    changed,
    state: changed
      ? {
          schemaVersion: input.dispatchState.schemaVersion,
          records,
        }
      : input.dispatchState,
  };
}

function recoverDirtyFailedTitanRecords(input: {
  root: string;
  dispatchState: ReturnType<typeof loadDispatchState>;
  readyIssueIds: string[];
  timestamp: string;
}) {
  const config = loadConfig(input.root);
  const readyIssueIds = new Set(input.readyIssueIds);
  let changed = false;
  const records = Object.fromEntries(
    Object.entries(input.dispatchState.records).map(([issueId, record]) => {
      if (
        !readyIssueIds.has(issueId)
        || record.stage !== "failed_operational"
        || record.runningAgent !== null
        || record.oracleAssessmentRef === null
        || record.fileScope === null
      ) {
        return [issueId, record];
      }

      const laborPath = path.join(input.root, config.labor.base_path, issueId);
      if (!existsSync(laborPath)) {
        return [issueId, record];
      }

      const dirtyFiles = readDirtyLaborFiles(laborPath);
      const allowedFiles = new Set(record.fileScope.files.map((entry) => normalizeScopeFile(entry)));
      if (!dirtyFiles || !dirtyFiles.every((entry) => allowedFiles.has(entry))) {
        return [issueId, record];
      }

      changed = true;
      writePhaseLog(input.root, {
        timestamp: input.timestamp,
        phase: "triage",
        issueId,
        action: "dirty_titan_labor_requeued",
        outcome: "scouted",
        detail: JSON.stringify({
          dirtyFiles,
          failureTranscriptRef: record.failureTranscriptRef,
        }),
      });

      return [issueId, {
        ...record,
        stage: "scouted" as const,
        runningAgent: null,
        consecutiveFailures: 0,
        cooldownUntil: null,
        updatedAt: input.timestamp,
      }];
    }),
  );

  return {
    changed,
    state: changed
      ? {
          schemaVersion: input.dispatchState.schemaVersion,
          records,
        }
      : input.dispatchState,
  };
}

function markReviewRetryCooldown(root: string, issueId: string, timestamp: string, detail: string) {
  const dispatchState = loadDispatchState(root);
  const record = dispatchState.records[issueId];
  if (!record) {
    return;
  }

  saveDispatchState(root, {
    schemaVersion: dispatchState.schemaVersion,
    records: {
      ...dispatchState.records,
      [issueId]: {
        ...record,
        stage: "implemented",
        runningAgent: null,
        failureCount: record.failureCount + 1,
        consecutiveFailures: record.consecutiveFailures + 1,
        failureWindowStartMs: record.failureWindowStartMs
          ?? resolveFailureWindowStartMs(timestamp),
        cooldownUntil: calculateFailureCooldown(timestamp),
        updatedAt: timestamp,
      },
    },
  });

  writePhaseLog(root, {
    timestamp,
    phase: "dispatch",
    issueId,
    action: "sentinel_review_completed",
    outcome: "failed",
    detail,
  });
}

function isRecordCoolingDown(record: { cooldownUntil: string | null }, timestamp: string) {
  if (!record.cooldownUntil) {
    return false;
  }

  const cooldownMs = Date.parse(record.cooldownUntil);
  const nowMs = Date.parse(timestamp);
  return Number.isFinite(cooldownMs)
    && Number.isFinite(nowMs)
    && cooldownMs > nowMs;
}

function clearStaleImplementedReviewAgent(root: string, issueId: string, timestamp: string) {
  const dispatchState = loadDispatchState(root);
  const record = dispatchState.records[issueId];
  if (
    !record
    || record.stage !== "implemented"
    || record.runningAgent?.caste !== "sentinel"
  ) {
    return false;
  }

  saveDispatchState(root, {
    schemaVersion: dispatchState.schemaVersion,
    records: {
      ...dispatchState.records,
      [issueId]: {
        ...record,
        runningAgent: null,
        updatedAt: timestamp,
      },
    },
  });

  writePhaseLog(root, {
    timestamp,
    phase: "dispatch",
    issueId,
    action: "stale_review_agent_cleared",
    outcome: "implemented",
  });

  return true;
}

function createPreMergeReviewLauncher(
  root: string,
  launchPreMergeReview?: RunLoopPhaseOptions["launchPreMergeReview"],
) {
  if (launchPreMergeReview) {
    return launchPreMergeReview;
  }

  return async ({ issueId, timestamp }: {
    root: string;
    issueId: string;
    timestamp: string;
  }) => {
    const config = loadConfig(root);
    const tracker = createTrackerClient();
    await runCasteCommand({
      root,
      action: "review",
      issueId,
      tracker,
      runtime: createCasteRuntime(config.runtime, {}, {
        root,
        issueId,
      }),
      artifactEmissionMode: config.runtime === "pi" ? "tool" : "json",
      now: timestamp,
    });
  };
}

async function runPreMergeReviews(
  root: string,
  timestamp: string,
  runtime: AgentRuntime,
  sessionProvenanceId: string,
  launchPreMergeReview?: RunLoopPhaseOptions["launchPreMergeReview"],
): Promise<void> {
  const config = loadConfig(root);
  const initialState = loadDispatchState(root);
  let reservedAgents = 0;
  let reservedSentinels = 0;
  const activeAgentCount = Object.values(initialState.records)
    .filter((record) => record.runningAgent !== null)
    .length;
  const activeSentinelCount = Object.values(initialState.records)
    .filter((record) => record.runningAgent?.caste === "sentinel")
    .length;
  const reviewCandidates = Object.values(loadDispatchState(root).records)
    .filter((record) => (
      record.stage === "implemented" || record.stage === "reviewing"
    ) && !isRecordCoolingDown(record, timestamp));
  const launchReview = createPreMergeReviewLauncher(root, launchPreMergeReview);

  for (const record of reviewCandidates) {
    if (ACTIVE_PRE_MERGE_REVIEWS.has(record.issueId)) {
      continue;
    }
    if (recoverReviewingRecord(root, record.issueId, timestamp)) {
      continue;
    }
    if (clearStaleImplementedReviewAgent(root, record.issueId, timestamp)) {
      continue;
    }
    if (record.runningAgent) {
      continue;
    }
    if (
      activeAgentCount + reservedAgents >= config.concurrency.max_agents
      || activeSentinelCount + reservedSentinels >= config.concurrency.max_sentinels
    ) {
      continue;
    }

    ACTIVE_PRE_MERGE_REVIEWS.add(record.issueId);
    try {
      if (launchPreMergeReview) {
        if (!markRecordReviewing(root, record.issueId, timestamp)) {
          continue;
        }
        await launchReview({
          root,
          issueId: record.issueId,
          timestamp,
        });
      } else {
        const launched = await runtime.launch({
          root,
          issueId: record.issueId,
          title: record.issueId,
          caste: "sentinel",
          stage: "reviewing",
        });
        if (!markRecordReviewingWithAgent({
          root,
          issueId: record.issueId,
          timestamp,
          sessionProvenanceId,
          sessionId: launched.sessionId,
          startedAt: launched.startedAt,
        })) {
          continue;
        }
        writePhaseLog(root, {
          timestamp,
          phase: "dispatch",
          issueId: record.issueId,
          action: "launch_sentinel",
          outcome: "running",
          sessionId: launched.sessionId,
          detail: JSON.stringify({
            caste: "sentinel",
            stage: "reviewing",
          }),
          });
      }
      reservedAgents += 1;
      reservedSentinels += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      markReviewRetryCooldown(root, record.issueId, timestamp, detail);
    } finally {
      ACTIVE_PRE_MERGE_REVIEWS.delete(record.issueId);
    }
  }
}

export async function runLoopPhase(
  root = process.cwd(),
  phase: LoopPhase,
  options: RunLoopPhaseOptions = {},
): Promise<LoopPhaseResult> {
  const runtime = options.runtime ?? createDefaultRuntime(root);
  const timestamp = new Date().toISOString();
  const sessionProvenanceId = options.sessionProvenanceId ?? "direct-command";

  if (phase === "poll") {
    const snapshot = await pollReadyWork({
      dispatchState: loadDispatchState(root),
      tracker: createTrackerClient(),
      root,
    });
    writePhaseLog(root, {
      timestamp,
      phase: "poll",
      issueId: "_all",
      action: "poll_ready_work",
      outcome: "ok",
      detail: snapshot.readyIssues.map((issue) => issue.id).join(","),
    });
    return {
      phase,
      readyIssueIds: snapshot.readyIssues.map((issue) => issue.id),
    };
  }

  if (phase === "dispatch") {
    const result = await runDispatchPipeline(
      root,
      runtime,
      sessionProvenanceId,
      timestamp,
    );
    return {
      phase,
      readyIssueIds: result.readyIssueIds,
      dispatched: result.dispatched,
      skipped: result.skipped,
      failed: result.failed,
    };
  }

  if (phase === "monitor") {
    const result = await runMonitorPipeline(root, runtime, timestamp);
    return {
      phase,
      warnings: result.warnings,
      killList: result.killList,
      readyToReap: result.readyToReap,
    };
  }

  const dispatchState = loadDispatchState(root);
  const result = await runReapPipeline(
    root,
    runtime,
    timestamp,
    Object.values(dispatchState.records)
      .filter((record) => record.runningAgent !== null)
      .map((record) => record.issueId),
    dispatchState,
  );
  return {
    phase,
    completed: result.completed,
    failed: result.failed,
  };
}

export async function runDaemonCycle(
  root = process.cwd(),
  options: RunLoopPhaseOptions = {},
): Promise<void> {
  const runtime = options.runtime ?? createDefaultRuntime(root);
  const timestamp = new Date().toISOString();
  const sessionProvenanceId = options.sessionProvenanceId ?? "daemon";
  const dispatchResult = await runDispatchPipeline(
    root,
    runtime,
    sessionProvenanceId,
    timestamp,
  );

  const monitorResult = await runMonitorPipeline(
    root,
    runtime,
    timestamp,
    dispatchResult.dispatchState,
  );

  await runReapPipeline(
    root,
    runtime,
    timestamp,
    monitorResult.readyToReap,
    dispatchResult.dispatchState,
  );

  await runPreMergeReviews(
    root,
    timestamp,
    runtime,
    sessionProvenanceId,
    options.launchPreMergeReview,
  );
  autoEnqueueImplementedIssuesForMerge(root, timestamp);
}
