import path from "node:path";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  AEGIS_CONFIG_PATH,
  AEGIS_DIRECTORY,
  DEFAULT_CONFIG_FILE,
  resolveConfigPath,
} from "../../../src/config/load-config.js";
import { DEFAULT_AEGIS_CONFIG } from "../../../src/config/defaults.js";
import {
  CONFIG_TOP_LEVEL_KEYS,
  RUNTIME_STATE_FILES,
} from "../../../src/config/schema.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

function readJsonFixture<T>(fixtureName: string) {
  return JSON.parse(
    readFileSync(
      path.join(repoRoot, "tests", "fixtures", "config", fixtureName),
      "utf8",
    ),
  ) as T;
}

describe("S01 config contract seed", () => {
  it("defines the canonical config domains and default values from the spec", () => {
    const fixture = readJsonFixture<Record<string, unknown>>("default-config.json");

    expect(CONFIG_TOP_LEVEL_KEYS).toEqual([
      "runtime",
      "auth",
      "models",
      "concurrency",
      "budgets",
      "thresholds",
      "economics",
      "janus",
      "mnemosyne",
      "labor",
      "olympus",
      "evals",
    ]);
    expect(DEFAULT_AEGIS_CONFIG).toEqual(fixture);
  });

  it("defines the canonical .aegis config path and runtime state files", () => {
    expect(AEGIS_DIRECTORY).toBe(".aegis");
    expect(DEFAULT_CONFIG_FILE).toBe("config.json");
    expect(AEGIS_CONFIG_PATH).toBe(".aegis/config.json");
    expect(resolveConfigPath(repoRoot)).toBe(path.join(repoRoot, ".aegis", "config.json"));
    expect(RUNTIME_STATE_FILES).toEqual([
      ".aegis/dispatch-state.json",
      ".aegis/merge-queue.json",
      ".aegis/mnemosyne.jsonl",
    ]);
  });
});
