import path from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_AEGIS_CONFIG } from "../../../src/config/defaults.js";
import { writeRuntimeState } from "../../../src/cli/runtime-state.js";
import { writePhaseLog } from "../../../src/core/phase-log.js";
import {
  runMockAcceptance,
  collectMockAcceptanceSurface,
  assertMockAcceptanceSurface,
  type MockAcceptanceSurface,
} from "../../../src/mock-run/acceptance.js";

const tempRoots: string[] = [];

function createTempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "aegis-mock-acceptance-"));
  tempRoots.push(root);
  mkdirSync(path.join(root, ".aegis"), { recursive: true });
  writeFileSync(
    path.join(root, ".aegis", "config.json"),
    `${JSON.stringify(DEFAULT_AEGIS_CONFIG, null, 2)}\n`,
    "utf8",
  );
  writeRuntimeState(
    {
      schema_version: 1,
      pid: 4242,
      server_state: "stopped",
      mode: "auto",
      started_at: "2026-04-16T00:00:00.000Z",
      stopped_at: "2026-04-16T00:10:00.000Z",
      last_stop_reason: "manual stop",
    },
    root,
  );
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("runMockAcceptance", () => {
  it("runs autonomous daemon acceptance flow with session-view flag and no direct caste commands", async () => {
    const sequence: string[] = [];
    const seedMockRun = vi.fn(async () => {
      sequence.push("seed");
      return {
        repoRoot: "/repo",
        databaseName: "mock-db",
        issueIdByKey: {
          "integration.gate": "issue-final-gate",
        },
        initialReadyKeys: ["foundation.contract"],
        manifestPath: "/repo/.aegis/mock-run-manifest.json",
      };
    });

    const runMockCommand = vi.fn(async (args: string[]) => {
      sequence.push(args.slice(2).join(" "));
    });

    let issuePollCount = 0;
    const tracker = {
      getIssue: vi.fn(async (issueId: string) => {
        issuePollCount += 1;
        return {
          id: issueId,
          title: "Final gate",
          description: null,
          issueClass: "primary" as const,
          status: issuePollCount >= 2 ? ("closed" as const) : ("open" as const),
          priority: 1,
          blockers: [],
          parentId: null,
          childIds: [],
          labels: [],
        };
      }),
    };

    const surfaceCollector = vi.fn(async (): Promise<MockAcceptanceSurface> => ({
      runtimeState: {
        schema_version: 1,
        pid: 4242,
        server_state: "stopped",
        mode: "auto",
        started_at: "2026-04-16T00:00:00.000Z",
        stopped_at: "2026-04-16T00:10:00.000Z",
        last_stop_reason: "manual stop",
      },
      trackerIssues: {
        finalGate: {
          id: "issue-final-gate",
          title: "Final gate",
          status: "closed",
        },
      },
      phaseLogs: [
        {
          phase: "poll",
          issueId: "_all",
          action: "poll_ready_work",
          outcome: "ok",
          detail: "",
          timestamp: "2026-04-16T00:00:00.000Z",
        },
        {
          phase: "dispatch",
          issueId: "aegis-1",
          action: "launch_oracle",
          outcome: "running",
          detail: "",
          timestamp: "2026-04-16T00:00:01.000Z",
        },
        {
          phase: "monitor",
          issueId: "aegis-1",
          action: "session_observed",
          outcome: "succeeded",
          detail: "",
          timestamp: "2026-04-16T00:00:02.000Z",
        },
        {
          phase: "reap",
          issueId: "aegis-1",
          action: "finalize_session",
          outcome: "scouted",
          detail: "",
          timestamp: "2026-04-16T00:00:03.000Z",
        },
      ],
      app: {
        requiredFiles: {
          "package.json": true,
          "README.md": true,
          "src/main.tsx": true,
          "src/App.tsx": true,
        },
        readmeHasInstall: true,
        readmeHasDev: true,
        readmeHasLocalhost: true,
      },
    }));

    await runMockAcceptance({
      cwd: "/workspace",
      seedMockRun,
      runMockCommand,
      collectMockAcceptanceSurface: surfaceCollector,
      tracker,
      completionTimeoutMs: 5_000,
      completionPollMs: 0,
    });

    expect(sequence).toEqual([
      "seed",
      "start --view-agent-sessions",
      "status",
      "stop",
      "status",
    ]);
    expect(sequence.some((entry) => entry.startsWith("scout"))).toBe(false);
    expect(sequence.some((entry) => entry.startsWith("implement"))).toBe(false);
    expect(surfaceCollector).toHaveBeenCalledWith("/repo", {
      finalGateIssueId: "issue-final-gate",
      tracker,
    });
  });
});

