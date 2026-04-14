import path from "node:path";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { reapFinishedWork } from "../../../src/core/reaper.js";
import type { DispatchState } from "../../../src/core/dispatch-state.js";
import type { AgentRuntime } from "../../../src/runtime/agent-runtime.js";

function createRunningState(): DispatchState {
  return {
    schemaVersion: 1,
    records: {
      "ISSUE-1": {
        issueId: "ISSUE-1",
        stage: "scouting",
        runningAgent: {
          caste: "oracle",
          sessionId: "session-1",
          startedAt: "2026-04-14T11:55:00.000Z",
        },
        oracleAssessmentRef: null,
        sentinelVerdictRef: null,
        fileScope: null,
        failureCount: 0,
        consecutiveFailures: 0,
        failureWindowStartMs: null,
        cooldownUntil: null,
        sessionProvenanceId: "daemon-1",
        updatedAt: "2026-04-14T11:55:00.000Z",
      },
    },
  };
}

const tempRoots: string[] = [];

function createTempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "aegis-reaper-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("reapFinishedWork", () => {
  it("moves successful phase-d oracle runs to the explicit phase_d_complete stage", async () => {
    const runtime: AgentRuntime = {
      async launch() {
        throw new Error("unused");
      },
      async readSession() {
        return {
          sessionId: "session-1",
          status: "succeeded",
          finishedAt: "2026-04-14T11:56:00.000Z",
        };
      },
      async terminate() {
        return null;
      },
    };

    const result = await reapFinishedWork({
      dispatchState: createRunningState(),
      runtime,
      issueIds: ["ISSUE-1"],
      root: "C:/repo",
      now: "2026-04-14T12:00:00.000Z",
    });

    expect(result.completed).toEqual(["ISSUE-1"]);
    expect(result.failed).toEqual([]);
    expect(result.state.records["ISSUE-1"]).toMatchObject({
      issueId: "ISSUE-1",
      stage: "phase_d_complete",
      runningAgent: null,
    });
  });

  it("marks failed sessions as failed and increments counters", async () => {
    const runtime: AgentRuntime = {
      async launch() {
        throw new Error("unused");
      },
      async readSession() {
        return {
          sessionId: "session-1",
          status: "failed",
          finishedAt: "2026-04-14T11:56:00.000Z",
          error: "runtime unavailable",
        };
      },
      async terminate() {
        return null;
      },
    };

    const result = await reapFinishedWork({
      dispatchState: createRunningState(),
      runtime,
      issueIds: ["ISSUE-1"],
      root: "C:/repo",
      now: "2026-04-14T12:00:00.000Z",
    });

    expect(result.completed).toEqual([]);
    expect(result.failed).toEqual(["ISSUE-1"]);
    expect(result.state.records["ISSUE-1"]).toMatchObject({
      issueId: "ISSUE-1",
      stage: "failed",
      runningAgent: null,
      failureCount: 1,
      consecutiveFailures: 1,
    });
    expect(result.state.records["ISSUE-1"]?.cooldownUntil).toBeTruthy();
  });

  it("writes a reap phase log even when nothing is ready to reap", async () => {
    const root = createTempRoot();

    const runtime: AgentRuntime = {
      async launch() {
        throw new Error("unused");
      },
      async readSession() {
        return null;
      },
      async terminate() {
        return null;
      },
    };

    const result = await reapFinishedWork({
      dispatchState: {
        schemaVersion: 1,
        records: {},
      },
      runtime,
      issueIds: [],
      root,
      now: "2026-04-14T12:00:00.000Z",
    });

    expect(result).toEqual({
      state: {
        schemaVersion: 1,
        records: {},
      },
      completed: [],
      failed: [],
    });

    const logPath = path.join(
      root,
      ".aegis",
      "logs",
      "phases",
      "2026-04-14T12-00-00.000Z-reap-_all.json",
    );
    expect(existsSync(logPath)).toBe(true);
    expect(JSON.parse(readFileSync(logPath, "utf8"))).toMatchObject({
      phase: "reap",
      issueId: "_all",
    });
  });
});
