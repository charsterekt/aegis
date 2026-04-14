import { describe, expect, it, vi } from "vitest";

describe("runCli phase commands", () => {
  it("supports poll, dispatch, monitor, and reap through the shared phase runner", async () => {
    vi.resetModules();

    const runDirectPhaseCommand = vi.fn(async (_root: string, phase: string) => ({
      phase,
      source: "test",
    }));
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

    vi.doMock("../../../src/cli/phase-command.js", async () => {
      const actual = await vi.importActual<object>("../../../src/cli/phase-command.js");
      return {
        ...actual,
        runDirectPhaseCommand,
      };
    });

    const { runCli } = await import("../../../src/index.js");

    await runCli("repo", ["poll"]);
    await runCli("repo", ["dispatch"]);
    await runCli("repo", ["monitor"]);
    await runCli("repo", ["reap"]);

    expect(runDirectPhaseCommand).toHaveBeenNthCalledWith(1, "repo", "poll");
    expect(runDirectPhaseCommand).toHaveBeenNthCalledWith(2, "repo", "dispatch");
    expect(runDirectPhaseCommand).toHaveBeenNthCalledWith(3, "repo", "monitor");
    expect(runDirectPhaseCommand).toHaveBeenNthCalledWith(4, "repo", "reap");
    expect(consoleLog).toHaveBeenCalledTimes(4);

    consoleLog.mockRestore();
  });
});
