import path from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { runMockCommand, type RunMockCommandOptions } from "./mock-run.js";
import { resolveDefaultMockWorkspaceRoot } from "./mock-paths.js";
import { seedMockRun, type SeedMockRunResult } from "./seed-mock-run.js";
import { BeadsTrackerClient } from "../tracker/beads-tracker.js";
import type { RuntimeStateRecord } from "../cli/runtime-state.js";
import { readRuntimeState } from "../cli/runtime-state.js";
import type { AegisIssue } from "../tracker/issue-model.js";

const FINAL_GATE_ISSUE_KEY = "integration.gate";
const REQUIRED_APP_FILES = [
  "package.json",
  "README.md",
  "src/main.tsx",
  "src/App.tsx",
] as const;

const DEFAULT_COMPLETION_TIMEOUT_MS = 15 * 60 * 1_000;
const DEFAULT_COMPLETION_POLL_MS = 2_000;

type MockCommandRunner = (
  args: string[],
  options?: RunMockCommandOptions,
) => Promise<unknown>;

interface TrackerLike {
  getIssue(id: string, root?: string): Promise<AegisIssue>;
}

function resolveAegisCliPath() {
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDirectory = path.dirname(currentFilePath);
  return path.resolve(currentDirectory, "..", "..", "dist", "index.js");
}

export interface MockAcceptanceDependencies {
  cwd?: string;
  seedMockRun?: typeof seedMockRun;
  runMockCommand?: MockCommandRunner;
  collectMockAcceptanceSurface?: typeof collectMockAcceptanceSurface;
  tracker?: TrackerLike;
  completionTimeoutMs?: number;
  completionPollMs?: number;
}

export interface MockAcceptanceIssueSummary {
  id: string;
  title: string;
  status: string;
}

export interface MockAcceptancePhaseLogSummary {
  timestamp: string;
  phase: "poll" | "triage" | "dispatch" | "monitor" | "reap";
  issueId: string;
  action: string;
  outcome: string;
  detail: string | null;
}

export interface MockAcceptanceAppSummary {
  requiredFiles: Record<string, boolean>;
  readmeHasInstall: boolean;
  readmeHasDev: boolean;
  readmeHasLocalhost: boolean;
}

export interface MockAcceptanceSurface {
  runtimeState: RuntimeStateRecord;
  trackerIssues: {
    finalGate: MockAcceptanceIssueSummary;
  };
  phaseLogs: MockAcceptancePhaseLogSummary[];
  app: MockAcceptanceAppSummary;
}

export interface MockAcceptanceResult {
  repoRoot: string;
  seed: SeedMockRunResult;
  finalGateIssueId: string;
  surface: MockAcceptanceSurface;
}

function requireIssueId(seed: SeedMockRunResult, key: string) {
  const issueId = seed.issueIdByKey[key];
  if (!issueId) {
    throw new Error(`Seeded mock run is missing required issue key "${key}".`);
  }

  return issueId;
}

function readPhaseLogs(root: string): MockAcceptancePhaseLogSummary[] {
  const logDirectory = path.join(root, ".aegis", "logs", "phases");
  if (!existsSync(logDirectory)) {
    throw new Error(`Missing phase log directory at ${logDirectory}.`);
  }

  return readdirSync(logDirectory)
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .map((entry) => {
      const raw = readFileSync(path.join(logDirectory, entry), "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        timestamp: String(parsed.timestamp ?? ""),
        phase: parsed.phase as MockAcceptancePhaseLogSummary["phase"],
        issueId: String(parsed.issueId ?? ""),
        action: String(parsed.action ?? ""),
        outcome: String(parsed.outcome ?? ""),
        detail: typeof parsed.detail === "string" ? parsed.detail : null,
      };
    });
}

async function readIssueSummary(
  tracker: TrackerLike,
  root: string,
  issueId: string,
): Promise<MockAcceptanceIssueSummary> {
  const issue = await tracker.getIssue(issueId, root);
  return {
    id: issue.id,
    title: issue.title,
    status: issue.status,
  };
}

function readAppSummary(root: string): MockAcceptanceAppSummary {
  const requiredFiles = Object.fromEntries(
    REQUIRED_APP_FILES.map((relativePath) => [
      relativePath,
      existsSync(path.join(root, relativePath)),
    ]),
  ) as Record<string, boolean>;

  const readmePath = path.join(root, "README.md");
  const readme = existsSync(readmePath) ? readFileSync(readmePath, "utf8").toLowerCase() : "";

  return {
    requiredFiles,
    readmeHasInstall: readme.includes("npm install"),
    readmeHasDev: readme.includes("npm run dev"),
    readmeHasLocalhost: readme.includes("localhost"),
  };
}

