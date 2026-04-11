import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { verifyTrackerRepository } from "../../../src/cli/start.js";

const tempRoots: string[] = [];

function createTempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "aegis-start-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("verifyTrackerRepository", () => {
  it("accepts a healthy tracker probe even when the worktree has no local .beads directory", () => {
    const root = createTempRoot();

    expect(() => verifyTrackerRepository(root, () => ({
      status: 0,
      stdout: "[]",
      stderr: "",
    }), () => ({
      ok: true,
      detail: "Beads CLI is available.",
    }))).not.toThrow();
  });

  it("fails clearly when the Beads CLI is unavailable", () => {
    const root = createTempRoot();

    expect(() => verifyTrackerRepository(root, () => ({
      status: 0,
      stdout: "",
      stderr: "",
    }), () => ({
      ok: false,
      detail: "Beads CLI was not found. Install or fix `bd` before starting Aegis.",
    }))).toThrow("Beads CLI was not found");
  });

  it("includes tracker probe details when bd ready fails", () => {
    const root = createTempRoot();

    expect(() => verifyTrackerRepository(root, () => ({
      status: 1,
      stdout: "",
      stderr: "tracker metadata missing",
    }), () => ({
      ok: true,
      detail: "Beads CLI is available.",
    }))).toThrow("tracker metadata missing");
  });
});
