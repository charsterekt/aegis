import { describe, expect, it, vi } from "vitest";

import { runDirectMergeCommand } from "../../../src/cli/merge-command.js";
import type { RuntimeStateRecord } from "../../../src/cli/runtime-state.js";

function createRuntimeState(): RuntimeStateRecord {
  return {
    schema_version: 1,
    pid: 4242,
    server_state: "running",
    mode: "auto",
    started_at: "2026-04-14T12:00:00.000Z",
  };
}

describe("runDirectMergeCommand", () => {
  it("runs merge next locally when the daemon is not active", async () => {
    const runLocal = vi.fn(async () => ({ action: "merge_next", source: "local" }));
    const routeToDaemon = vi.fn();

    const result = await runDirectMergeCommand("repo", "next", {
      readRuntimeState: () => null,
      isProcessRunning: () => false,
      runLocal,
      routeToDaemon,
    });

    expect(result).toEqual({ action: "merge_next", source: "local" });
    expect(runLocal).toHaveBeenCalledWith("repo", "next");
    expect(routeToDaemon).not.toHaveBeenCalled();
  });

  it("routes merge next through the daemon when runtime ownership is active", async () => {
    const runLocal = vi.fn();
    const routeToDaemon = vi.fn(async () => ({ action: "merge_next", source: "daemon" }));

    const result = await runDirectMergeCommand("repo", "next", {
      readRuntimeState: () => createRuntimeState(),
      isProcessRunning: () => true,
      runLocal,
      routeToDaemon,
    });

    expect(result).toEqual({ action: "merge_next", source: "daemon" });
    expect(runLocal).not.toHaveBeenCalled();
    expect(routeToDaemon).toHaveBeenCalledWith("repo", "next", 4242);
  });
});
