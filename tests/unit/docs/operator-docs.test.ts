import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

describe("operator docs", () => {
  it("publish the quickstart, olympus guide, steer reference, and mock seed guide", () => {
    const quickstart = readFileSync(path.join(repoRoot, "docs/operator-quickstart.md"), "utf8");
    const olympusGuide = readFileSync(path.join(repoRoot, "docs/olympus-operator-guide.md"), "utf8");
    const steerReference = readFileSync(path.join(repoRoot, "docs/steer-reference.md"), "utf8");
    const mockSeedGuide = readFileSync(path.join(repoRoot, "docs/mock-seed-guide.md"), "utf8");

    expect(quickstart).toContain("aegis start");
    expect(olympusGuide).toContain("Aegis Loop");
    expect(steerReference).toContain("focus <issue-id>");
    expect(mockSeedGuide).toContain("scratchpad");
  });
});
