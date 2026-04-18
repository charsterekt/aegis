import path from "node:path";
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

export interface LaborGitCommand {
  command: string;
  args: readonly string[];
}

export interface LaborCreationRequest {
  issueId: string;
  projectRoot: string;
  baseBranch: string;
  laborBasePath: string;
}

export interface LaborCreationPlan {
  issueId: string;
  projectRoot: string;
  laborPath: string;
  branchName: string;
  baseBranch: string;
  createWorktreeCommand: LaborGitCommand;
}

function sanitizeIssueId(issueId: string) {
  return issueId.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function buildLaborBranchName(issueId: string) {
  return `aegis/${sanitizeIssueId(issueId)}`;
}

export function planLaborCreation(request: LaborCreationRequest): LaborCreationPlan {
  const safeIssueId = sanitizeIssueId(request.issueId);
  const laborRoot = path.isAbsolute(request.laborBasePath)
    ? request.laborBasePath
    : path.join(path.resolve(request.projectRoot), request.laborBasePath);
  const laborPath = path.join(laborRoot, safeIssueId);
  const branchName = buildLaborBranchName(request.issueId);

  return {
    issueId: request.issueId,
    projectRoot: path.resolve(request.projectRoot),
    laborPath,
    branchName,
    baseBranch: request.baseBranch,
    createWorktreeCommand: {
      command: "git",
      args: ["worktree", "add", "-b", branchName, laborPath, request.baseBranch],
    },
  };
}

function runGit(projectRoot: string, args: string[]) {
  return spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
  });
}

function normalizePath(candidate: string) {
  return path.resolve(candidate).toLowerCase();
}

function isKnownWorktreePath(projectRoot: string, laborPath: string) {
  const listed = runGit(projectRoot, ["worktree", "list", "--porcelain"]);
  if (listed.status !== 0) {
    return false;
  }

  const expected = normalizePath(laborPath);
  return listed.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .some((line) => normalizePath(line.slice("worktree ".length)) === expected);
}

function formatGitFailure(result: ReturnType<typeof runGit>) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
}

export function prepareLaborWorktree(plan: LaborCreationPlan) {
  if (isKnownWorktreePath(plan.projectRoot, plan.laborPath)) {
    return;
  }

  mkdirSync(path.dirname(plan.laborPath), { recursive: true });

  const created = runGit(plan.projectRoot, [...plan.createWorktreeCommand.args]);
  if (created.status === 0) {
    return;
  }

  const fallback = runGit(plan.projectRoot, [
    "worktree",
    "add",
    plan.laborPath,
    plan.branchName,
  ]);
  if (fallback.status === 0) {
    return;
  }

  const createError = formatGitFailure(created);
  const fallbackError = formatGitFailure(fallback);
  const detail = [createError, fallbackError].filter((value) => value.length > 0).join(" | ");
  throw new Error(
    `Failed to prepare labor worktree ${plan.laborPath} for issue ${plan.issueId}.${detail.length > 0 ? ` ${detail}` : ""}`,
  );
}
