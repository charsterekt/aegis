import { describe, expect, it, vi } from "vitest";

import { renameWithRetries } from "../../../src/shared/atomic-write.js";

describe("renameWithRetries", () => {
  it("retries transient Windows rename failures", () => {
    const rename = vi.fn()
      .mockImplementationOnce(() => {
        const error = new Error("operation not permitted") as NodeJS.ErrnoException;
        error.code = "EPERM";
        throw error;
      })
      .mockImplementationOnce(() => undefined);
    const sleepMs = vi.fn();

    renameWithRetries("state.tmp", "state.json", {
      rename,
      sleepMs,
      baseDelayMs: 1,
      maxAttempts: 2,
    });

    expect(rename).toHaveBeenCalledTimes(2);
    expect(sleepMs).toHaveBeenCalledWith(1);
  });
});
