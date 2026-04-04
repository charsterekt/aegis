/**
 * S05 contract seed — integration tests for PiRuntime.
 *
 * These tests are placeholders for Lane A (aegis-fjm.6.2).
 * All behavioural tests use .todo() because they require a real Pi SDK
 * session to be wired up, which is Lane A's responsibility.
 *
 * The single live test verifies that importing PiRuntime and constructing it
 * does not throw, confirming the module structure is correct before Lane A
 * starts.
 *
 * Canonical rules: SPECv2 §8.3, §8.4, and §8.6.
 */

import { describe, expect, it } from "vitest";

import { PiRuntime } from "../../../src/runtime/pi-runtime.js";
import type { AgentRuntime } from "../../../src/runtime/agent-runtime.js";

// ---------------------------------------------------------------------------
// Structural assertion (live)
// ---------------------------------------------------------------------------

describe("PiRuntime module structure", () => {
  it("exports a PiRuntime class that satisfies the AgentRuntime interface at the type level", () => {
    // This test confirms the class exists and is assignable to AgentRuntime.
    // It does not call any Pi SDK code.
    const runtime: AgentRuntime = new PiRuntime();
    expect(runtime).toBeDefined();
    expect(typeof runtime.spawn).toBe("function");
  });

  it("spawn throws 'not implemented' until Lane A lands", async () => {
    const runtime = new PiRuntime();
    await expect(
      runtime.spawn({
        caste: "titan",
        issueId: "aegis-test.1",
        workingDirectory: process.cwd(),
        toolRestrictions: [],
        budget: { turns: 20, tokens: 10000 },
      })
    ).rejects.toThrow(/not implemented/i);
  });
});

// ---------------------------------------------------------------------------
// Session spawn (Lane A)
// ---------------------------------------------------------------------------

describe("PiRuntime — session spawn", () => {
  it.todo("spawn() resolves to a PiAgentHandle without error");
  it.todo("spawned session receives the correct working directory");
  it.todo("spawned session enforces tool restrictions from SpawnOptions");
  it.todo("spawned session emits session_started event before prompt is accepted");
  it.todo("spawn() is Windows-safe — path separators do not break process launch");
});

// ---------------------------------------------------------------------------
// Prompt delivery (Lane A)
// ---------------------------------------------------------------------------

describe("PiRuntime — prompt delivery", () => {
  it.todo("prompt() delivers the initial message to the running session");
  it.todo("prompt() rejects if called before session is started");
  it.todo("steer() delivers an in-flight steering message to the session");
  it.todo("steer() rejects if the session has already ended");
});

// ---------------------------------------------------------------------------
// Abort and cleanup (Lane A)
// ---------------------------------------------------------------------------

describe("PiRuntime — abort cleanup", () => {
  it.todo("abort() terminates the session process");
  it.todo("abort() triggers a session_ended event with reason = 'aborted'");
  it.todo("abort() is idempotent — calling it twice does not throw");
  it.todo("abort() preserves the labor worktree directory for post-mortem");
});

// ---------------------------------------------------------------------------
// Event subscription (Lane A)
// ---------------------------------------------------------------------------

describe("PiRuntime — event subscription", () => {
  it.todo("subscribe() returns an unsubscribe function");
  it.todo("unsubscribe function removes the listener — no further events received");
  it.todo("multiple listeners can be registered for the same session");
  it.todo("message events carry full assistant text");
  it.todo("tool_use events carry the canonical tool name");
  it.todo("error events with fatal=true are followed by session_ended");
});

// ---------------------------------------------------------------------------
// Stats reporting (Lane A)
// ---------------------------------------------------------------------------

describe("PiRuntime — stats reporting", () => {
  it.todo("getStats() returns a valid AgentStats snapshot at any point during a session");
  it.todo("getStats() reflects incremental token usage after each turn");
  it.todo("stats_update events are emitted periodically with current stats");
  it.todo("final stats in session_ended match getStats() at termination");
  it.todo("getStats() does not throw after abort");
});
