/**
 * Queue worker skeleton — merge queue processing loop.
 *
 * SPECv2 §12.5 and §12.6:
 *   - FIFO ordering for queue processing
 *   - one active merge worker at a time for correctness
 *   - mechanical checks before human or LLM escalation
 *   - Janus invocation only through deterministic policy gates
 *
 * This file provides the worker skeleton that lanes will implement.
 * The actual merge gate execution and outcome handling are implemented in S14.
 */

import type { MergeQueueState, QueueItem } from "./merge-queue-store.js";
import type { LiveEventPublisher } from "../events/event-bus.js";

/** Configuration for the queue worker. */
export interface QueueWorkerConfig {
  /** Project root for file operations. */
  projectRoot: string;

  /** Event publisher for queue state changes. */
  eventPublisher: LiveEventPublisher;

  /** Whether Janus escalation is enabled. */
  janusEnabled: boolean;

  /** Maximum merge retry attempts before escalation. */
  maxRetryAttempts: number;
}

/** Result of a queue processing cycle. */
export interface QueueProcessingResult {
  /** The issue ID that was processed. */
  issueId: string;

  /** Whether processing succeeded. */
  success: boolean;

  /** Optional error message if processing failed. */
  error?: string;

  /** The new queue item status after processing. */
  newStatus: QueueItem["status"];
}

/**
 * Process the next item in the merge queue.
 *
 * This is the skeleton entry point. S14 will implement the actual merge
 * gate execution, conflict handling, and outcome artifacts.
 *
 * For S13, this skeleton:
 *   - accepts the queue state and config
 *   - marks the next queued item as active
 *   - returns a placeholder result (actual merge logic in S14)
 *
 * @param state - Current merge queue state.
 * @param config - Worker configuration.
 * @returns Processing result with the item's new status.
 */
export async function processNextQueueItem(
  state: MergeQueueState,
  config: QueueWorkerConfig,
): Promise<QueueProcessingResult | null> {
  // Find the next queued item (FIFO)
  const nextItem = state.items
    .filter((item) => item.status === "queued")
    .sort((a, b) => a.position - b.position)[0];

  if (!nextItem) {
    return null;
  }

  // S13 skeleton: mark as active, S14 will implement actual merge
  const updatedItem: QueueItem = {
    ...nextItem,
    status: "active",
    attemptCount: nextItem.attemptCount + 1,
    updatedAt: new Date().toISOString(),
  };

  // Publish event for queue state change
  config.eventPublisher.publish({
    id: crypto.randomUUID(),
    type: "merge.queue_state",
    timestamp: new Date().toISOString(),
    sequence: state.items.length + 1,
    payload: {
      issueId: nextItem.issueId,
      status: "active",
      attemptCount: updatedItem.attemptCount,
    },
  });

  return {
    issueId: nextItem.issueId,
    success: false, // S14 will implement actual merge logic
    error: "Merge gate execution not yet implemented (S14)",
    newStatus: "active",
  };
}

/**
 * Get the current queue depth for monitoring and Olympus display.
 *
 * @param state - Current merge queue state.
 * @returns Number of items waiting or being processed.
 */
export function getQueueDepth(state: MergeQueueState): number {
  return state.items.filter(
    (item) =>
      item.status === "queued" || item.status === "active",
  ).length;
}
