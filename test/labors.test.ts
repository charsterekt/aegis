// test/labors.test.ts
// Integration tests using real git repos in temp directories.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { create, merge, cleanup, list } from "../src/labors.js";
import type { AegisConfig } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  const dir = join(tmpdir(), `aegis-labors-${randomBytes(6).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function initGitRepo(dir: string): void {
  execFileSync("git", ["init", "-b", "main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@aegis.test"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Aegis Test"], { cwd: dir });
  // Make an initial commit so branches can be created from HEAD
  writeFileSync(join(dir, "README.md"), "# aegis test repo\n");
  execFileSync("git", ["add", "README.md"], { cwd: dir });
  execFileSync("git", ["commit", "-m", "chore: init"], { cwd: dir });
}

function makeConfig(repoDir: string, laborsSubDir = ".aegis/labors"): AegisConfig {
  const laborsPath = join(repoDir, laborsSubDir);
  mkdirSync(laborsPath, { recursive: true });
  return {
    version: 1,
    auth: { anthropic: null, openai: null, google: null },
    models: {
      oracle: "claude-haiku-4-5",
      titan: "claude-sonnet-4-5",
      sentinel: "claude-opus-4-5",
      metis: "claude-haiku-4-5",
      prometheus: "claude-opus-4-5",
    },
    concurrency: { max_agents: 4, max_oracles: 2, max_titans: 2, max_sentinels: 1 },
    budgets: {
      oracle_turns: 20, oracle_tokens: 50000,
      titan_turns: 100, titan_tokens: 200000,
      sentinel_turns: 30, sentinel_tokens: 80000,
    },
    timing: { poll_interval_seconds: 5, stuck_warning_seconds: 120, stuck_kill_seconds: 300 },
    mnemosyne: { max_records: 500, context_budget_tokens: 4000 },
    labors: { base_path: laborsPath },
    olympus: { port: 3737, open_browser: false },
  };
}

let repoDir: string;
let config: AegisConfig;

beforeEach(() => {
  repoDir = makeTempDir();
  initGitRepo(repoDir);
  // Change cwd so git commands run relative to the test repo
  process.chdir(repoDir);
  config = makeConfig(repoDir);
});

afterEach(() => {
  // Return to a safe directory before cleanup
  process.chdir(tmpdir());
  rmSync(repoDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------
describe("create()", () => {
  it("creates a worktree at the correct path", async () => {
    const wtPath = await create("issue-001", config, repoDir);
    const expectedPath = resolve(repoDir, config.labors.base_path, "labor-issue-001");
    expect(wtPath).toBe(expectedPath);
  });

  it("returns an absolute path", async () => {
    const wtPath = await create("issue-002", config, repoDir);
    expect(wtPath.startsWith("/") || /^[A-Za-z]:/.test(wtPath)).toBe(true);
  });

  it("creates the worktree on a branch named aegis/<issueId>", async () => {
    await create("issue-003", config, repoDir);
    // Verify the branch exists
    const branches = execFileSync("git", ["branch", "--list", "aegis/issue-003"], {
      cwd: repoDir,
      encoding: "utf8",
    });
    expect(branches.trim()).toContain("aegis/issue-003");
  });

  it("creates the worktree directory on disk", async () => {
    const wtPath = await create("issue-004", config, repoDir);
    const { existsSync } = await import("node:fs");
    expect(existsSync(wtPath)).toBe(true);
  });

  it("resolves a relative base_path against projectRoot (not process.cwd)", async () => {
    // Use a config with a relative base_path
    const relConfig = { ...config, labors: { base_path: ".aegis/labors" } };
    const wtPath = await create("issue-rel-001", relConfig, repoDir);
    // Must be under repoDir, not process.cwd()
    expect(wtPath.startsWith(repoDir)).toBe(true);
    await cleanup("issue-rel-001", relConfig, repoDir);
  });
});

// ---------------------------------------------------------------------------
// list()
// ---------------------------------------------------------------------------
describe("list()", () => {
  it("returns empty array when no labors exist", async () => {
    const result = await list(config, repoDir);
    expect(result).toEqual([]);
  });

  it("returns issue IDs for active labors", async () => {
    await create("issue-010", config, repoDir);
    await create("issue-011", config, repoDir);

    const result = await list(config, repoDir);
    expect(result).toContain("issue-010");
    expect(result).toContain("issue-011");
  });

  it("does not include the main worktree in results", async () => {
    await create("issue-012", config, repoDir);
    const result = await list(config, repoDir);
    // Main repo path should not be included (it's not under the labors base_path)
    expect(result).not.toContain("");
    expect(result.every((id) => id.length > 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cleanup()
// ---------------------------------------------------------------------------
describe("cleanup()", () => {
  it("removes the worktree and deletes the branch", async () => {
    await create("issue-020", config, repoDir);

    await cleanup("issue-020", config, repoDir);

    // Branch should be gone
    const branches = execFileSync("git", ["branch", "--list", "aegis/issue-020"], {
      cwd: repoDir,
      encoding: "utf8",
    });
    expect(branches.trim()).toBe("");
  });

  it("handles already-removed worktrees without throwing", async () => {
    // Cleanup a non-existent labor — should not throw
    await expect(cleanup("issue-nonexistent", config, repoDir)).resolves.not.toThrow();
  });

  it("removes the issue from the list after cleanup", async () => {
    await create("issue-021", config, repoDir);
    await cleanup("issue-021", config, repoDir);

    const result = await list(config, repoDir);
    expect(result).not.toContain("issue-021");
  });
});

// ---------------------------------------------------------------------------
// merge()
// ---------------------------------------------------------------------------
describe("merge()", () => {
  it("successfully merges a branch with new commits", async () => {
    const wtPath = await create("issue-030", config, repoDir);

    // Make a commit in the worktree
    writeFileSync(join(wtPath, "feature.txt"), "new feature\n");
    execFileSync("git", ["add", "feature.txt"], { cwd: wtPath });
    execFileSync("git", ["commit", "-m", "feat: add feature"], { cwd: wtPath });

    const result = await merge("issue-030", config, repoDir);

    expect(result.success).toBe(true);
    expect(result.conflict).toBeUndefined();
  });

  it("returns success:false on merge conflict and aborts", async () => {
    const wtPath = await create("issue-031", config, repoDir);

    // Make conflicting changes in both branches
    // Worktree branch: modify README
    writeFileSync(join(wtPath, "README.md"), "# worktree version\n");
    execFileSync("git", ["add", "README.md"], { cwd: wtPath });
    execFileSync("git", ["commit", "-m", "feat: wt change"], { cwd: wtPath });

    // Main branch: also modify README (creating a conflict)
    execFileSync("git", ["checkout", "main"], { cwd: repoDir });
    writeFileSync(join(repoDir, "README.md"), "# main version\n");
    execFileSync("git", ["add", "README.md"], { cwd: repoDir });
    execFileSync("git", ["commit", "-m", "fix: main change"], { cwd: repoDir });

    const result = await merge("issue-031", config, repoDir);

    expect(result.success).toBe(false);
    expect(result.conflict).toBeTruthy();
    expect(typeof result.conflict).toBe("string");

    // Verify no merge is in progress after abort.
    // git rev-parse MERGE_HEAD exits non-zero when there's no active merge — that's success.
    let mergeInProgress = false;
    try {
      execFileSync("git", ["rev-parse", "--verify", "MERGE_HEAD"], {
        cwd: repoDir,
        encoding: "utf8",
        stdio: "pipe",
      });
      mergeInProgress = true; // If it succeeded, a merge is still in progress
    } catch {
      mergeInProgress = false; // Non-zero exit = no active merge = abort succeeded
    }
    expect(mergeInProgress).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Windows path compatibility
// ---------------------------------------------------------------------------
describe("Windows path compatibility", () => {
  it("create() works with paths that contain backslashes on Windows (normalize)", async () => {
    // Simulate a config where base_path has backslashes
    const backslashConfig = {
      ...config,
      labors: { base_path: config.labors.base_path.replace(/\//g, "\\") },
    };
    // Should not throw regardless of slash style
    await expect(create("issue-win-001", backslashConfig, repoDir)).resolves.toBeTruthy();
    await cleanup("issue-win-001", backslashConfig, repoDir);
  });

  it("list() normalizes paths and extracts issue IDs correctly", async () => {
    await create("issue-win-002", config, repoDir);
    const result = await list(config, repoDir);
    expect(result).toContain("issue-win-002");
    await cleanup("issue-win-002", config, repoDir);
  });
});
