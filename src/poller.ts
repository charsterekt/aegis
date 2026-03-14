// src/poller.ts
// Poller — POLL step of the Layer 1 deterministic dispatch loop.
// Polls the beads ready queue and diffs against running agents.
// Module boundary: calls beads module functions, never shells out to bd directly.

import type { BeadsIssue, AgentState } from "./types.js";
import * as beads from "./beads.js";

/**
 * Polls the beads ready queue and returns all ready issues.
 */
export async function poll(): Promise<BeadsIssue[]> {
  return beads.ready();
}

/**
 * Diffs the ready issue list against currently running agents.
 * Returns only issues that are NOT already being worked on by a running agent.
 *
 * @param ready - The full list of ready issues from beads
 * @param running - Map of issue ID → AgentState for all running agents
 */
export function diff(
  ready: BeadsIssue[],
  running: Map<string, AgentState>
): BeadsIssue[] {
  return ready.filter((issue) => !running.has(issue.id));
}
