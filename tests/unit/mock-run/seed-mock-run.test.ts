import path from "node:path";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { CASTE_CONFIG_KEYS } from "../../../src/config/caste-config.js";
import { DEFAULT_AEGIS_CONFIG } from "../../../src/config/defaults.js";
import { CONFIG_TOP_LEVEL_KEYS } from "../../../src/config/schema.js";
import { pollReadyWork } from "../../../src/core/poller.js";
import { triageReadyWork } from "../../../src/core/triage.js";
import { emptyDispatchState, saveDispatchState } from "../../../src/core/dispatch-state.js";
import { AgoraTrackerClient } from "../../../src/tracker/agora-tracker.js";
import { TODO_MOCK_RUN_MANIFEST } from "../../../src/mock-run/todo-manifest.js";
import {
  buildMockRunConfig,
  MOCK_RUN_LABOR_BASE_PATH,
  seedMockRun,
} from "../../../src/mock-run/seed-mock-run.js";

const tempRoots: string[] = [];

function createWorkspaceRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "aegis-mock-seed-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("buildMockRunConfig", () => {
  it("builds a deterministic proof mock-run config from central defaults", () => {
    const config = buildMockRunConfig();

    expect(Object.keys(config)).toEqual(CONFIG_TOP_LEVEL_KEYS);
    expect(config.runtime).toBe("scripted");
    for (const caste of CASTE_CONFIG_KEYS) {
      expect(config.models[caste]).toBe("openai-codex:gpt-5.4-mini");
      expect(config.thinking[caste]).toBe("medium");
    }
    expect(config.labor.base_path).toBe(MOCK_RUN_LABOR_BASE_PATH);
    expect(config.concurrency).toEqual({
      max_agents: 10,
      max_oracles: 5,
      max_titans: 10,
      max_sentinels: 3,
      max_janus: 2,
    });
    expect(config.thresholds.stuck_warning_seconds).toBe(420);
    expect(config.thresholds.stuck_kill_seconds).toBe(1200);
    expect(config).not.toHaveProperty("olympus");
    expect(config).not.toHaveProperty("budgets");
    expect(config).not.toHaveProperty("economics");
  });

  it("uses GitHub Copilot models for explicit pi proof runs", () => {
    const config = buildMockRunConfig({ runtime: "pi", uncapped: false });

    expect(Object.keys(config)).toEqual(CONFIG_TOP_LEVEL_KEYS);
    expect(config.runtime).toBe("pi");
    for (const caste of CASTE_CONFIG_KEYS) {
      expect(config.models[caste]).toBe("github-copilot:gpt-5.4-mini");
      expect(config.thinking[caste]).toBe("medium");
    }
    expect(config.labor.base_path).toBe(MOCK_RUN_LABOR_BASE_PATH);
    expect(config.concurrency).toEqual(DEFAULT_AEGIS_CONFIG.concurrency);
    expect(config.thresholds.stuck_warning_seconds).toBe(420);
    expect(config.thresholds.stuck_kill_seconds).toBe(1200);
  });

  it("allows explicit local Pi provider overrides without changing adapter semantics", () => {
    const config = buildMockRunConfig({
      runtime: "pi",
      modelReference: "local-qwen:qwen3.6-35b-a3b",
    });

    expect(config.runtime).toBe("pi");
    for (const caste of CASTE_CONFIG_KEYS) {
      expect(config.models[caste]).toBe("local-qwen:qwen3.6-35b-a3b");
      expect(config.thinking[caste]).toBe("medium");
    }
  });

  it("allows explicit codex override without changing model config", () => {
    const config = buildMockRunConfig({ runtime: "codex", uncapped: false });

    expect(Object.keys(config)).toEqual(CONFIG_TOP_LEVEL_KEYS);
    expect(config.runtime).toBe("codex");
    for (const caste of CASTE_CONFIG_KEYS) {
      expect(config.models[caste]).toBe("openai-codex:gpt-5.4-mini");
      expect(config.thinking[caste]).toBe("low");
    }
    expect(config.labor.base_path).toBe(MOCK_RUN_LABOR_BASE_PATH);
  });
});

