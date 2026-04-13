/**
 * Dashboard event helpers — factory functions for normalized live events
 * consumed by the dashboard state store and Olympus SSE stream.
 */

import type { AegisLiveEvent } from "../events/event-bus.js";

let _sequenceCounter = 1;

function nextSequence(): number {
  return _sequenceCounter++;
}

/**
 * Create a loop phase log event.
 */
export function createLoopPhaseLog(
  phase: "poll" | "dispatch" | "monitor" | "reap",
  line: string,
  issueId?: string | null,
  agentId?: string | null,
): AegisLiveEvent {
  return {
    id: `evt-${nextSequence()}`,
    type: "loop.phase_log",
    timestamp: new Date().toISOString(),
    sequence: nextSequence(),
    payload: {
      phase,
      line,
      level: "info",
      issueId: issueId ?? null,
      agentId: agentId ?? null,
    },
  };
}

/**
 * Create an agent session started event.
 */
export function createAgentSessionStarted(
  sessionId: string,
  caste: "oracle" | "titan" | "sentinel" | "janus",
  issueId: string,
  stage: string,
  model: string,
): AegisLiveEvent {
  return {
    id: `evt-${nextSequence()}`,
    type: "agent.session_started",
    timestamp: new Date().toISOString(),
    sequence: nextSequence(),
    payload: { sessionId, caste, issueId, stage, model },
  };
}

/**
 * Create an agent session ended event.
 */
export function createAgentSessionEnded(
  sessionId: string,
  caste: "oracle" | "titan" | "sentinel" | "janus",
  issueId: string,
  outcome: "completed" | "failed" | "aborted",
): AegisLiveEvent {
  return {
    id: `evt-${nextSequence()}`,
    type: "agent.session_ended",
    timestamp: new Date().toISOString(),
    sequence: nextSequence(),
    payload: { sessionId, caste, issueId, outcome },
  };
}

/**
 * Create an agent session log event for real-time terminal output.
 */
export function createAgentSessionLog(
  sessionId: string,
  caste: "oracle" | "titan" | "sentinel" | "janus",
  issueId: string,
  line: string,
  level: "info" | "warn" | "error" = "info",
): AegisLiveEvent {
  return {
    id: `evt-${nextSequence()}`,
    type: "agent.session_log",
    timestamp: new Date().toISOString(),
    sequence: nextSequence(),
    payload: { sessionId, caste, issueId, line, level },
  };
}

/**
 * Create a merge queue log event.
 */
export function createMergeQueueLog(
  issueId: string,
  status: string,
  attemptCount: number,
): AegisLiveEvent {
  return {
    id: `evt-${nextSequence()}`,
    type: "merge.queue_log",
    timestamp: new Date().toISOString(),
    sequence: nextSequence(),
    payload: { issueId, status, attemptCount },
  };
}
