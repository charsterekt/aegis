// src/labors.ts
// Labors — git worktree lifecycle management for Titan agent isolation.
// This is the ONLY module that runs git worktree commands.
// No other module should call `git worktree` directly.

import { execFile } from "node:child_process";
import { join, resolve } from "node:path";
import type { AegisConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function runGit(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolveFn, reject) => {
    execFile("git", args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(
          new Error(`git ${args[0] ?? ""} failed: ${stderr.trim() || error.message}`)
        );
        return;
      }
      resolveFn(stdout);
    });
  });
}

/** Absolute path to the worktree directory for a given issue. */
function worktreePath(issueId: string, config: AegisConfig): string {
  return resolve(join(config.labors.base_path, `labor-${issueId}`));
}

/** Git branch name for a Labor. */
function branchName(issueId: string): string {
  return `aegis/${issueId}`;
}

/** Normalize backslashes to forward slashes for git CLI compatibility on Windows. */
function toForwardSlashes(p: string): string {
  return p.replace(/\\/g, "/");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a new git worktree for the given issue on a dedicated branch.
 * Returns the absolute path to the worktree directory.
 */
export async function create(issueId: string, config: AegisConfig): Promise<string> {
  const wtPath = worktreePath(issueId, config);
  const branch = branchName(issueId);
  const gitPath = toForwardSlashes(wtPath);
  await runGit(["worktree", "add", gitPath, "-b", branch]);
  return wtPath;
}

/**
 * Merges the Labor branch back into main.
 * On success returns { success: true }.
 * On merge conflict, aborts and returns { success: false, conflict: <message> }.
 */
export async function merge(
  issueId: string,
  _config: AegisConfig
): Promise<{ success: boolean; conflict?: string }> {
  const branch = branchName(issueId);
  try {
    await runGit(["checkout", "main"]);
    await runGit(["merge", branch, "--no-edit"]);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Attempt to abort the merge; ignore errors if nothing to abort
    try {
      await runGit(["merge", "--abort"]);
    } catch {
      // ignore
    }
    return { success: false, conflict: msg };
  }
}

/**
 * Removes the worktree directory and deletes the Labor branch.
 * Handles already-removed worktrees gracefully (does not throw).
 */
export async function cleanup(issueId: string, config: AegisConfig): Promise<void> {
  const wtPath = worktreePath(issueId, config);
  const branch = branchName(issueId);
  const gitPath = toForwardSlashes(wtPath);

  try {
    await runGit(["worktree", "remove", gitPath, "--force"]);
  } catch {
    // Worktree already removed or not registered — proceed to branch cleanup
  }

  try {
    await runGit(["branch", "-D", branch]);
  } catch {
    // Branch may already be deleted
  }
}

/**
 * Lists the issue IDs of all active Labors (git worktrees under the base path).
 */
export async function list(config: AegisConfig): Promise<string[]> {
  const output = await runGit(["worktree", "list", "--porcelain"]);
  const basePath = toForwardSlashes(resolve(config.labors.base_path));
  const issueIds: string[] = [];

  // git worktree list --porcelain outputs blocks separated by blank lines.
  // Each block starts with "worktree <path>"
  for (const block of output.split(/\n\n+/)) {
    const lines = block.split("\n");
    const wtLine = lines.find((l) => l.startsWith("worktree "));
    if (!wtLine) continue;

    const wPath = toForwardSlashes(wtLine.slice("worktree ".length).trim());
    if (!wPath.startsWith(basePath)) continue;

    const dirName = wPath.split("/").pop() ?? "";
    if (dirName.startsWith("labor-")) {
      issueIds.push(dirName.slice("labor-".length));
    }
  }

  return issueIds;
}
