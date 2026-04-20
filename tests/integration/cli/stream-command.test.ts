import { describe, expect, it, vi } from "vitest";

describe("runCli stream command", () => {
  it("supports stream daemon and stream session through the shared stream runner", async () => {
    vi.resetModules();

    const streamDaemonView = vi.fn(async () => undefined);
    const streamSessionView = vi.fn(async () => undefined);

    vi.doMock("../../../src/cli/stream.js", async () => {
      const actual = await vi.importActual<object>("../../../src/cli/stream.js");
      return {
        ...actual,
        streamDaemonView,
        streamSessionView,
      };
    });

    const { runCli } = await import("../../../src/index.js");

    await runCli("repo", ["stream"]);
    await runCli("repo", ["stream", "daemon"]);
    await runCli("repo", ["stream", "session", "session-1"]);

    expect(streamDaemonView).toHaveBeenNthCalledWith(1, "repo");
    expect(streamDaemonView).toHaveBeenNthCalledWith(2, "repo");
    expect(streamSessionView).toHaveBeenCalledWith("repo", "session-1");
  });
});

