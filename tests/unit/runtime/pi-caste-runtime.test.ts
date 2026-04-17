import { describe, expect, it } from "vitest";

import { PiCasteRuntime } from "../../../src/runtime/pi-caste-runtime.js";

describe("PiCasteRuntime", () => {
  it("rejects runs without an explicit configured model for the caste", async () => {
    const runtime = new PiCasteRuntime();

    await expect(runtime.run({
      caste: "oracle",
      issueId: "aegis-123",
      root: "repo",
      workingDirectory: "repo",
      prompt: "Scout aegis-123",
    })).rejects.toThrow('Missing configured Pi model for caste "oracle".');
  });
});
