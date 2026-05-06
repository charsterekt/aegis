import { describe, expect, it } from "vitest";

import { DEFAULT_GITIGNORE_ENTRIES } from "../../../src/config/init-project.js";

describe("initProject", () => {
  it("ignores all durable generated Aegis artifact directories", () => {
    expect(DEFAULT_GITIGNORE_ENTRIES).toContain(".aegis/policy/");
    expect(DEFAULT_GITIGNORE_ENTRIES).toContain(".aegis/final-app-verification.json");
  });
});
