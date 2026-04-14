import { spawnSync } from "node:child_process";

import { loadConfig } from "../config/load-config.js";
import {
  loadDispatchState,
  replaceDispatchRecord,
  saveDispatchState,
  type DispatchRecord,
} from "../core/dispatch-state.js";
import { runCasteCommand } from "../core/caste-runner.js";
import { createCasteRuntime } from "../runtime/create-caste-runtime.js";
import type { CasteRuntime } from "../runtime/caste-runtime.js";
import { BeadsTrackerClient } from "../tracker/beads-tracker.js";
import type { AegisIssue } from "../tracker/issue-model.js";
import {
  findNextQueuedItem,
  loadMergeQueueState,
  saveMergeQueueState,
  updateMergeQueueItem,
  type MergeQueueItem,
} from "./merge-state.js";
import {
  classifyMergeTier,
  type MergeExecutionOutcome,
} from "./tier-policy.js";

interface TrackerLike {
  getIssue(id: string, root?: string): Promise<AegisIssue>;
}

export interface MergeExecutorResult {
  outcome: MergeExecutionOutcome;
  detail: string;
}

export interface MergeExecutor {
  execute(root: string, item: MergeQueueItem): Promise<MergeExecutorResult>;
}

export interface RunMergeNextOptions {
  executor?: MergeExecutor;
  tracker?: TrackerLike;
  runtime?: CasteRuntime;
  now?: string;
}

export interface MergeNextResult {
  action: "merge_next";
  status: "idle" | "merged" | "requeued" | "janus_requeued" | "failed";
  issueId?: string;
  queueItemId?: string;
  tier?: "T1" | "T2" | "T3";
  stage?: string;
  detail?: string;
}

class ScriptedMergeExecutor implements MergeExecutor {
  async execute(_root: string, _item: MergeQueueItem): Promise<MergeExecutorResult> {
    return {
      outcome: "merged",
      detail: "Deterministic scripted merge succeeded.",
    };
  }
}

function runGit(root: string, args: string[]) {
  return spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
}

class GitMergeExecutor implements MergeExecutor {
  async execute(root: string, item: MergeQueueItem): Promise<MergeExecutorResult> {
    const targetProbe = runGit(root, ["rev-parse", "--verify", item.targetBranch]);
    if (targetProbe.status !== 0) {
      return {
        outcome: "stale_branch",
        detail: `Missing target branch ${item.targetBranch}.`,
      };
    }

    const candidateProbe = runGit(root, ["rev-parse", "--verify", item.candidateBranch]);
    if (candidateProbe.status !== 0) {
      return {
        outcome: "stale_branch",
        detail: `Missing candidate branch ${item.candidateBranch}.`,
      };
    }

    const checkout = runGit(root, ["checkout", item.targetBranch]);
    if (checkout.status !== 0) {
      const detail = `${checkout.stdout ?? ""}${checkout.stderr ?? ""}`.trim();
      return {
        outcome: "stale_branch",
        detail: detail.length > 0 ? detail : `Failed to checkout ${item.targetBranch}.`,
      };
    }

    const merge = runGit(root, ["merge", "--no-ff", "--no-edit", item.candidateBranch]);
    if (merge.status === 0) {
      return {
        outcome: "merged",
        detail: `${merge.stdout ?? ""}${merge.stderr ?? ""}`.trim() || "Merged cleanly.",
      };
    }

    void runGit(root, ["merge", "--abort"]);
    const detail = `${merge.stdout ?? ""}${merge.stderr ?? ""}`.trim() || "Merge failed.";
    return {
      outcome: /CONFLICT/i.test(detail) ? "conflict" : "stale_branch",
      detail,
    };
  }
}

function createDefaultExecutor(root: string): MergeExecutor {
  const config = loadConfig(root);
  return config.runtime === "scripted"
    ? new ScriptedMergeExecutor()
    : new GitMergeExecutor();
}

function createDefaultTracker(): TrackerLike {
  return new BeadsTrackerClient();
}

function createDefaultRuntime(root: string, issueId: string): CasteRuntime {
  return createCasteRuntime(loadConfig(root).runtime, {}, { root, issueId });
}

function updateDispatchStage(
  root: string,
  issueId: string,
  record: DispatchRecord,
  stage: string,
  now: string,
) {
  const state = loadDispatchState(root);
  const nextState = replaceDispatchRecord(state, issueId, {
    ...record,
    stage,
    updatedAt: now,
  });
  saveDispatchState(root, nextState);
  return nextState.records[issueId]!;
}

