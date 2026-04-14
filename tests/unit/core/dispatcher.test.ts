import path from "node:path";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { emptyDispatchState } from "../../../src/core/dispatch-state.js";
import { dispatchReadyWork } from "../../../src/core/dispatcher.js";
import type { AgentRuntime } from "../../../src/runtime/agent-runtime.js";

function createRuntime(): AgentRuntime {
  return {
    async launch() {
      return {
        sessionId: "session-1",
        startedAt: "2026-04-14T12:00:00.000Z",
      };
    },
    async readSession() {
      return null;
    },
    async terminate() {
      return null;
    },
  };
}

const tempRoots: string[] = [];

function createTempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "aegis-dispatcher-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("dispatchReadyWork", () => {
  it("marks oracle dispatch as running and records the returned session id", async () => {
    const result = await dispatchReadyWork({
      dispatchState: emptyDispatchState(),
      decisions: [
        {
          issueId: "ISSUE-1",
          title: "First",
          caste: "oracle",
          stage: "scouting",
        },
      ],
      runtime: createRuntime(),
      sessionProvenanceId: "daemon-1",
      root: "C:/repo",
      now: "2026-04-14T12:00:00.000Z",
    });

    expect(result.dispatched).toEqual(["ISSUE-1"]);
    expect(result.state.records["ISSUE-1"]).toMatchObject({
      issueId: "ISSUE-1",
      stage: "scouting",
      runningAgent: {
        caste: "oracle",
        sessionId: "session-1",
        startedAt: "2026-04-14T12:00:00.000Z",
      },
      sessionProvenanceId: "daemon-1",
    });
  });

  it("puts failed launches on cooldown so the same issue is not redispatched immediately", async () => {
    const result = await dispatchReadyWork({
      dispatchState: emptyDispatchState(),
      decisions: [
        {
          issueId: "ISSUE-1",
          title: "First",
          caste: "oracle",
          stage: "scouting",
        },
      ],
      runtime: {
        async launch() {
          throw new Error("phase e runtime missing");
        },
        async readSession() {
          return null;
        },
        async terminate() {
          return null;
        },
      },
      sessionProvenanceId: "daemon-1",
      root: "C:/repo",
      now: "2026-04-14T12:00:00.000Z",
    });

    expect(result.failed).toEqual(["ISSUE-1"]);
    expect(result.state.records["ISSUE-1"]?.stage).toBe("failed");
    expect(result.state.records["ISSUE-1"]?.cooldownUntil).toBeTruthy();
  });

  it("stops dispatching the rest of the current pass after a launch failure", async () => {
    let calls = 0;
    const result = await dispatchReadyWork({
      dispatchState: emptyDispatchState(),
      decisions: [
        {
          issueId: "ISSUE-1",
          title: "First",
          caste: "oracle",
          stage: "scouting",
        },
        {
          issueId: "ISSUE-2",
          title: "Second",
          caste: "oracle",
          stage: "scouting",
        },
      ],
      runtime: {
        async launch() {
          calls += 1;
          throw new Error("runtime unavailable");
        },
        async readSession() {
          return null;
        },
        async terminate() {
          return null;
        },
      },
      sessionProvenanceId: "daemon-1",
      root: "C:/repo",
      now: "2026-04-14T12:00:00.000Z",
    });

    expect(calls).toBe(1);
    expect(result.failed).toEqual(["ISSUE-1"]);
    expect(result.state.records["ISSUE-2"]).toBeUndefined();
  });

  it("writes a dispatch phase log even when no work is dispatchable", async () => {
    const root = createTempRoot();
    const timestamp = "2026-04-14T12:00:00.000Z";

    await dispatchReadyWork({
      dispatchState: emptyDispatchState(),
      decisions: [],
      runtime: createRuntime(),
      sessionProvenanceId: "daemon-1",
      root,
      now: timestamp,
    });

    const logPath = path.join(
      root,
      ".aegis",
      "logs",
      "phases",
      "2026-04-14T12-00-00.000Z-dispatch-_all.json",
    );

    expect(existsSync(logPath)).toBe(true);
    expect(JSON.parse(readFileSync(logPath, "utf8"))).toMatchObject({
      phase: "dispatch",
      issueId: "_all",
    });
  });
});
