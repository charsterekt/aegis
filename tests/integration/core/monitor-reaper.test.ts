/**
 * S10 — Monitor + Reaper integration tests.
 *
 * Validates:
 *   - Monitor session lifecycle (start, observe, stop)
 *   - Stuck detection (90s warning, 150s kill)
 *   - Repeated tool call detection (3+ same call → nudge)
 *   - Turn budget exceeded → abort
 *   - Token budget exceeded → abort
 *   - Per-issue cost warning (exact_usd)
 *   - Daily hard stop → abort + gate refusal
 *   - Quota floor warning and abort
 *   - Budget gate (checkBudgetGate)
 *   - Metering mode handling (exact_usd, credits, quota, stats_only, unknown)
 *   - SSE event emission via drainEvents()
 *   - Monitor-Reaper interaction: session ends → reaper computes outcome
 *   - resetDailyBudget clears suppression
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  MonitorImpl,
  DEFAULT_MONITOR_THRESHOLDS,
  assessStuckState,
  hasRepeatedToolCalls,
  isDailyHardStopExceeded,
  assessQuotaFloor,
  canAutoDispatchJanus,
} from "../../../src/core/monitor.js";
import type { MonitorEvent, SessionTracker } from "../../../src/core/monitor.js";
import { ReaperImpl, computeNextStage, determineLaborCleanup } from "../../../src/core/reaper.js";
import type { ReaperResult } from "../../../src/core/reaper.js";
import type { AgentEvent } from "../../../src/runtime/agent-events.js";
import type { AgentHandle, AgentStats } from "../../../src/runtime/agent-runtime.js";
import type { BudgetLimit } from "../../../src/config/schema.js";
import { DispatchStage } from "../../../src/core/stage-transition.js";
import type { DispatchRecord } from "../../../src/core/dispatch-state.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let fakeClock = Date.now();

function tick(ms: number): void {
  fakeClock += ms;
}

function makeMockHandle(options?: {
  onSubscribe?: (listener: (event: AgentEvent) => void) => void;
  onAbort?: () => void;
  onSteer?: (msg: string) => void;
}): AgentHandle {
  let _listener: ((event: AgentEvent) => void) | null = null;
  let _aborted = false;
  let _stats: AgentStats = {
    input_tokens: 0,
    output_tokens: 0,
    session_turns: 0,
    wall_time_sec: 0,
  };

  return {
    prompt: async () => {},
    steer: async (msg: string) => {
      options?.onSteer?.(msg);
    },
    abort: async () => {
      _aborted = true;
      options?.onAbort?.();
    },
    subscribe: (listener: (event: AgentEvent) => void) => {
      _listener = listener;
      options?.onSubscribe?.(listener);
      return () => {
        _listener = null;
      };
    },
    getStats: () => _stats,
    // Expose internals for testing
    _setStats: (stats: AgentStats) => {
      _stats = stats;
    },
    _emitEvent: (event: AgentEvent) => {
      if (_listener) _listener(event);
    },
    _isAborted: () => _aborted,
  } as AgentHandle & {
    _setStats: (s: AgentStats) => void;
    _emitEvent: (e: AgentEvent) => void;
    _isAborted: () => boolean;
  };
}

function makeBudget(overrides?: Partial<BudgetLimit>): BudgetLimit {
  return {
    turns: overrides?.turns ?? 100,
    tokens: overrides?.tokens ?? 50000,
  };
}

function makeRecord(stage: DispatchStage = DispatchStage.Scouting): DispatchRecord {
  return {
    issueId: "test-issue-1",
    stage,
    runningAgent: null,
    oracleAssessmentRef: null,
    sentinelVerdictRef: null,
    failureCount: 0,
    consecutiveFailures: 0,
    cooldownUntil: null,
    cumulativeSpendUsd: null,
    sessionProvenanceId: "test-session",
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// assessStuckState — pure helper
// ---------------------------------------------------------------------------

describe("assessStuckState", () => {
  it('returns "ok" when no progress recorded', () => {
    expect(assessStuckState(null, Date.now())).toBe("ok");
  });

  it('returns "ok" when progress is recent', () => {
    const now = Date.now();
    expect(assessStuckState(now - 30 * 1000, now)).toBe("ok");
  });

  it('returns "warning" after 90 seconds without progress', () => {
    const now = Date.now();
    expect(assessStuckState(now - 90 * 1000, now)).toBe("warning");
  });

  it('returns "kill" after 150 seconds without progress', () => {
    const now = Date.now();
    expect(assessStuckState(now - 150 * 1000, now)).toBe("kill");
  });

  it("respects custom thresholds", () => {
    const thresholds = { ...DEFAULT_MONITOR_THRESHOLDS, stuckWarningSec: 30, stuckKillSec: 60 };
    const now = Date.now();
    expect(assessStuckState(now - 45 * 1000, now, thresholds)).toBe("warning");
    expect(assessStuckState(now - 65 * 1000, now, thresholds)).toBe("kill");
  });
});

// ---------------------------------------------------------------------------
// hasRepeatedToolCalls — pure helper
// ---------------------------------------------------------------------------

describe("hasRepeatedToolCalls", () => {
  it("returns false with fewer calls than threshold", () => {
    expect(hasRepeatedToolCalls(["read_file", "bash"])).toBe(false);
  });

  it("returns true when same tool called 3+ times in a row", () => {
    expect(hasRepeatedToolCalls(["read_file", "read_file", "read_file"])).toBe(true);
  });

  it("returns false when tools are mixed", () => {
    expect(hasRepeatedToolCalls(["read_file", "bash", "read_file"])).toBe(false);
  });

  it("returns true for 4+ repeated calls", () => {
    expect(
      hasRepeatedToolCalls(["read_file", "read_file", "read_file", "read_file"]),
    ).toBe(true);
  });

  it("respects custom threshold", () => {
    const thresholds = { ...DEFAULT_MONITOR_THRESHOLDS, repeatedToolThreshold: 5 };
    expect(
      hasRepeatedToolCalls(
        ["read_file", "read_file", "read_file", "read_file", "read_file"],
        thresholds,
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isDailyHardStopExceeded — pure helper
// ---------------------------------------------------------------------------

describe("isDailyHardStopExceeded", () => {
  it("returns false when spend is null", () => {
    expect(isDailyHardStopExceeded(null)).toBe(false);
  });

  it("returns false when under threshold", () => {
    expect(isDailyHardStopExceeded(15.0)).toBe(false);
  });

  it("returns true when at threshold", () => {
    expect(isDailyHardStopExceeded(20.0)).toBe(true);
  });

  it("returns true when over threshold", () => {
    expect(isDailyHardStopExceeded(25.0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// assessQuotaFloor — pure helper
// ---------------------------------------------------------------------------

describe("assessQuotaFloor", () => {
  it('returns "ok" when quota is undefined', () => {
    expect(assessQuotaFloor(undefined)).toBe("ok");
  });

  it('returns "ok" when above warning floor', () => {
    expect(assessQuotaFloor(50)).toBe("ok");
  });

  it('returns "warning" at warning floor', () => {
    expect(assessQuotaFloor(35)).toBe("warning");
  });

  it('returns "abort" at hard stop floor', () => {
    expect(assessQuotaFloor(20)).toBe("abort");
  });

  it('returns "abort" below hard stop floor', () => {
    expect(assessQuotaFloor(10)).toBe("abort");
  });
});

// ---------------------------------------------------------------------------
// canAutoDispatchJanus — pure helper
// ---------------------------------------------------------------------------

describe("canAutoDispatchJanus", () => {
  it("returns true for exact_usd", () => {
    expect(canAutoDispatchJanus("exact_usd")).toBe(true);
  });

  it("returns true for credits", () => {
    expect(canAutoDispatchJanus("credits")).toBe(true);
  });

  it("returns true for quota", () => {
    expect(canAutoDispatchJanus("quota")).toBe(true);
  });

  it("returns true for stats_only", () => {
    expect(canAutoDispatchJanus("stats_only")).toBe(true);
  });

  it("returns false for unknown", () => {
    expect(canAutoDispatchJanus("unknown")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Monitor session lifecycle
// ---------------------------------------------------------------------------

describe("Monitor session lifecycle", () => {
  let monitor: MonitorImpl;

  beforeEach(() => {
    fakeClock = Date.now();
    monitor = new MonitorImpl({ nowMs: () => fakeClock });
  });

  it("startObserving returns a SessionTracker", () => {
    const handle = makeMockHandle();
    const tracker = monitor.startObserving(
      "test-issue",
      "oracle",
      handle as AgentHandle,
      makeBudget(),
    );

    expect(tracker.issueId).toBe("test-issue");
    expect(tracker.caste).toBe("oracle");
    expect(tracker.aborted).toBe(false);
  });

  it("stopObserving removes the session from active sessions", () => {
    const handle = makeMockHandle();
    monitor.startObserving("test-issue", "oracle", handle as AgentHandle, makeBudget());
    expect(monitor.getActiveSessions().size).toBe(1);

    monitor.stopObserving("test-issue");
    expect(monitor.getActiveSessions().size).toBe(0);
  });

  it("stopObserving is idempotent", () => {
    const handle = makeMockHandle();
    monitor.startObserving("test-issue", "oracle", handle as AgentHandle, makeBudget());
    monitor.stopObserving("test-issue");
    monitor.stopObserving("test-issue"); // should not throw
    expect(monitor.getActiveSessions().size).toBe(0);
  });

  it("getActiveSessions returns all running sessions", () => {
    const h1 = makeMockHandle();
    const h2 = makeMockHandle();
    monitor.startObserving("issue-1", "oracle", h1 as AgentHandle, makeBudget());
    monitor.startObserving("issue-2", "titan", h2 as AgentHandle, makeBudget());

    const sessions = monitor.getActiveSessions();
    expect(sessions.size).toBe(2);
    expect(sessions.has("issue-1")).toBe(true);
    expect(sessions.has("issue-2")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Monitor event emission (SSE)
// ---------------------------------------------------------------------------

describe("Monitor drainEvents", () => {
  let monitor: MonitorImpl;

  beforeEach(() => {
    fakeClock = Date.now();
    monitor = new MonitorImpl({ nowMs: () => fakeClock });
  });

  it("returns empty array when no events", () => {
    expect(monitor.drainEvents()).toEqual([]);
  });

  it("returns and clears pending events", () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    monitor.startObserving("test-issue", "oracle", extHandle as AgentHandle, makeBudget());

    // Emit a stats_update event with cost observation that triggers a budget warning
    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "oracle",
      stats: {
        input_tokens: 100,
        output_tokens: 200,
        session_turns: 1,
        wall_time_sec: 10,
      },
      observation: {
        provider: "pi",
        auth_mode: "api_key",
        metering: "exact_usd",
        exact_cost_usd: 5.00, // Triggers per-issue cost warning
        confidence: "exact",
        source: "billing_api",
      },
    });

    const events = monitor.drainEvents();
    expect(events.length).toBeGreaterThan(0);
    // After draining, next call returns empty
    expect(monitor.drainEvents()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Stuck detection
// ---------------------------------------------------------------------------

describe("Monitor stuck detection", () => {
  let monitor: MonitorImpl;

  beforeEach(() => {
    fakeClock = Date.now();
    monitor = new MonitorImpl({ nowMs: () => fakeClock });
  });

  it("emits stuck warning after 90s without tool progress", async () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    // Use 50ms stuck check interval so test runs fast
    const fastMonitor = new MonitorImpl({ nowMs: () => fakeClock, stuckCheckIntervalMs: 50 });
    const tracker = fastMonitor.startObserving(
      "test-issue",
      "titan",
      extHandle as AgentHandle,
      makeBudget(),
    );

    // Simulate initial tool use
    (extHandle as any)._emitEvent({
      type: "tool_use",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      tool: "read_file",
    });

    // Advance clock past warning threshold
    tick(91 * 1000);

    // Wait for the stuck check interval to fire
    await new Promise((r) => setTimeout(r, 100));

    const events = fastMonitor.drainEvents();
    const stuckWarning = events.find((e) => e.type === "stuck_warning");
    expect(stuckWarning).toBeDefined();

    // Cleanup
    fastMonitor.stopObserving("test-issue");
  });
});

// ---------------------------------------------------------------------------
// Repeated tool call detection
// ---------------------------------------------------------------------------

describe("Monitor repeated tool call detection", () => {
  let monitor: MonitorImpl;

  beforeEach(() => {
    fakeClock = Date.now();
    monitor = new MonitorImpl({ nowMs: () => fakeClock });
  });

  it("emits repeated_tool_nudge when same tool called 3+ times", () => {
    let steerMsg: string | null = null;
    const handle = makeMockHandle({
      onSteer: (msg) => {
        steerMsg = msg;
      },
    });
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    monitor.startObserving("test-issue", "titan", extHandle as AgentHandle, makeBudget());

    // Emit 3 tool_use events for the same tool
    for (let i = 0; i < 3; i++) {
      (extHandle as any)._emitEvent({
        type: "tool_use",
        timestamp: new Date(fakeClock).toISOString(),
        issueId: "test-issue",
        caste: "titan",
        tool: "read_file",
      });
    }

    const events = monitor.drainEvents();
    const nudge = events.find((e) => e.type === "repeated_tool_nudge");
    expect(nudge).toBeDefined();
    expect(steerMsg).toContain("read_file");
  });

  it("does not emit nudge for mixed tool calls", () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    monitor.startObserving("test-issue", "titan", extHandle as AgentHandle, makeBudget());

    (extHandle as any)._emitEvent({
      type: "tool_use",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      tool: "read_file",
    });
    (extHandle as any)._emitEvent({
      type: "tool_use",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      tool: "bash",
    });
    (extHandle as any)._emitEvent({
      type: "tool_use",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      tool: "read_file",
    });

    const events = monitor.drainEvents();
    const nudge = events.find((e) => e.type === "repeated_tool_nudge");
    expect(nudge).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Turn budget enforcement
// ---------------------------------------------------------------------------

describe("Monitor turn budget enforcement", () => {
  let monitor: MonitorImpl;

  beforeEach(() => {
    fakeClock = Date.now();
    monitor = new MonitorImpl({ nowMs: () => fakeClock });
  });

  it("aborts session when turn budget exceeded", async () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
      _isAborted: () => boolean;
    };
    const budget = makeBudget({ turns: 3 });
    monitor.startObserving("test-issue", "titan", extHandle as AgentHandle, budget);

    // Emit stats_update that exceeds turn budget
    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      stats: {
        input_tokens: 1000,
        output_tokens: 2000,
        session_turns: 5, // Exceeds budget of 3
        wall_time_sec: 30,
      },
    });

    // Allow async abort to complete
    await new Promise((r) => setTimeout(r, 50));

    const events = monitor.drainEvents();
    const budgetAbort = events.find((e) => e.type === "budget_abort");
    expect(budgetAbort).toBeDefined();
    expect(budgetAbort?.message).toContain("Turn budget exceeded");
  });
});

// ---------------------------------------------------------------------------
// Token budget enforcement
// ---------------------------------------------------------------------------

describe("Monitor token budget enforcement", () => {
  let monitor: MonitorImpl;

  beforeEach(() => {
    fakeClock = Date.now();
    monitor = new MonitorImpl({ nowMs: () => fakeClock });
  });

  it("aborts session when token budget exceeded", async () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    const budget = makeBudget({ tokens: 5000 });
    monitor.startObserving("test-issue", "titan", extHandle as AgentHandle, budget);

    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      stats: {
        input_tokens: 50000,
        output_tokens: 100000, // Total 150000 >> 5000
        session_turns: 10,
        wall_time_sec: 30,
      },
    });

    await new Promise((r) => setTimeout(r, 50));

    const events = monitor.drainEvents();
    const budgetAbort = events.find((e) => e.type === "budget_abort");
    expect(budgetAbort).toBeDefined();
    expect(budgetAbort?.message).toContain("Token budget exceeded");
  });
});

// ---------------------------------------------------------------------------
// Per-issue cost warning (exact_usd)
// ---------------------------------------------------------------------------

describe("Monitor per-issue cost warning", () => {
  let monitor: MonitorImpl;

  beforeEach(() => {
    fakeClock = Date.now();
    monitor = new MonitorImpl({ nowMs: () => fakeClock });
  });

  it("emits budget_warning when per-issue cost exceeds threshold", () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    monitor.startObserving("test-issue", "titan", extHandle as AgentHandle, makeBudget());

    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      stats: {
        input_tokens: 1000,
        output_tokens: 2000,
        session_turns: 5,
        wall_time_sec: 30,
      },
      observation: {
        provider: "pi",
        auth_mode: "api_key",
        metering: "exact_usd",
        exact_cost_usd: 5.00, // Exceeds perIssueCostWarningUsd of 3.00
        confidence: "exact",
        source: "billing_api",
      },
    });

    const events = monitor.drainEvents();
    const costWarning = events.find(
      (e) =>
        e.type === "budget_warning" &&
        (e.details as any)?.metering === "exact_usd",
    );
    expect(costWarning).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Daily hard stop
// ---------------------------------------------------------------------------

describe("Monitor daily hard stop", () => {
  let monitor: MonitorImpl;

  beforeEach(() => {
    fakeClock = Date.now();
    monitor = new MonitorImpl({ nowMs: () => fakeClock });
  });

  it("triggers daily hard stop and aborts session", async () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    monitor.startObserving("test-issue", "titan", extHandle as AgentHandle, makeBudget());

    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      stats: {
        input_tokens: 1000,
        output_tokens: 2000,
        session_turns: 5,
        wall_time_sec: 30,
      },
      observation: {
        provider: "pi",
        auth_mode: "api_key",
        metering: "exact_usd",
        exact_cost_usd: 25.00, // Exceeds dailyHardStopUsd of 20.00
        confidence: "exact",
        source: "billing_api",
      },
    });

    await new Promise((r) => setTimeout(r, 50));

    const events = monitor.drainEvents();
    const hardStop = events.find((e) => e.type === "daily_hard_stop");
    expect(hardStop).toBeDefined();
  });

  it("checkBudgetGate returns false after daily hard stop", () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    monitor.startObserving("test-issue", "titan", extHandle as AgentHandle, makeBudget());

    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      stats: {
        input_tokens: 1000,
        output_tokens: 2000,
        session_turns: 5,
        wall_time_sec: 30,
      },
      observation: {
        provider: "pi",
        auth_mode: "api_key",
        metering: "exact_usd",
        exact_cost_usd: 25.00,
        confidence: "exact",
        source: "billing_api",
      },
    });

    const gate = monitor.checkBudgetGate();
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe("daily_hard_stop_exceeded");
  });

  it("resetDailyBudget clears the hard stop", () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    monitor.startObserving("test-issue", "titan", extHandle as AgentHandle, makeBudget());

    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      stats: {
        input_tokens: 1000,
        output_tokens: 2000,
        session_turns: 5,
        wall_time_sec: 30,
      },
      observation: {
        provider: "pi",
        auth_mode: "api_key",
        metering: "exact_usd",
        exact_cost_usd: 25.00,
        confidence: "exact",
        source: "billing_api",
      },
    });

    expect(monitor.checkBudgetGate().allowed).toBe(false);

    monitor.resetDailyBudget();
    expect(monitor.checkBudgetGate().allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Quota floor enforcement
// ---------------------------------------------------------------------------

describe("Monitor quota floor enforcement", () => {
  let monitor: MonitorImpl;

  beforeEach(() => {
    fakeClock = Date.now();
    monitor = new MonitorImpl({ nowMs: () => fakeClock });
  });

  it("emits quota_floor_warning when quota approaches floor", () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    monitor.startObserving("test-issue", "titan", extHandle as AgentHandle, makeBudget());

    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      stats: {
        input_tokens: 1000,
        output_tokens: 2000,
        session_turns: 5,
        wall_time_sec: 30,
      },
      observation: {
        provider: "pi",
        auth_mode: "subscription",
        metering: "quota",
        quota_remaining_pct: 30, // Below warning floor of 35
        confidence: "proxy",
        source: "runtime_status",
      },
    });

    const events = monitor.drainEvents();
    const quotaWarning = events.find((e) => e.type === "quota_floor_warning");
    expect(quotaWarning).toBeDefined();
  });

  it("emits quota_floor_abort and blocks dispatch when quota below hard stop", async () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    monitor.startObserving("test-issue", "titan", extHandle as AgentHandle, makeBudget());

    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      stats: {
        input_tokens: 1000,
        output_tokens: 2000,
        session_turns: 5,
        wall_time_sec: 30,
      },
      observation: {
        provider: "pi",
        auth_mode: "subscription",
        metering: "quota",
        quota_remaining_pct: 15, // Below hard stop floor of 20
        confidence: "proxy",
        source: "runtime_status",
      },
    });

    await new Promise((r) => setTimeout(r, 50));

    const events = monitor.drainEvents();
    const quotaAbort = events.find((e) => e.type === "quota_floor_abort");
    expect(quotaAbort).toBeDefined();

    const gate = monitor.checkBudgetGate();
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe("quota_floor_exceeded");
  });
});

// ---------------------------------------------------------------------------
// Budget gate
// ---------------------------------------------------------------------------

describe("Monitor checkBudgetGate", () => {
  let monitor: MonitorImpl;

  beforeEach(() => {
    fakeClock = Date.now();
    monitor = new MonitorImpl({ nowMs: () => fakeClock });
  });

  it("returns allowed=true by default", () => {
    const gate = monitor.checkBudgetGate();
    expect(gate.allowed).toBe(true);
    expect(gate.reason).toBeNull();
  });

  it("returns allowed=false when credits floor crossed", () => {
    // Manually set credits remaining via a stats update
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    monitor.startObserving("test-issue", "titan", extHandle as AgentHandle, makeBudget());

    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      stats: {
        input_tokens: 1000,
        output_tokens: 2000,
        session_turns: 5,
        wall_time_sec: 30,
      },
      observation: {
        provider: "pi",
        auth_mode: "subscription",
        metering: "credits",
        credits_remaining: 0,
        confidence: "proxy",
        source: "runtime_status",
      },
    });

    const gate = monitor.checkBudgetGate();
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe("credits_floor_exceeded");
  });
});

// ---------------------------------------------------------------------------
// Metering mode handling
// ---------------------------------------------------------------------------

describe("Monitor metering mode handling", () => {
  let monitor: MonitorImpl;

  beforeEach(() => {
    fakeClock = Date.now();
    monitor = new MonitorImpl({ nowMs: () => fakeClock });
  });

  it("handles stats_only metering without cost errors", () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    const tracker = monitor.startObserving(
      "test-issue",
      "titan",
      extHandle as AgentHandle,
      makeBudget(),
    );

    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      stats: {
        input_tokens: 1000,
        output_tokens: 2000,
        session_turns: 5,
        wall_time_sec: 30,
      },
    });

    expect(tracker.latestStats).not.toBeNull();
    expect(tracker.latestStats!.input_tokens).toBe(1000);
    expect(tracker.latestStats!.output_tokens).toBe(2000);
    // total_tokens is on the normalized view: 1000 + 2000 = 3000
  });

  it("handles credits metering", () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    const tracker = monitor.startObserving(
      "test-issue",
      "titan",
      extHandle as AgentHandle,
      makeBudget(),
    );

    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      stats: {
        input_tokens: 1000,
        output_tokens: 2000,
        session_turns: 5,
        wall_time_sec: 30,
      },
      observation: {
        provider: "pi",
        auth_mode: "subscription",
        metering: "credits",
        credits_used: 500,
        credits_remaining: 1500,
        confidence: "proxy",
        source: "runtime_status",
      },
    });

    expect(tracker.latestObservation?.metering).toBe("credits");
    expect(tracker.latestObservation?.credits_remaining).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// Monitor-Reaper integration
// ---------------------------------------------------------------------------

describe("Monitor-Reaper integration", () => {
  let monitor: MonitorImpl;
  let reaper: ReaperImpl;

  beforeEach(() => {
    fakeClock = Date.now();
    monitor = new MonitorImpl({ nowMs: () => fakeClock });
    reaper = new ReaperImpl();
  });

  it("reaper produces correct outcome for monitor-terminated session", () => {
    const record = makeRecord(DispatchStage.Scouting);
    const result: ReaperResult = reaper.reap(
      "test-issue",
      "oracle",
      "stuck_killed",
      [],
      record,
    );

    expect(result.outcome).toBe("monitor_termination");
    expect(result.endReason).toBe("stuck_killed");
    expect(result.nextStage).toBe(DispatchStage.Failed);
    expect(result.incrementFailure).toBe(true);
    expect(result.resetFailures).toBe(false);
  });

  it("reaper produces correct outcome for budget-exceeded session", () => {
    const record = makeRecord(DispatchStage.Implementing);
    const result: ReaperResult = reaper.reap(
      "test-issue",
      "titan",
      "budget_exceeded",
      [],
      record,
    );

    expect(result.outcome).toBe("monitor_termination");
    expect(result.endReason).toBe("budget_exceeded");
    expect(result.nextStage).toBe(DispatchStage.Failed);
    expect(result.incrementFailure).toBe(true);
  });

  it("reaper produces success when session completed with valid artifacts", () => {
    const record = makeRecord(DispatchStage.Scouting);
    const events: AgentEvent[] = [
      {
        type: "message",
        timestamp: new Date(fakeClock).toISOString(),
        issueId: "test-issue",
        caste: "oracle",
        text: "OracleAssessment: { ready: true }",
      },
    ];

    const result: ReaperResult = reaper.reap(
      "test-issue",
      "oracle",
      "completed",
      events,
      record,
    );

    expect(result.outcome).toBe("success");
    expect(result.nextStage).toBe(DispatchStage.Scouted);
    expect(result.resetFailures).toBe(true);
    expect(result.artifacts.passed).toBe(true);
  });

  it("reaper produces artifact_failure when session completed without artifacts", () => {
    const record = makeRecord(DispatchStage.Scouting);
    const result: ReaperResult = reaper.reap(
      "test-issue",
      "oracle",
      "completed",
      [], // no artifacts
      record,
    );

    expect(result.outcome).toBe("artifact_failure");
    expect(result.nextStage).toBe(DispatchStage.Failed);
    expect(result.incrementFailure).toBe(true);
  });

  it("reaper produces crash outcome for error end reason", () => {
    const record = makeRecord(DispatchStage.Reviewing);
    const result: ReaperResult = reaper.reap(
      "test-issue",
      "sentinel",
      "error",
      [],
      record,
    );

    expect(result.outcome).toBe("crash");
    expect(result.nextStage).toBe(DispatchStage.Failed);
    expect(result.incrementFailure).toBe(true);
  });

  it("reaper preserves labor on Titan failure", () => {
    const record = makeRecord(DispatchStage.Implementing);
    const result: ReaperResult = reaper.reap(
      "test-issue",
      "titan",
      "error",
      [],
      record,
    );

    expect(result.laborCleanup).not.toBeNull();
    expect(result.laborCleanup!.removeWorktree).toBe(false);
    expect(result.laborCleanup!.deleteBranch).toBe(false);
    expect(result.laborCleanup!.reason).toContain("titan_failure");
  });

  it("reaper produces merge candidate on Titan success", () => {
    const record = makeRecord(DispatchStage.Implementing);
    const events: AgentEvent[] = [
      {
        type: "message",
        timestamp: new Date(fakeClock).toISOString(),
        issueId: "test-issue",
        caste: "titan",
        text: "TitanHandoff: { branch: aegis/test }",
      },
    ];

    const result: ReaperResult = reaper.reap(
      "test-issue",
      "titan",
      "completed",
      events,
      record,
    );

    expect(result.outcome).toBe("success");
    expect(result.mergeCandidate).not.toBeNull();
    expect(result.mergeCandidate!.issueId).toBe("test-issue");
    expect(result.mergeCandidate!.targetBranch).toBe("main");
  });

  it("monitor events are accessible after reaping", () => {
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    monitor.startObserving("test-issue", "titan", extHandle as AgentHandle, makeBudget());

    // Emit events that the monitor tracks
    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      stats: {
        input_tokens: 1000,
        output_tokens: 2000,
        session_turns: 5,
        wall_time_sec: 30,
      },
    });

    const monitorEvents = monitor.drainEvents();
    // Monitor should have tracked events from the session
    expect(Array.isArray(monitorEvents)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resetDailyBudget
// ---------------------------------------------------------------------------

describe("Monitor resetDailyBudget", () => {
  let monitor: MonitorImpl;

  beforeEach(() => {
    fakeClock = Date.now();
    monitor = new MonitorImpl({ nowMs: () => fakeClock });
  });

  it("clears daily hard stop suppression", () => {
    // Trigger hard stop
    const handle = makeMockHandle();
    const extHandle = handle as typeof handle & {
      _emitEvent: (e: AgentEvent) => void;
    };
    monitor.startObserving("test-issue", "titan", extHandle as AgentHandle, makeBudget());

    (extHandle as any)._emitEvent({
      type: "stats_update",
      timestamp: new Date(fakeClock).toISOString(),
      issueId: "test-issue",
      caste: "titan",
      stats: {
        input_tokens: 1000,
        output_tokens: 2000,
        session_turns: 5,
        wall_time_sec: 30,
      },
      observation: {
        provider: "pi",
        auth_mode: "api_key",
        metering: "exact_usd",
        exact_cost_usd: 25.00,
        confidence: "exact",
        source: "billing_api",
      },
    });

    expect(monitor.checkBudgetGate().allowed).toBe(false);

    monitor.resetDailyBudget();
    expect(monitor.checkBudgetGate().allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeNextStage + determineLaborCleanup — pure helpers from reaper
// ---------------------------------------------------------------------------

describe("computeNextStage", () => {
  it("returns scouted for oracle success", () => {
    expect(
      computeNextStage("oracle", "success", DispatchStage.Scouting),
    ).toBe(DispatchStage.Scouted);
  });

  it("returns implemented for titan success", () => {
    expect(
      computeNextStage("titan", "success", DispatchStage.Implementing),
    ).toBe(DispatchStage.Implemented);
  });

  it("returns complete for sentinel pass", () => {
    expect(
      computeNextStage("sentinel", "success", DispatchStage.Reviewing, "pass"),
    ).toBe(DispatchStage.Complete);
  });

  it("returns failed for sentinel fail", () => {
    expect(
      computeNextStage("sentinel", "success", DispatchStage.Reviewing, "fail"),
    ).toBe(DispatchStage.Failed);
  });

  it("returns failed for any non-success outcome", () => {
    expect(
      computeNextStage("oracle", "artifact_failure", DispatchStage.Scouting),
    ).toBe(DispatchStage.Failed);
    expect(
      computeNextStage("titan", "monitor_termination", DispatchStage.Implementing),
    ).toBe(DispatchStage.Failed);
    expect(
      computeNextStage("sentinel", "crash", DispatchStage.Reviewing),
    ).toBe(DispatchStage.Failed);
  });
});

describe("determineLaborCleanup", () => {
  it("returns null for oracle", () => {
    expect(determineLaborCleanup("oracle", "success", "issue-1")).toBeNull();
  });

  it("returns null for sentinel", () => {
    expect(determineLaborCleanup("sentinel", "success", "issue-1")).toBeNull();
  });

  it("preserves labor on titan success", () => {
    const cleanup = determineLaborCleanup("titan", "success", "issue-1");
    expect(cleanup).not.toBeNull();
    expect(cleanup!.removeWorktree).toBe(false);
    expect(cleanup!.deleteBranch).toBe(false);
  });

  it("preserves labor on titan failure", () => {
    const cleanup = determineLaborCleanup("titan", "crash", "issue-1");
    expect(cleanup).not.toBeNull();
    expect(cleanup!.removeWorktree).toBe(false);
    expect(cleanup!.deleteBranch).toBe(false);
  });
});