export async function runMergeNext(
  root: string,
  options: RunMergeNextOptions = {},
): Promise<MergeNextResult> {
  const now = options.now ?? new Date().toISOString();
  const queueState = loadMergeQueueState(root);
  const queueItem = findNextQueuedItem(queueState);

  if (!queueItem) {
    return {
      action: "merge_next",
      status: "idle",
      stage: "idle",
    };
  }

  const dispatchState = loadDispatchState(root);
  const dispatchRecord = dispatchState.records[queueItem.issueId];
  if (!dispatchRecord) {
    throw new Error(`Merge queue item ${queueItem.queueItemId} has no dispatch record.`);
  }

  const executor = options.executor ?? createDefaultExecutor(root);
  const tracker = options.tracker ?? createDefaultTracker();
  const runtime = options.runtime ?? createDefaultRuntime(root, queueItem.issueId);

  const mergingQueueState = updateMergeQueueItem(queueState, queueItem.queueItemId, (item) => ({
    ...item,
    status: "merging",
    updatedAt: now,
  }));
  saveMergeQueueState(root, mergingQueueState);
  updateDispatchStage(root, queueItem.issueId, dispatchRecord, "merging", now);

  const attempt = await executor.execute(root, queueItem);
  const decision = classifyMergeTier({
    outcome: attempt.outcome,
    attempts: queueItem.attempts,
    janusRetryThreshold: loadConfig(root).thresholds.janus_retry_threshold,
    janusEnabled: loadConfig(root).janus.enabled,
    janusInvocations: queueItem.janusInvocations,
    maxJanusInvocations: loadConfig(root).janus.max_invocations_per_issue,
  });

  if (decision.action === "merge") {
    const mergedQueueState = updateMergeQueueItem(mergingQueueState, queueItem.queueItemId, (item) => ({
      ...item,
      status: "merged",
      lastTier: "T1",
      lastError: null,
      updatedAt: now,
    }));
    saveMergeQueueState(root, mergedQueueState);
    updateDispatchStage(root, queueItem.issueId, dispatchRecord, "merged", now);

    const review = await runCasteCommand({
      root,
      action: "review",
      issueId: queueItem.issueId,
      tracker,
      runtime,
      now,
    });

    return {
      action: "merge_next",
      status: review.stage === "reviewed" ? "merged" : "failed",
      issueId: queueItem.issueId,
      queueItemId: queueItem.queueItemId,
      tier: "T1",
      stage: review.stage,
      detail: attempt.detail,
    };
  }

  if (decision.action === "requeue") {
    const requeuedState = updateMergeQueueItem(mergingQueueState, queueItem.queueItemId, (item) => ({
      ...item,
      status: "queued",
      attempts: item.attempts + 1,
      lastTier: "T2",
      lastError: attempt.detail,
      updatedAt: now,
    }));
    saveMergeQueueState(root, requeuedState);
    updateDispatchStage(root, queueItem.issueId, dispatchRecord, "queued_for_merge", now);

    return {
      action: "merge_next",
      status: "requeued",
      issueId: queueItem.issueId,
      queueItemId: queueItem.queueItemId,
      tier: "T2",
      stage: "queued_for_merge",
      detail: attempt.detail,
    };
  }

  if (decision.action === "janus") {
    updateDispatchStage(root, queueItem.issueId, dispatchRecord, "resolving_integration", now);
    const janus = await runCasteCommand({
      root,
      action: "process",
      issueId: queueItem.issueId,
      tracker,
      runtime,
      now,
    });
    const requeued = janus.stage === "queued_for_merge";
    const afterJanusState = updateMergeQueueItem(mergingQueueState, queueItem.queueItemId, (item) => ({
      ...item,
      status: requeued ? "queued" : "failed",
      attempts: item.attempts + 1,
      janusInvocations: item.janusInvocations + 1,
      lastTier: "T3",
      lastError: requeued ? null : attempt.detail,
      updatedAt: now,
    }));
    saveMergeQueueState(root, afterJanusState);

    return {
      action: "merge_next",
      status: requeued ? "janus_requeued" : "failed",
      issueId: queueItem.issueId,
      queueItemId: queueItem.queueItemId,
      tier: "T3",
      stage: janus.stage,
      detail: attempt.detail,
    };
  }

  const failedState = updateMergeQueueItem(mergingQueueState, queueItem.queueItemId, (item) => ({
    ...item,
    status: "failed",
    attempts: item.attempts + 1,
    lastTier: "T3",
    lastError: attempt.detail,
    updatedAt: now,
  }));
  saveMergeQueueState(root, failedState);
  updateDispatchStage(root, queueItem.issueId, dispatchRecord, "failed", now);

  return {
    action: "merge_next",
    status: "failed",
    issueId: queueItem.issueId,
    queueItemId: queueItem.queueItemId,
    tier: "T3",
    stage: "failed",
    detail: attempt.detail,
  };
}
