import { spawnSync } from "node:child_process";

import { persistArtifact } from "./artifact-store.js";

type GitProofFamily = "titan" | "janus";

interface GitSnapshot {
  branch: string | null;
  statusLines: string[];
  changedFiles: string[];
  diff: string;
}

export interface GitProofRefs {
  statusBeforeRef: string | null;
  statusAfterRef: string | null;
  changedFilesManifestRef: string | null;
  diffRef: string | null;
}

function runGit(workingDirectory: string, args: string[]) {
  return spawnSync("git", args, {
    cwd: workingDirectory,
    encoding: "utf8",
    windowsHide: true,
  });
}

function isGitWorkingTree(workingDirectory: string) {
  const probe = runGit(workingDirectory, ["rev-parse", "--is-inside-work-tree"]);
  return probe.status === 0 && probe.stdout.trim() === "true";
}

function parseChangedFiles(statusLines: string[]) {
  const files = new Set<string>();

  for (const line of statusLines) {
    if (line.startsWith("##")) {
      continue;
    }

    const rawPath = line.length > 3 ? line.slice(3).trim() : "";
    if (rawPath.length === 0) {
      continue;
    }

    const normalizedPath = rawPath.includes(" -> ")
      ? rawPath.split(" -> ").at(-1) ?? rawPath
      : rawPath;
    files.add(normalizedPath);
  }

  return [...files].sort();
}

function captureGitSnapshot(workingDirectory: string): GitSnapshot | null {
  if (!isGitWorkingTree(workingDirectory)) {
    return null;
  }

  const branch = runGit(workingDirectory, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const status = runGit(workingDirectory, ["status", "--porcelain", "--branch", "--untracked-files=all"]);
  const diff = runGit(workingDirectory, ["diff", "--no-color"]);
  const stagedDiff = runGit(workingDirectory, ["diff", "--no-color", "--staged"]);

  if (status.status !== 0) {
    return null;
  }

  const statusLines = status.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  const diffChunks = [diff.stdout, stagedDiff.stdout]
    .map((chunk) => chunk.trimEnd())
    .filter((chunk) => chunk.length > 0);

  return {
    branch: branch.status === 0 ? branch.stdout.trim() : null,
    statusLines,
    changedFiles: parseChangedFiles(statusLines),
    diff: diffChunks.join("\n\n"),
  };
}

export function captureGitProofPair(
  workingDirectory: string,
): { before: GitSnapshot | null; after: GitSnapshot | null } {
  const before = captureGitSnapshot(workingDirectory);
  return {
    before,
    after: null,
  };
}

export function completeGitProofPair(
  workingDirectory: string,
  proofPair: { before: GitSnapshot | null; after: GitSnapshot | null },
): { before: GitSnapshot | null; after: GitSnapshot | null } {
  return {
    before: proofPair.before,
    after: captureGitSnapshot(workingDirectory),
  };
}

export function persistGitProofArtifacts(
  root: string,
  family: GitProofFamily,
  issueId: string,
  workingDirectory: string,
  proofPair: { before: GitSnapshot | null; after: GitSnapshot | null },
): GitProofRefs {
  const before = proofPair.before;
  const after = proofPair.after;

  const statusBeforeRef = before
    ? persistArtifact(root, {
      family,
      issueId,
      artifactId: "git-status-before",
      artifact: {
        issueId,
        workingDirectory,
        branch: before.branch,
        statusLines: before.statusLines,
      },
    })
    : null;

  const statusAfterRef = after
    ? persistArtifact(root, {
      family,
      issueId,
      artifactId: "git-status-after",
      artifact: {
        issueId,
        workingDirectory,
        branch: after.branch,
        statusLines: after.statusLines,
      },
    })
    : null;

  const changedFilesManifestRef = after
    ? persistArtifact(root, {
      family,
      issueId,
      artifactId: "changed-files",
      artifact: {
        issueId,
        workingDirectory,
        files: after.changedFiles,
      },
    })
    : null;

  const diffRef = after
    ? persistArtifact(root, {
      family,
      issueId,
      artifactId: "git-diff",
      artifact: {
        issueId,
        workingDirectory,
        diff: after.diff,
      },
    })
    : null;

  return {
    statusBeforeRef,
    statusAfterRef,
    changedFilesManifestRef,
    diffRef,
  };
}
