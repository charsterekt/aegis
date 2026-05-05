import path from "node:path";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  emptyMergeQueueState,
  enqueueMergeCandidate,
  loadMergeQueueState,
  saveMergeQueueState,
} from "../../../src/merge/merge-state.js";

const tempRoots: string[] = [];

function createTempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "aegis-merge-state-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("merge queue state", () => {
  it("loads legacy {} payloads as an empty queue state", () => {
    const root = createTempRoot();
    const queuePath = path.join(root, ".aegis", "merge-queue.json");
    mkdirSync(path.dirname(queuePath), { recursive: true });

    writeFileSync(queuePath, "{}\n", "utf8");

    expect(loadMergeQueueState(root)).toEqual(emptyMergeQueueState());
  });

  it("persists the schema-backed empty queue state", () => {
    const root = createTempRoot();

    saveMergeQueueState(root, emptyMergeQueueState());

    expect(JSON.parse(
      readFileSync(path.join(root, ".aegis", "merge-queue.json"), "utf8"),
    )).toEqual({
      schemaVersion: 1,
      items: [],
    });
  });

  it("resets retry state when a failed issue is re-enqueued after implementation rework", () => {
    const state = {
      schemaVersion: 1 as const,
      items: [
        {
          queueItemId: "queue-AG-0016",
          issueId: "AG-0016",
          candidateBranch: "aegis/AG-0016",
          targetBranch: "main",
          laborPath: ".aegis/labors/AG-0016",
          status: "failed" as const,
          attempts: 11,
          janusInvocations: 1,
          lastTier: "T3" as const,
          lastError: "merge conflict",
          enqueuedAt: "2026-05-02T22:16:47.291Z",
          updatedAt: "2026-05-02T22:25:55.674Z",
        },
      ],
    };

    const queued = enqueueMergeCandidate(state, {
      issueId: "AG-0016",
      candidateBranch: "aegis/AG-0016",
      targetBranch: "main",
      laborPath: ".aegis/labors/AG-0016",
      now: "2026-05-02T22:30:00.000Z",
    });

    expect(queued.item).toMatchObject({
      status: "queued",
      attempts: 0,
      janusInvocations: 0,
      lastTier: null,
      lastError: null,
    });
  });
});
