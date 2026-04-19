import path from "node:path";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { saveDispatchState } from "../../../src/core/dispatch-state.js";
import { autoEnqueueImplementedIssuesForMerge } from "../../../src/merge/auto-enqueue.js";
import { emptyMergeQueueState, saveMergeQueueState } from "../../../src/merge/merge-state.js";

const tempRoots: string[] = [];

function createTempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "aegis-auto-enqueue-"));
  tempRoots.push(root);
  mkdirSync(path.join(root, ".aegis", "titan"), { recursive: true });
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function writeTitanArtifact(root: string, issueId: string) {
  writeFileSync(
    path.join(root, ".aegis", "titan", `${issueId}.json`),
    `${JSON.stringify({
      labor_path: `.aegis/labors/${issueId}`,
      candidate_branch: `aegis/${issueId}`,
      base_branch: "main",
    }, null, 2)}\n`,
    "utf8",
  );
}

describe("autoEnqueueImplementedIssuesForMerge", () => {
  it("queues implemented issues and advances dispatch stage to queued_for_merge", () => {
    const root = createTempRoot();
    writeTitanArtifact(root, "aegis-501");
    saveMergeQueueState(root, emptyMergeQueueState());
    saveDispatchState(root, {
      schemaVersion: 1,
      records: {
        "aegis-501": {
          issueId: "aegis-501",
          stage: "implemented",
          runningAgent: null,
          oracleAssessmentRef: ".aegis/oracle/aegis-501.json",
          titanHandoffRef: ".aegis/titan/aegis-501.json",
          titanClarificationRef: null,
          sentinelVerdictRef: null,
          janusArtifactRef: null,
          failureTranscriptRef: null,
          fileScope: null,
          failureCount: 0,
          consecutiveFailures: 0,
          failureWindowStartMs: null,
          cooldownUntil: null,
          sessionProvenanceId: "daemon-1",
          updatedAt: "2026-04-19T15:00:00.000Z",
        },
      },
    });

    const result = autoEnqueueImplementedIssuesForMerge(
      root,
      "2026-04-19T15:01:00.000Z",
    );

    expect(result.enqueuedIssueIds).toEqual(["aegis-501"]);
    expect(result.dispatchState.records["aegis-501"]?.stage).toBe("queued_for_merge");
    expect(result.mergeQueueState.items).toMatchObject([
      {
        issueId: "aegis-501",
        candidateBranch: "aegis/aegis-501",
        targetBranch: "main",
        laborPath: ".aegis/labors/aegis-501",
        status: "queued",
      },
    ]);
  });

  it("is idempotent when no implemented issue remains", () => {
    const root = createTempRoot();
    saveMergeQueueState(root, emptyMergeQueueState());
    saveDispatchState(root, {
      schemaVersion: 1,
      records: {
        "aegis-777": {
          issueId: "aegis-777",
          stage: "queued_for_merge",
          runningAgent: null,
          oracleAssessmentRef: ".aegis/oracle/aegis-777.json",
          titanHandoffRef: ".aegis/titan/aegis-777.json",
          titanClarificationRef: null,
          sentinelVerdictRef: null,
          janusArtifactRef: null,
          failureTranscriptRef: null,
          fileScope: null,
          failureCount: 0,
          consecutiveFailures: 0,
          failureWindowStartMs: null,
          cooldownUntil: null,
          sessionProvenanceId: "daemon-1",
          updatedAt: "2026-04-19T15:00:00.000Z",
        },
      },
    });

    const beforeQueue = readFileSync(path.join(root, ".aegis", "merge-queue.json"), "utf8");
    const beforeDispatch = readFileSync(path.join(root, ".aegis", "dispatch-state.json"), "utf8");

    const result = autoEnqueueImplementedIssuesForMerge(
      root,
      "2026-04-19T15:01:00.000Z",
    );

    expect(result.enqueuedIssueIds).toEqual([]);
    expect(readFileSync(path.join(root, ".aegis", "merge-queue.json"), "utf8")).toBe(beforeQueue);
    expect(readFileSync(path.join(root, ".aegis", "dispatch-state.json"), "utf8")).toBe(beforeDispatch);
  });
});
