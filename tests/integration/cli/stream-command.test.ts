import { describe, expect, it, vi } from "vitest";

describe("runCli stream command", () => {
  it("supports stream daemon through the shared stream runner", async () => {
    vi.resetModules();

    const streamDaemonView = vi.fn(async () => undefined);

    vi.doMock("../../../src/cli/stream.js", async () => {
      const actual = await vi.importActual<object>("../../../src/cli/stream.js");
      return {
        ...actual,
        streamDaemonView,
      };
    });

    const { runCli } = await import("../../../src/index.js");

    await runCli("repo", ["stream"]);
    await runCli("repo", ["stream", "daemon"]);

    expect(streamDaemonView).toHaveBeenNthCalledWith(1, "repo");
    expect(streamDaemonView).toHaveBeenNthCalledWith(2, "repo");
  });
});

