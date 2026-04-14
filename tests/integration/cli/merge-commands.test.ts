import { describe, expect, it, vi } from "vitest";

describe("runCli merge commands", () => {
  it("supports merge next through the shared merge runner", async () => {
    vi.resetModules();

    const runDirectMergeCommand = vi.fn(async () => ({
      action: "merge_next",
      source: "test",
    }));
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

    vi.doMock("../../../src/cli/merge-command.js", async () => {
      const actual = await vi.importActual<object>("../../../src/cli/merge-command.js");
      return {
        ...actual,
        runDirectMergeCommand,
      };
    });

    const { runCli } = await import("../../../src/index.js");

    await runCli("repo", ["merge", "next"]);

    expect(runDirectMergeCommand).toHaveBeenCalledWith("repo", "next");
    expect(consoleLog).toHaveBeenCalledTimes(1);

    consoleLog.mockRestore();
  });
});
