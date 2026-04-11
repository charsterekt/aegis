import { describe, expect, it } from "vitest";

import { createDashboardStateStore } from "../../../src/server/dashboard-state-store.js";

describe("createDashboardStateStore", () => {
  it("tracks phase logs, active sessions, merge queue state, and recent completions", () => {
    const store = createDashboardStateStore();

    store.apply({
      id: "evt-1",
      type: "loop.phase_log",
      timestamp: "2026-04-11T10:00:00.000Z",
      sequence: 1,
      payload: { phase: "dispatch", line: "oracle -> foundation.contract", level: "info", issueId: "foundation.contract", agentId: null },
    });

    const snapshot = store.snapshot();
    expect(snapshot.loop.phaseLogs.dispatch[0]).toContain("oracle -> foundation.contract");
  });

  it("tracks active sessions when agent.session_started is applied", () => {
    const store = createDashboardStateStore();

    store.apply({
      id: "evt-2",
      type: "agent.session_started",
      timestamp: "2026-04-11T10:01:00.000Z",
      sequence: 2,
      payload: { sessionId: "sess-1", caste: "oracle", issueId: "bd-42", stage: "Implementing", model: "gpt-4" },
    });

    const snapshot = store.snapshot();
    expect(snapshot.sessions.active["sess-1"]).toBeDefined();
    expect(snapshot.sessions.active["sess-1"].caste).toBe("oracle");
    expect(snapshot.sessions.active["sess-1"].issueId).toBe("bd-42");
  });

  it("moves session to recent when agent.session_ended is applied", () => {
    const store = createDashboardStateStore();

    store.apply({
      id: "evt-3",
      type: "agent.session_started",
      timestamp: "2026-04-11T10:02:00.000Z",
      sequence: 3,
      payload: { sessionId: "sess-2", caste: "titan", issueId: "bd-43", stage: "Implementing", model: "claude-4" },
    });

    store.apply({
      id: "evt-4",
      type: "agent.session_ended",
      timestamp: "2026-04-11T10:03:00.000Z",
      sequence: 4,
      payload: { sessionId: "sess-2", caste: "titan", issueId: "bd-43", outcome: "completed" },
    });

    const snapshot = store.snapshot();
    expect(snapshot.sessions.active["sess-2"]).toBeUndefined();
    expect(snapshot.sessions.recent.length).toBe(1);
    expect(snapshot.sessions.recent[0].id).toBe("sess-2");
    expect(snapshot.sessions.recent[0].outcome).toBe("completed");
  });

  it("caps phase log lines at 50 per phase", () => {
    const store = createDashboardStateStore();

    for (let i = 0; i < 60; i += 1) {
      store.apply({
        id: `evt-line-${i}`,
        type: "loop.phase_log",
        timestamp: `2026-04-11T10:00:${i < 60 ? i : 59}.000Z`,
        sequence: i + 10,
        payload: { phase: "poll", line: `line-${i}`, level: "info", issueId: null, agentId: null },
      });
    }

    const snapshot = store.snapshot();
    expect(snapshot.loop.phaseLogs.poll.length).toBe(50);
    expect(snapshot.loop.phaseLogs.poll[0]).toBe("line-59");
  });

  it("tracks merge queue log events", () => {
    const store = createDashboardStateStore();

    store.apply({
      id: "evt-mq-1",
      type: "merge.queue_log",
      timestamp: "2026-04-11T10:04:00.000Z",
      sequence: 20,
      payload: { issueId: "bd-50", status: "active", attemptCount: 1 },
    });

    const snapshot = store.snapshot();
    expect(snapshot.mergeQueue.items.length).toBe(1);
    expect(snapshot.mergeQueue.items[0].issueId).toBe("bd-50");
    expect(snapshot.mergeQueue.items[0].status).toBe("active");
  });

  it("does not mutate state in place on apply", () => {
    const store = createDashboardStateStore();
    const before = store.snapshot();

    store.apply({
      id: "evt-mutate",
      type: "loop.phase_log",
      timestamp: "2026-04-11T10:05:00.000Z",
      sequence: 30,
      payload: { phase: "dispatch", line: "test line", level: "info", issueId: null, agentId: null },
    });

    const after = store.snapshot();
    expect(before.loop.phaseLogs.dispatch.length).toBe(0);
    expect(after.loop.phaseLogs.dispatch.length).toBe(1);
  });

  it("returns core status, spend, agents in snapshot", () => {
    const store = createDashboardStateStore();
    const snapshot = store.snapshot();

    expect(snapshot.status).toBeDefined();
    expect(snapshot.spend).toBeDefined();
    expect(snapshot.agents).toBeDefined();
  });
});
