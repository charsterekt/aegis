/**
 * Merge application — S14 implementation.
 *
 * SPECv2 §12.6 and §12.8:
 *   - attempt merge of candidate branch into target branch
 *   - Tier 0: clean merge succeeds
 *   - Tier 1: simple rebase or stale branch — create rework
 *   - Tier 2: hard conflict — preserve labor, create conflict issue
 *   - Tier 3: Janus escalation threshold reached
 */

import { spawnSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Merge input and result types
// ---------------------------------------------------------------------------

/** Input for attempting a merge. */
export interface MergeAttemptInput {
  /** The candidate branch name to merge from. */
  candidateBranch: string;

  /** The target branch name to merge into. */
  targetBranch: string;

  /** The project root for git operations. */
  projectRoot: string;

  /** The labor path associated with this candidate (for preservation). */
  laborPath: string;

  /** The Beads issue ID associated with this merge. */
  issueId: string;

  /** Current attempt count from the queue item. */
  attemptCount: number;

  /** Maximum retries before Janus escalation. */
  maxRetryBeforeJanus: number;
}

/** Conflict tier classification (SPECv2 §12.8). */
export type ConflictTier = 0 | 1 | 2 | 3;

/** Result of a merge attempt. */
export interface MergeAttemptResult {
  /** Whether the merge attempt was successful (Tier 0). */
  success: boolean;

  /** The conflict tier classification. */
  conflictTier: ConflictTier;

  /** The merge outcome string (SPECv2 §12.9). */
  outcome: "MERGED" | "MERGE_FAILED" | "REWORK_REQUEST";

  /** Human-readable description of the result. */
  detail: string;

  /** Whether the labor was preserved after the attempt. */
  laborPreserved: boolean;

  /** Optional error message if the merge attempt encountered errors. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a merge result into a conflict tier.
 *
 * Classification rules (SPECv2 §12.8):
 *   - Tier 0: merge succeeded, no conflicts
 *   - Tier 1: stale branch or simple rebase needed — reworkable
 *   - Tier 2: hard conflict — files conflict, labor must be preserved
 *   - Tier 3: repeated failures or retry threshold reached — Janus candidate
 *
 * @param mergeOutput - Captured output from the merge command.
 * @param exitCode - Exit code from the merge command.
 * @param attemptCount - Number of prior attempts for this item.
 * @param maxRetryBeforeJanus - Maximum retries before Janus escalation.
 * @returns The classified conflict tier.
 */
export function classifyConflictTier(
  mergeOutput: string,
  exitCode: number,
  attemptCount: number,
  maxRetryBeforeJanus: number,
): ConflictTier {
  if (exitCode === 0) {
    return 0; // Tier 0: clean merge
  }

  // Check if retry threshold for Janus escalation is reached
  if (attemptCount >= maxRetryBeforeJanus) {
    return 3; // Tier 3: Janus escalation
  }

  // Check for conflict markers in output
  const hasConflicts =
    mergeOutput.includes("CONFLICT") ||
    mergeOutput.includes("Automatic merge failed") ||
    mergeOutput.includes("Merge conflict");

  if (hasConflicts) {
    return 2; // Tier 2: hard conflict
  }

  // Default to Tier 1: stale branch or rebase needed
  return 1;
}

/**
 * Attempt to merge a candidate branch into the target branch.
 *
 * This function:
 *   1. Fetches the latest state of the target branch
 *   2. Checks out the target branch
 *   3. Attempts the merge with --no-edit to avoid interactive prompts
 *   4. Classifies the result by conflict tier
 *   5. Returns the attempt result WITHOUT mutating dispatch state
 *
 * The caller is responsible for:
 *   - transitioning dispatch state based on the result
 *   - preserving labor on non-Tier-0 outcomes
 *   - emitting SSE events
 *   - creating follow-up issues
 *
 * @param input - Merge attempt input.
 * @returns Result of the merge attempt.
 */
export async function attemptMerge(
  input: MergeAttemptInput,
): Promise<MergeAttemptResult> {
  try {
    // Step 1: Check if remote exists before fetching
    const hasRemote = spawnSync("git", ["remote", "get-url", "origin"], {
      cwd: input.projectRoot,
      timeout: 5_000,
      windowsHide: true,
    });

    if (hasRemote.status === 0) {
      // Fetch latest only if remote exists
      spawnSync("git", ["fetch", "origin"], {
        cwd: input.projectRoot,
        timeout: 30_000,
        encoding: "utf-8",
        windowsHide: true,
      });
    }

    // Step 2: Check out the target branch
    const checkoutResult = spawnSync(
      "git",
      ["checkout", input.targetBranch],
      {
        cwd: input.projectRoot,
        timeout: 30_000,
        encoding: "utf-8",
        windowsHide: true,
      },
    );

    if (checkoutResult.status !== 0) {
      return {
        success: false,
        conflictTier: 1,
        outcome: "REWORK_REQUEST",
        detail: `Failed to checkout target branch: ${checkoutResult.stderr?.trim() ?? "unknown error"}`,
        laborPreserved: true,
        error: checkoutResult.stderr?.trim(),
      };
    }

    // Step 3: Pull latest on target branch
    const pullResult = spawnSync(
      "git",
      ["pull", "origin", input.targetBranch],
      {
        cwd: input.projectRoot,
        timeout: 30_000,
        encoding: "utf-8",
        windowsHide: true,
      },
    );

    if (pullResult.status !== 0) {
      return {
        success: false,
        conflictTier: 1,
        outcome: "REWORK_REQUEST",
        detail: `Failed to pull target branch: ${pullResult.stderr?.trim() ?? "unknown error"}`,
        laborPreserved: true,
        error: pullResult.stderr?.trim(),
      };
    }

    // Step 4: Attempt the merge with --no-edit to avoid interactive editor
    const mergeResult = spawnSync(
      "git",
      ["merge", "--no-edit", input.candidateBranch],
      {
        cwd: input.projectRoot,
        timeout: 60_000,
        encoding: "utf-8",
        windowsHide: true,
      },
    );

    const mergeOutput = `${mergeResult.stdout ?? ""} ${mergeResult.stderr ?? ""}`.trim();
    const exitCode = mergeResult.status ?? 1;

    // Classify the result
    const conflictTier = classifyConflictTier(
      mergeOutput,
      exitCode,
      input.attemptCount,
      input.maxRetryBeforeJanus,
    );

    if (conflictTier === 0) {
      // Tier 0: clean merge
      return {
        success: true,
        conflictTier: 0,
        outcome: "MERGED",
        detail: "Clean merge succeeded",
        laborPreserved: false,
      };
    }

    // Tier 1: stale branch or rebase needed
    if (conflictTier === 1) {
      // Abort the merge to leave repo in clean state
      spawnSync("git", ["merge", "--abort"], {
        cwd: input.projectRoot,
        timeout: 10_000,
        windowsHide: true,
      });

      return {
        success: false,
        conflictTier: 1,
        outcome: "REWORK_REQUEST",
        detail: `Stale branch or rebase needed: ${mergeOutput}`,
        laborPreserved: true,
      };
    }

    // Tier 2: hard conflict — abort merge, preserve labor
    if (conflictTier === 2) {
      spawnSync("git", ["merge", "--abort"], {
        cwd: input.projectRoot,
        timeout: 10_000,
        windowsHide: true,
      });

      return {
        success: false,
        conflictTier: 2,
        outcome: "MERGE_FAILED",
        detail: `Hard merge conflict: ${mergeOutput}`,
        laborPreserved: true,
      };
    }

    // Tier 3: Janus escalation
    return {
      success: false,
      conflictTier: 3,
      outcome: "MERGE_FAILED",
      detail: `Janus escalation threshold reached: ${mergeOutput}`,
      laborPreserved: true,
    };
  } catch (err) {
    // Ensure we abort any in-progress merge on error
    spawnSync("git", ["merge", "--abort"], {
      cwd: input.projectRoot,
      timeout: 10_000,
      windowsHide: true,
    });

    return {
      success: false,
      conflictTier: 2,
      outcome: "MERGE_FAILED",
      detail: `Merge attempt crashed: ${(err as Error).message}`,
      laborPreserved: true,
      error: (err as Error).message,
    };
  }
}