describe("collectMockAcceptanceSurface", () => {
  it("collects final gate issue status, phase logs, and app evidence", async () => {
    const root = createTempRoot();

    writePhaseLog(root, {
      timestamp: "2026-04-16T00:00:00.000Z",
      phase: "poll",
      issueId: "_all",
      action: "poll_ready_work",
      outcome: "ok",
      detail: "issue-1",
    });
    writePhaseLog(root, {
      timestamp: "2026-04-16T00:00:30.000Z",
      phase: "dispatch",
      issueId: "issue-1",
      action: "launch_oracle",
      outcome: "running",
    });
    writePhaseLog(root, {
      timestamp: "2026-04-16T00:01:00.000Z",
      phase: "monitor",
      issueId: "issue-1",
      action: "session_observed",
      outcome: "succeeded",
    });
    writePhaseLog(root, {
      timestamp: "2026-04-16T00:02:00.000Z",
      phase: "reap",
      issueId: "issue-1",
      action: "finalize_session",
      outcome: "scouted",
    });

    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "package.json"), "{}\n", "utf8");
    writeFileSync(path.join(root, "src", "main.tsx"), "export {}\n", "utf8");
    writeFileSync(path.join(root, "src", "App.tsx"), "export default function App() { return null; }\n", "utf8");
    writeFileSync(
      path.join(root, "README.md"),
      "Run `npm install`, then `npm run dev` and open localhost.\n",
      "utf8",
    );

    const surface = await collectMockAcceptanceSurface(root, {
      finalGateIssueId: "issue-final-gate",
      tracker: {
        getIssue: vi.fn(async (issueId: string) => ({
          id: issueId,
          title: "Final gate",
          description: null,
          issueClass: "primary" as const,
          status: "closed" as const,
          priority: 1,
          blockers: [],
          parentId: null,
          childIds: [],
          labels: [],
        })),
      },
    });

    expect(surface.runtimeState.server_state).toBe("stopped");
    expect(surface.trackerIssues.finalGate.status).toBe("closed");
    expect(surface.app.requiredFiles["package.json"]).toBe(true);
    expect(surface.app.requiredFiles["README.md"]).toBe(true);
    expect(surface.app.requiredFiles["src/main.tsx"]).toBe(true);
    expect(surface.app.requiredFiles["src/App.tsx"]).toBe(true);
    expect(surface.app.readmeHasInstall).toBe(true);
    expect(surface.app.readmeHasDev).toBe(true);
    expect(surface.app.readmeHasLocalhost).toBe(true);
    expect(surface.phaseLogs.some((entry) => entry.phase === "poll")).toBe(true);
    expect(surface.phaseLogs.some((entry) => entry.phase === "dispatch")).toBe(true);
    expect(surface.phaseLogs.some((entry) => entry.phase === "monitor")).toBe(true);
    expect(surface.phaseLogs.some((entry) => entry.phase === "reap")).toBe(true);
  });
});

describe("assertMockAcceptanceSurface", () => {
  it("rejects surfaces where final gate is not closed", () => {
    const surface: MockAcceptanceSurface = {
      runtimeState: {
        schema_version: 1,
        pid: 4242,
        server_state: "stopped",
        mode: "auto",
        started_at: "2026-04-16T00:00:00.000Z",
        stopped_at: "2026-04-16T00:10:00.000Z",
        last_stop_reason: "manual stop",
      },
      trackerIssues: {
        finalGate: {
          id: "issue-final-gate",
          title: "Final gate",
          status: "open",
        },
      },
      phaseLogs: [
        {
          phase: "poll",
          issueId: "_all",
          action: "poll_ready_work",
          outcome: "ok",
          detail: "",
          timestamp: "2026-04-16T00:00:00.000Z",
        },
        {
          phase: "dispatch",
          issueId: "issue-1",
          action: "launch_oracle",
          outcome: "running",
          detail: "",
          timestamp: "2026-04-16T00:00:01.000Z",
        },
        {
          phase: "monitor",
          issueId: "issue-1",
          action: "session_observed",
          outcome: "succeeded",
          detail: "",
          timestamp: "2026-04-16T00:00:02.000Z",
        },
        {
          phase: "reap",
          issueId: "issue-1",
          action: "finalize_session",
          outcome: "scouted",
          detail: "",
          timestamp: "2026-04-16T00:00:03.000Z",
        },
      ],
      app: {
        requiredFiles: {
          "package.json": true,
          "README.md": true,
          "src/main.tsx": true,
          "src/App.tsx": true,
        },
        readmeHasInstall: true,
        readmeHasDev: true,
        readmeHasLocalhost: true,
      },
    };

    expect(() => assertMockAcceptanceSurface(surface)).toThrow(
      "Expected final integration gate issue to be closed",
    );
  });
});