describe("seedMockRun", () => {
  it("seeds the mock-run graph into Agora without requiring Beads", async () => {
    const workspaceRoot = createWorkspaceRoot();

    const result = await seedMockRun({
      workspaceRoot,
      repoName: "seeded-agora",
    });

    expect(existsSync(path.join(result.repoRoot, ".agora", "tickets.json"))).toBe(true);
    expect(existsSync(path.join(result.repoRoot, ".agora", "events.jsonl"))).toBe(true);
    expect(result.databaseName).toBe("agora");
    expect(Object.keys(result.issueIdByKey).sort()).toEqual(
      TODO_MOCK_RUN_MANIFEST.issues.map((issue) => issue.key).sort(),
    );
    expect(result.initialReadyKeys).toEqual(TODO_MOCK_RUN_MANIFEST.expectedInitialReadyKeys);

    const snapshot = JSON.parse(
      readFileSync(path.join(result.repoRoot, ".agora", "tickets.json"), "utf8"),
    ) as {
      tickets: Record<string, {
        title: string;
        parent: string | null;
        blockedBy: string[];
        labels: string[];
        scope: string[];
      }>;
    };
    const uiComponents = snapshot.tickets[result.issueIdByKey["ui.components"]!]!;
    expect(uiComponents.blockedBy).toEqual([
      result.issueIdByKey["foundation.app"],
      result.issueIdByKey["core.todo"],
    ]);
    expect(uiComponents.labels).toEqual(expect.arrayContaining([
      "mock-run",
      "ui",
      "product",
      "lane_c",
      "role:executable",
      "priority:1",
      "key:ui.components",
    ]));
    expect(uiComponents.scope).toEqual([
      "src/accessibility/keyboard.ts",
      "src/components/A11yStatus.tsx",
      "src/components/AppShell.css",
      "src/components/AppShell.tsx",
      "src/components/TodoFilters.tsx",
      "src/components/TodoInput.tsx",
      "src/components/TodoItem.tsx",
      "src/components/TodoList.tsx",
    ]);
    expect(snapshot.tickets[result.issueIdByKey["foundation.app"]!]?.parent).toBe(result.issueIdByKey["todo-webapp.program"]);
  });

  it("preserves parallel Oracle and post-scout Titan readiness through Agora", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const result = await seedMockRun({
      workspaceRoot,
      repoName: "parallel-agora",
    });
    const tracker = new AgoraTrackerClient();
    const dispatchState = emptyDispatchState();
    const poll = await pollReadyWork({
      dispatchState,
      tracker,
      root: result.repoRoot,
    });

    expect(poll.readyIssues.map((issue) => issue.id)).toEqual(
      result.initialReadyKeys.map((key) => result.issueIdByKey[key]),
    );
    expect(poll.readyIssues.length).toBeGreaterThan(1);

    saveDispatchState(result.repoRoot, {
      schemaVersion: 1,
      records: Object.fromEntries(poll.readyIssues.map((issue) => [issue.id, {
        issueId: issue.id,
        stage: "scouted",
        runningAgent: null,
        oracleAssessmentRef: `.aegis/oracle/${issue.id}.json`,
        titanHandoffRef: null,
        titanClarificationRef: null,
        sentinelVerdictRef: null,
        janusArtifactRef: null,
        failureTranscriptRef: null,
        fileScope: { files: ["docs", issue.id] },
        failureCount: 0,
        consecutiveFailures: 0,
        failureWindowStartMs: null,
        cooldownUntil: null,
        sessionProvenanceId: "test",
        updatedAt: "2026-05-01T12:00:00.000Z",
      }])),
    });

    const triage = triageReadyWork({
      readyIssues: poll.readyIssues,
      dispatchState: {
        schemaVersion: 1,
        records: Object.fromEntries(poll.readyIssues.map((issue) => [issue.id, {
          issueId: issue.id,
          stage: "scouted",
          runningAgent: null,
          oracleAssessmentRef: `.aegis/oracle/${issue.id}.json`,
          titanHandoffRef: null,
          titanClarificationRef: null,
          sentinelVerdictRef: null,
          janusArtifactRef: null,
          failureTranscriptRef: null,
          fileScope: { files: [`docs/${issue.id}.md`] },
          failureCount: 0,
          consecutiveFailures: 0,
          failureWindowStartMs: null,
          cooldownUntil: null,
          sessionProvenanceId: "test",
          updatedAt: "2026-05-01T12:00:00.000Z",
        }])),
      } as any,
      config: buildMockRunConfig(),
      now: "2026-05-01T12:01:00.000Z",
    });

    expect(triage.dispatchable.filter((item) => item.caste === "titan")).toHaveLength(poll.readyIssues.length);
  });
});
