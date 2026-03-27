// test/dispatch-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import * as store from "../src/dispatch-store.js";
import type { DispatchRecord } from "../src/types.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `aegis-test-${randomBytes(6).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function stateFile(dir: string): string {
  return join(dir, ".aegis", "dispatch-state.json");
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = makeTempDir();
  store.load(tmpDir); // reset module state for each test
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("load()", () => {
  it("starts with empty store when state file does not exist", () => {
    expect(store.all()).toHaveLength(0);
  });

  it("loads existing records from disk", () => {
    // Write a record via set() then reload
    store.transition("issue-1", "scouting");
    store.load(tmpDir); // reload from same dir
    expect(store.get("issue-1")?.stage).toBe("scouting");
  });

  it("starts with empty store on corrupt state file", () => {
    mkdirSync(join(tmpDir, ".aegis"), { recursive: true });
    writeFileSync(stateFile(tmpDir), "{ bad json ]]]", "utf8");
    store.load(tmpDir);
    expect(store.all()).toHaveLength(0);
  });
});

describe("set() and get()", () => {
  it("round-trips a DispatchRecord through the store", () => {
    const rec: DispatchRecord = {
      issue_id: "issue-42",
      stage: "pending",
      oracle_assessment: null,
      sentinel_verdict: null,
      failure_count: 0,
      last_failure_at: null,
      current_agent_id: null,
      created_at: 1000,
      updated_at: 1000,
    };
    store.set("issue-42", rec);
    const loaded = store.get("issue-42");
    expect(loaded?.issue_id).toBe("issue-42");
    expect(loaded?.stage).toBe("pending");
    expect(loaded?.failure_count).toBe(0);
  });

  it("returns undefined for unknown issue ID", () => {
    expect(store.get("not-a-real-id")).toBeUndefined();
  });
});

describe("save()", () => {
  it("creates the dispatch-state.json file after set()", () => {
    store.transition("issue-1", "scouting");
    expect(existsSync(stateFile(tmpDir))).toBe(true);
  });

  it("does not leave a .tmp file behind after successful save", () => {
    store.transition("issue-1", "scouting");
    expect(existsSync(stateFile(tmpDir) + ".tmp")).toBe(false);
  });

  it("persists records as a valid JSON array", () => {
    store.transition("issue-1", "pending");
    store.transition("issue-2", "scouting");
    const raw = JSON.parse(readFileSync(stateFile(tmpDir), "utf8")) as unknown;
    expect(Array.isArray(raw)).toBe(true);
    expect((raw as unknown[]).length).toBe(2);
  });
});

describe("transition()", () => {
  it("creates a default record when none exists and transitions to new stage", () => {
    store.transition("issue-1", "scouting");
    const rec = store.get("issue-1");
    expect(rec?.stage).toBe("scouting");
    expect(rec?.failure_count).toBe(0);
    expect(rec?.oracle_assessment).toBeNull();
  });

  it("updates updated_at on each transition", async () => {
    store.transition("issue-1", "pending");
    const before = store.get("issue-1")!.updated_at;
    await new Promise((r) => setTimeout(r, 5));
    store.transition("issue-1", "scouting");
    const after = store.get("issue-1")!.updated_at;
    expect(after).toBeGreaterThan(before);
  });

  it("accepts all 8 valid stage values", () => {
    const stages = [
      "pending", "scouting", "scouted",
      "implementing", "implemented",
      "reviewing", "complete", "failed",
    ] as const;
    for (const stage of stages) {
      store.transition(`issue-${stage}`, stage);
      expect(store.get(`issue-${stage}`)?.stage).toBe(stage);
    }
  });

  it("merges additional data fields", () => {
    store.transition("issue-1", "scouting", { current_agent_id: "agent-007" });
    expect(store.get("issue-1")?.current_agent_id).toBe("agent-007");
  });

  it("preserves existing fields not in data", () => {
    store.transition("issue-1", "scouting", { current_agent_id: "agent-1" });
    store.transition("issue-1", "scouted");
    expect(store.get("issue-1")?.current_agent_id).toBe("agent-1");
  });
});

describe("recordFailure()", () => {
  it("increments failure_count", () => {
    store.transition("issue-1", "pending");
    store.recordFailure("issue-1");
    expect(store.get("issue-1")?.failure_count).toBe(1);
    store.recordFailure("issue-1");
    expect(store.get("issue-1")?.failure_count).toBe(2);
  });

  it("sets last_failure_at to a timestamp", () => {
    store.transition("issue-1", "scouting");
    store.recordFailure("issue-1");
    expect(store.get("issue-1")?.last_failure_at).toBeGreaterThan(0);
  });

  it("is a no-op for unknown issue ID", () => {
    expect(() => store.recordFailure("not-real")).not.toThrow();
  });
});

describe("resetFailures()", () => {
  it("sets failure_count to 0", () => {
    store.transition("issue-1", "scouting");
    store.recordFailure("issue-1");
    store.recordFailure("issue-1");
    store.resetFailures("issue-1");
    expect(store.get("issue-1")?.failure_count).toBe(0);
  });

  it("sets last_failure_at to null", () => {
    store.transition("issue-1", "scouting");
    store.recordFailure("issue-1");
    store.resetFailures("issue-1");
    expect(store.get("issue-1")?.last_failure_at).toBeNull();
  });

  it("is a no-op for unknown issue ID", () => {
    expect(() => store.resetFailures("not-real")).not.toThrow();
  });
});

describe("all()", () => {
  it("returns empty array when store is empty", () => {
    expect(store.all()).toEqual([]);
  });

  it("returns all records", () => {
    store.transition("issue-1", "pending");
    store.transition("issue-2", "scouting");
    store.transition("issue-3", "complete");
    expect(store.all()).toHaveLength(3);
  });
});
