import { describe, expect, it } from "vitest";

import type { AegisConfig } from "../../../src/config/schema.js";
import { DEFAULT_AEGIS_CONFIG } from "../../../src/config/defaults.js";

import {
  formatStartupPreflight,
  runStartupPreflight,
  type StartupPreflightDependencies,
} from "../../../src/cli/startup-preflight.js";

function makeConfig(): AegisConfig {
  return {
    ...DEFAULT_AEGIS_CONFIG,
    runtime: "pi",
  };
}

function makeDeps(
  overrides: Partial<StartupPreflightDependencies> = {},
): StartupPreflightDependencies {
  return {
    verifyGitRepo: () => undefined,
    probeTrackerBackend: () => ({ ok: true }),
    loadConfig: () => makeConfig(),
    verifyRuntimeAdapter: () => ({ ok: true }),
    verifyRuntimeLocalConfig: () => ({ ok: true }),
    verifyModelRefs: () => ({ ok: true }),
    verifyRuntimeStatePaths: () => ({ ok: true }),
    ...overrides,
  };
}

describe("runStartupPreflight", () => {
  it("returns ready when every startup preflight check passes", () => {
    const report = runStartupPreflight("repo", makeDeps());

    expect(report).toEqual({
      overall: "ready",
      repoRoot: "repo",
      checks: [
        { id: "git_repo", label: "git repo", status: "pass", detail: "Inside a git worktree." },
        { id: "tracker_backend", label: "tracker backend", status: "pass", detail: "Agora tracker backend is available." },
        { id: "aegis_config", label: "aegis config", status: "pass", detail: "Config loaded." },
        { id: "runtime_adapter", label: "runtime adapter", status: "pass", detail: "Runtime adapter is supported." },
        { id: "runtime_local_config", label: "runtime local config", status: "pass", detail: "Runtime local config is valid." },
        { id: "model_refs", label: "model refs", status: "pass", detail: "Configured model refs are valid." },
        { id: "runtime_state_paths", label: "runtime state paths", status: "pass", detail: "Runtime state paths are available." },
      ],
    });
  });

  it("returns blocked when the tracker backend is unavailable", () => {
    const report = runStartupPreflight("repo", makeDeps({
      probeTrackerBackend: () => ({
        ok: false,
        detail: "Agora tracker cannot load tickets.",
        fix: "repair .agora/tickets.json",
      }),
    }));

    expect(report.overall).toBe("blocked");
    expect(report.checks.map((check) => [check.id, check.status])).toEqual([
      ["git_repo", "pass"],
      ["tracker_backend", "fail"],
      ["aegis_config", "skipped"],
      ["runtime_adapter", "skipped"],
      ["runtime_local_config", "skipped"],
      ["model_refs", "skipped"],
      ["runtime_state_paths", "skipped"],
    ]);
    expect(formatStartupPreflight(report)).toContain(
      "fix: repair .agora/tickets.json",
    );
  });

  it("converts thrown probe errors into a failed check and skips downstream work", () => {
    const report = runStartupPreflight("repo", makeDeps({
      probeTrackerBackend: () => {
        throw new Error("tracker failed");
      },
    }));

    expect(report.overall).toBe("blocked");
    expect(report.checks.map((check) => [check.id, check.status, check.detail])).toEqual([
      ["git_repo", "pass", "Inside a git worktree."],
      ["tracker_backend", "fail", "tracker failed"],
      ["aegis_config", "skipped", "Skipped because an earlier preflight check failed."],
      ["runtime_adapter", "skipped", "Skipped because an earlier preflight check failed."],
      ["runtime_local_config", "skipped", "Skipped because an earlier preflight check failed."],
      ["model_refs", "skipped", "Skipped because an earlier preflight check failed."],
      ["runtime_state_paths", "skipped", "Skipped because an earlier preflight check failed."],
    ]);
  });

  it("uses a failure fallback detail when a failing probe does not provide one", () => {
    const report = runStartupPreflight("repo", makeDeps({
      probeTrackerBackend: () => ({ ok: false }),
    }));

    expect(report.overall).toBe("blocked");
    expect(report.checks[1]).toMatchObject({
      id: "tracker_backend",
      status: "fail",
    });
    expect(report.checks[1]?.detail).not.toBe("Agora tracker backend is available.");
    expect(formatStartupPreflight(report)).not.toContain("Agora tracker backend is available.");
  });

  it("fails the aegis_config check when loading config throws", () => {
    const report = runStartupPreflight("repo", makeDeps({
      loadConfig: () => {
        throw new Error("Config file is missing.");
      },
    }));

    expect(report.overall).toBe("blocked");
    expect(report.checks.map((check) => [check.id, check.status, check.detail])).toEqual([
      ["git_repo", "pass", "Inside a git worktree."],
      ["tracker_backend", "pass", "Agora tracker backend is available."],
      ["aegis_config", "fail", "Config file is missing."],
      ["runtime_adapter", "skipped", "Skipped because an earlier preflight check failed."],
      ["runtime_local_config", "skipped", "Skipped because an earlier preflight check failed."],
      ["model_refs", "skipped", "Skipped because an earlier preflight check failed."],
      ["runtime_state_paths", "skipped", "Skipped because an earlier preflight check failed."],
    ]);
  });

  it("stops at a runtime_state_paths failure without appending skipped checks", () => {
    const report = runStartupPreflight("repo", makeDeps({
      verifyRuntimeStatePaths: () => ({
        ok: false,
        detail: "Runtime state path is not writable.",
        fix: "fix repository permissions",
      }),
    }));

    expect(report.overall).toBe("blocked");
    expect(report.checks).toHaveLength(7);
    expect(report.checks.map((check) => [check.id, check.status])).toEqual([
      ["git_repo", "pass"],
      ["tracker_backend", "pass"],
      ["aegis_config", "pass"],
      ["runtime_adapter", "pass"],
      ["runtime_local_config", "pass"],
      ["model_refs", "pass"],
      ["runtime_state_paths", "fail"],
    ]);
    expect(report.checks.filter((check) => check.status === "skipped")).toHaveLength(0);
  });

  it("surfaces auth-aware model validation guidance in the model_refs check", () => {
    const report = runStartupPreflight("repo", makeDeps({
      verifyModelRefs: () => ({
        ok: false,
        detail:
          'Configured provider "openai-codex" for "titan" is not authenticated. Authenticated providers: anthropic',
        fix: "authenticate the configured provider or update the configured model ref",
      }),
    }));

    expect(report.overall).toBe("blocked");
    const modelRefsCheck = report.checks.find((check) => check.id === "model_refs");

    expect(modelRefsCheck).toMatchObject({
      id: "model_refs",
      status: "fail",
    });
    expect(modelRefsCheck?.detail).toContain("Authenticated providers: anthropic");
  });
});