export async function collectMockAcceptanceSurface(
  root: string,
  issueIds: { finalGateIssueId: string; tracker?: TrackerLike },
): Promise<MockAcceptanceSurface> {
  const runtimeState = readRuntimeState(root);
  if (!runtimeState) {
    throw new Error(`Missing runtime state at ${path.join(root, ".aegis", "runtime-state.json")}.`);
  }

  const tracker = issueIds.tracker ?? new BeadsTrackerClient();
  const finalGate = await readIssueSummary(tracker, root, issueIds.finalGateIssueId);

  return {
    runtimeState,
    trackerIssues: {
      finalGate,
    },
    phaseLogs: readPhaseLogs(root),
    app: readAppSummary(root),
  };
}

export function assertMockAcceptanceSurface(surface: MockAcceptanceSurface) {
  if (surface.runtimeState.server_state !== "stopped") {
    throw new Error(`Expected mock-run runtime to be stopped, got ${surface.runtimeState.server_state}.`);
  }

  if (surface.trackerIssues.finalGate.status !== "closed") {
    throw new Error(
      `Expected final integration gate issue to be closed, got ${surface.trackerIssues.finalGate.status}.`,
    );
  }

  for (const requiredFile of REQUIRED_APP_FILES) {
    if (!surface.app.requiredFiles[requiredFile]) {
      throw new Error(`Missing required app file: ${requiredFile}`);
    }
  }

  if (!surface.app.readmeHasInstall || !surface.app.readmeHasDev || !surface.app.readmeHasLocalhost) {
    throw new Error("README proof is missing npm install, npm run dev, or localhost guidance.");
  }

  if (!surface.phaseLogs.some((entry) => entry.phase === "poll")) {
    throw new Error("Phase log evidence is missing the poll phase.");
  }

  if (!surface.phaseLogs.some((entry) => entry.phase === "dispatch")) {
    throw new Error("Phase log evidence is missing the dispatch phase.");
  }

  if (!surface.phaseLogs.some((entry) => entry.phase === "monitor")) {
    throw new Error("Phase log evidence is missing the monitor phase.");
  }

  if (!surface.phaseLogs.some((entry) => entry.phase === "reap")) {
    throw new Error("Phase log evidence is missing the reap phase.");
  }
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForIssueClosed(
  tracker: TrackerLike,
  root: string,
  issueId: string,
  timeoutMs: number,
  pollMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const issue = await tracker.getIssue(issueId, root);
    if (issue.status === "closed") {
      return;
    }

    await sleep(pollMs);
  }

  throw new Error(`Timed out waiting for issue ${issueId} to close after ${timeoutMs}ms.`);
}

export async function runMockAcceptance(
  options: MockAcceptanceDependencies = {},
): Promise<MockAcceptanceResult> {
  const workspaceRoot = options.cwd
    ? path.resolve(options.cwd)
    : resolveDefaultMockWorkspaceRoot();
  const aegisCliPath = resolveAegisCliPath();
  const seed = await (options.seedMockRun ?? seedMockRun)({ workspaceRoot });
  const finalGateIssueId = requireIssueId(seed, FINAL_GATE_ISSUE_KEY);
  const runCommand = options.runMockCommand ?? runMockCommand;
  const collectSurface = options.collectMockAcceptanceSurface ?? collectMockAcceptanceSurface;
  const tracker = options.tracker ?? new BeadsTrackerClient();

  await runCommand(["node", aegisCliPath, "start", "--view-agent-sessions"], { mockDir: seed.repoRoot });
  await runCommand(["node", aegisCliPath, "status"], { mockDir: seed.repoRoot });

  await waitForIssueClosed(
    tracker,
    seed.repoRoot,
    finalGateIssueId,
    options.completionTimeoutMs ?? DEFAULT_COMPLETION_TIMEOUT_MS,
    options.completionPollMs ?? DEFAULT_COMPLETION_POLL_MS,
  );

  await runCommand(["node", aegisCliPath, "stop"], { mockDir: seed.repoRoot });
  await runCommand(["node", aegisCliPath, "status"], { mockDir: seed.repoRoot });

  const surface = await collectSurface(seed.repoRoot, {
    finalGateIssueId,
    tracker,
  });
  assertMockAcceptanceSurface(surface);

  return {
    repoRoot: seed.repoRoot,
    seed,
    finalGateIssueId,
    surface,
  };
}

function isDirectExecution(entryPoint = process.argv[1]): boolean {
  if (!entryPoint) {
    return false;
  }

  return path.resolve(entryPoint) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  runMockAcceptance().then(
    (result) => {
      console.log(`Mock acceptance completed at ${result.repoRoot}`);
      console.log(`Final integration gate issue: ${result.finalGateIssueId}`);
    },
    (error: unknown) => {
      const details = error instanceof Error ? error.message : String(error);
      console.error(details);
      process.exitCode = 1;
    },
  );
}
