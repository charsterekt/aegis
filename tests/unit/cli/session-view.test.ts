import { describe, expect, it, vi } from "vitest";

import { createSessionViewTracker } from "../../../src/cli/session-view.js";

describe("createSessionViewTracker", () => {
  it("spawns one viewer per newly seen running session", () => {
    const spawnMock = vi.fn(() => ({
      unref: vi.fn(),
    })) as unknown as typeof import("node:child_process").spawn;
    const tracker = createSessionViewTracker("repo", {
      spawnProcess: spawnMock,
      cliEntrypoint: "dist/index.js",
      platform: "win32",
    });

    tracker.sync([
      { issueId: "aegis-1", caste: "oracle", sessionId: "session-1" },
      { issueId: "aegis-2", caste: "titan", sessionId: "session-2" },
    ]);
    tracker.sync([
      { issueId: "aegis-1", caste: "oracle", sessionId: "session-1" },
      { issueId: "aegis-2", caste: "titan", sessionId: "session-2" },
    ]);

    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(spawnMock.mock.calls[0]?.[1]?.join(" ")).toContain("stream session \"session-1\"");
    expect(spawnMock.mock.calls[1]?.[1]?.join(" ")).toContain("stream session \"session-2\"");
  });

  it("allows re-launch when a session disappears and later reappears", () => {
    const spawnMock = vi.fn(() => ({
      unref: vi.fn(),
    })) as unknown as typeof import("node:child_process").spawn;
    const tracker = createSessionViewTracker("repo", {
      spawnProcess: spawnMock,
      cliEntrypoint: "dist/index.js",
      platform: "win32",
    });

    tracker.sync([{ issueId: "aegis-1", caste: "oracle", sessionId: "session-1" }]);
    tracker.sync([]);
    tracker.sync([{ issueId: "aegis-1", caste: "oracle", sessionId: "session-1" }]);

    expect(spawnMock).toHaveBeenCalledTimes(2);
  });
});

