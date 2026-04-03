import path from "node:path";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_GITIGNORE_ENTRIES,
  REQUIRED_PROJECT_DIRECTORIES,
  REQUIRED_PROJECT_FILES,
  buildInitProjectPlan,
} from "../../../src/config/init-project.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

interface InitProjectLayoutFixture {
  directories: string[];
  files: string[];
  gitIgnoreEntries: string[];
}

function readLayoutFixture() {
  return JSON.parse(
    readFileSync(
      path.join(
        repoRoot,
        "tests",
        "fixtures",
        "config",
        "init-project-layout.json",
      ),
      "utf8",
    ),
  ) as InitProjectLayoutFixture;
}

describe("S01 init project contract seed", () => {
  it("defines the required project layout and runtime-state ignore entries", () => {
    const fixture = readLayoutFixture();

    expect(REQUIRED_PROJECT_DIRECTORIES).toEqual(fixture.directories);
    expect(REQUIRED_PROJECT_FILES).toEqual(fixture.files);
    expect(DEFAULT_GITIGNORE_ENTRIES).toEqual(fixture.gitIgnoreEntries);
  });

  it("builds an init plan that maps the contract to repository paths", () => {
    const plan = buildInitProjectPlan(repoRoot);

    expect(plan.repoRoot).toBe(repoRoot);
    expect(plan.directories).toEqual(
      REQUIRED_PROJECT_DIRECTORIES.map((entry) => path.join(repoRoot, entry)),
    );
    expect(plan.files).toEqual(
      REQUIRED_PROJECT_FILES.map((entry) => path.join(repoRoot, entry)),
    );
    expect(plan.gitIgnoreEntries).toEqual(DEFAULT_GITIGNORE_ENTRIES);
  });
});
