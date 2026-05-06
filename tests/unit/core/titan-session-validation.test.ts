import path from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeTitanArtifactChangedFiles } from "../../../src/core/titan-session-validation.js";

describe("titan session validation", () => {
  it("normalizes absolute files_changed paths inside the candidate worktree", () => {
    const workingDirectory = path.resolve("work", "labor");

    expect(normalizeTitanArtifactChangedFiles(
      "aegis-paths",
      [path.join(workingDirectory, "docs", "setup-contract.md")],
      workingDirectory,
    )).toEqual(["docs/setup-contract.md"]);
  });

  it("rejects markdown link files_changed paths", () => {
    expect(() =>
      normalizeTitanArtifactChangedFiles(
        "aegis-paths",
        ["[src/index.ts](file:///C:/work/labor/src/index.ts)"],
        path.join("C:", "work", "labor"),
      )
    ).toThrow("invalid files_changed path");
  });
});
