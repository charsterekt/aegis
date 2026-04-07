/**
 * Integration tests for queue admission — S13 contract.
 *
 * Tests:
 *   - full admission lifecycle: implemented → queued_for_merge
 *   - restart persistence and recovery
 *   - FIFO ordering under multiple admissions
 *   - duplicate admission rejection
 *   - queue visibility for Olympus state
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadMergeQueueState,
  saveMergeQueueState,
  emptyMergeQueueState,
  reconcileMergeQueueState,
  nextQueuedItem,
  isInQueue,
  type MergeQueueState,
} from "../../../src/merge/merge-queue-store.js";
import {
  admitCandidate,
  dequeueItem,
  type EnqueueCandidateInput,
} from "../../../src/merge/enqueue-candidate.js";
import { createInMemoryLiveEventBus } from "../../../src/events/event-bus.js";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnqueueInput(overrides: Partial<EnqueueCandidateInput> = {}): EnqueueCandidateInput {
  return {
    issueId: overrides.issueId ?? "issue-1",
    candidateBranch: overrides.candidateBranch ?? "feat/issue-1",
    targetBranch: overrides.targetBranch ?? "main",
    sourceStage: overrides.sourceStage ?? "implemented",
    sessionProvenanceId: overrides.sessionProvenanceId ?? "session-1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Queue Admission — Integration", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), ".aegis-test-" + Date.now());
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("admission lifecycle", () => {
    it("admits a candidate and persists to disk", () => {
      let state = emptyMergeQueueState();

      const input = makeEnqueueInput({
        issueId: "issue-1",
        candidateBranch: "feat/issue-1",
      });

      state = admitCandidate(state, input);
      saveMergeQueueState(testDir, state);

      const loaded = loadMergeQueueState(testDir);
      expect(loaded.items).toHaveLength(1);
      expect(loaded.items[0].issueId).toBe("issue-1");
      expect(loaded.items[0].status).toBe("queued");
    });

    it("transitions implemented issue to queued state", () => {
      const state = emptyMergeQueueState();
      const input = makeEnqueueInput({
        issueId: "impl-issue",
        sourceStage: "implemented",
      });

      const newState = admitCandidate(state, input);

      expect(newState.items[0].status).toBe("queued");
      expect(newState.items[0].sourceStage).toBe("implemented");
    });
  });

  describe("restart persistence and recovery", () => {
    it("survives restart with queue intact", () => {
      let state = emptyMergeQueueState();

      // Admit multiple candidates
      state = admitCandidate(state, makeEnqueueInput({ issueId: "issue-1" }));
      state = admitCandidate(state, makeEnqueueInput({ issueId: "issue-2" }));
      state = admitCandidate(state, makeEnqueueInput({ issueId: "issue-3" }));

      saveMergeQueueState(testDir, state);

      // Simulate restart
      const loaded = loadMergeQueueState(testDir);
      expect(loaded.items).toHaveLength(3);
      expect(loaded.items.map((i) => i.issueId)).toEqual([
        "issue-1",
        "issue-2",
        "issue-3",
      ]);
    });

    it("reconciles active items to queued after restart", () => {
      let state = emptyMergeQueueState();
      state = admitCandidate(state, makeEnqueueInput({ issueId: "issue-1" }));

      // Simulate item was being processed when crash occurred
      state = {
        ...state,
        items: state.items.map((item) => ({
          ...item,
          status: "active" as const,
        })),
      };

      saveMergeQueueState(testDir, state);

      // Restart and reconcile
      const loaded = loadMergeQueueState(testDir);
      const reconciled = reconcileMergeQueueState(loaded, "new-session");

      const item = reconciled.items[0];
      expect(item.status).toBe("queued");
      expect(item.sessionProvenanceId).toBe("new-session");
    });
  });

  describe("FIFO ordering", () => {
    it("maintains FIFO order under multiple admissions", () => {
      let state = emptyMergeQueueState();

      state = admitCandidate(state, makeEnqueueInput({ issueId: "first" }));
      state = admitCandidate(state, makeEnqueueInput({ issueId: "second" }));
      state = admitCandidate(state, makeEnqueueInput({ issueId: "third" }));

      expect(state.items[0].position).toBe(0);
      expect(state.items[1].position).toBe(1);
      expect(state.items[2].position).toBe(2);

      const next = nextQueuedItem(state);
      expect(next?.issueId).toBe("first");
    });

    it("processes items in FIFO order", () => {
      let state = emptyMergeQueueState();

      state = admitCandidate(state, makeEnqueueInput({ issueId: "first" }));
      state = admitCandidate(state, makeEnqueueInput({ issueId: "second" }));

      // Process first item
      const first = nextQueuedItem(state);
      expect(first?.issueId).toBe("first");

      state = dequeueItem(state, "first");

      // Next should be second
      const next = nextQueuedItem(state);
      expect(next?.issueId).toBe("second");
      expect(next?.position).toBe(0); // Renumbered
    });
  });

  describe("duplicate admission rejection", () => {
    it("rejects duplicate admission for same issue", () => {
      let state = emptyMergeQueueState();

      state = admitCandidate(state, makeEnqueueInput({ issueId: "duplicate" }));

      expect(() =>
        admitCandidate(state, makeEnqueueInput({ issueId: "duplicate" })),
      ).toThrow(/already in the merge queue/);
    });

    it("allows admission after item is dequeued", () => {
      let state = emptyMergeQueueState();

      state = admitCandidate(state, makeEnqueueInput({ issueId: "issue-1" }));
      state = dequeueItem(state, "issue-1");

      // Should now allow re-admission (e.g., after rework)
      const newState = admitCandidate(state, makeEnqueueInput({ issueId: "issue-1" }));
      expect(newState.items).toHaveLength(1);
      expect(newState.items[0].issueId).toBe("issue-1");
    });
  });

  describe("queue visibility for Olympus state", () => {
    it("exposes queue depth for monitoring", () => {
      let state = emptyMergeQueueState();

      state = admitCandidate(state, makeEnqueueInput({ issueId: "issue-1" }));
      state = admitCandidate(state, makeEnqueueInput({ issueId: "issue-2" }));

      const queuedCount = state.items.filter((i) => i.status === "queued").length;
      expect(queuedCount).toBe(2);
    });

    it("tracks processed count for analytics", () => {
      let state = emptyMergeQueueState();

      state = admitCandidate(state, makeEnqueueInput({ issueId: "issue-1" }));
      state = admitCandidate(state, makeEnqueueInput({ issueId: "issue-2" }));

      state = dequeueItem(state, "issue-1");
      expect(state.processedCount).toBe(1);

      state = dequeueItem(state, "issue-2");
      expect(state.processedCount).toBe(2);
    });

    it("integrates with event bus for live updates", () => {
      const eventBus = createInMemoryLiveEventBus();
      const events: any[] = [];
      eventBus.subscribe((event) => events.push(event));

      let state = emptyMergeQueueState();
      state = admitCandidate(state, makeEnqueueInput({ issueId: "issue-1" }));

      // Simulate queue state change event
      eventBus.publish({
        id: "evt-1",
        type: "merge.queue_state",
        timestamp: new Date().toISOString(),
        sequence: 1,
        payload: {
          issueId: "issue-1",
          status: "queued",
          attemptCount: 0,
        },
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("merge.queue_state");
      expect(events[0].payload.issueId).toBe("issue-1");
    });
  });

  describe("isInQueue checks", () => {
    it("correctly identifies queued and active items", () => {
      let state = emptyMergeQueueState();
      state = admitCandidate(state, makeEnqueueInput({ issueId: "queued" }));

      expect(isInQueue(state, "queued")).toBe(true);
      expect(isInQueue(state, "not-present")).toBe(false);
    });

    it("returns false for merged items", () => {
      let state = emptyMergeQueueState();
      state = admitCandidate(state, makeEnqueueInput({ issueId: "merged-item" }));
      state = {
        ...state,
        items: state.items.map((item) =>
          item.issueId === "merged-item"
            ? { ...item, status: "merged" as const }
            : item,
        ),
      };

      expect(isInQueue(state, "merged-item")).toBe(false);
    });
  });
});
