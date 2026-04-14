import path from "node:path";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  emptyMergeQueueState,
  loadMergeQueueState,
  saveMergeQueueState,
} from "../../../src/merge/merge-state.js";

const tempRoots: string[] = [];

function createTempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "aegis-merge-state-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("merge queue state", () => {
  it("loads legacy {} payloads as an empty queue state", () => {
    const root = createTempRoot();
    const queuePath = path.join(root, ".aegis", "merge-queue.json");
    mkdirSync(path.dirname(queuePath), { recursive: true });

    writeFileSync(queuePath, "{}\n", "utf8");

    expect(loadMergeQueueState(root)).toEqual(emptyMergeQueueState());
  });

  it("persists the schema-backed empty queue state", () => {
    const root = createTempRoot();

    saveMergeQueueState(root, emptyMergeQueueState());

    expect(JSON.parse(
      readFileSync(path.join(root, ".aegis", "merge-queue.json"), "utf8"),
    )).toEqual({
      schemaVersion: 1,
      items: [],
    });
  });
});
