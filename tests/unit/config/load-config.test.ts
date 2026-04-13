import path from "node:path";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  AEGIS_CONFIG_PATH,
  AEGIS_DIRECTORY,
  DEFAULT_CONFIG_FILE,
  loadConfig,
  resolveConfigPath,
} from "../../../src/config/load-config.js";
import { DEFAULT_AEGIS_CONFIG } from "../../../src/config/defaults.js";
import {
  CONFIG_TOP_LEVEL_KEYS,
  RUNTIME_STATE_FILES,
} from "../../../src/config/schema.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const tempRoots: string[] = [];

function readJsonFixture<T>(fixtureName: string) {
  return JSON.parse(
    readFileSync(
      path.join(repoRoot, "tests", "fixtures", "config", fixtureName),
      "utf8",
    ),
  ) as T;
}

function createTempProjectRoot() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "aegis-config-"));
  tempRoots.push(tempRoot);
  return tempRoot;
}

function writeConfigFixture(root: string, config: unknown) {
  mkdirSync(path.dirname(resolveConfigPath(root)), { recursive: true });
  writeFileSync(
    resolveConfigPath(root),
    JSON.stringify(config, null, 2),
    "utf8",
  );
}

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe("S01 config contract seed", () => {
  it("defines the canonical config domains and default values from the spec", () => {
    const fixture = readJsonFixture<Record<string, unknown>>("default-config.json");

    expect(CONFIG_TOP_LEVEL_KEYS).toEqual(Object.keys(fixture));
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
    ]);
  });

  it("loads a config file and fills missing domains from defaults", () => {
    const projectRoot = createTempProjectRoot();

    writeConfigFixture(projectRoot, {
      runtime: "pi",
      models: {
        oracle: "pi:oracle-fast",
      },
      labor: {
        base_path: ".aegis/custom-labors",
      },
    });

    expect(loadConfig(projectRoot)).toEqual({
      ...DEFAULT_AEGIS_CONFIG,
      models: {
        ...DEFAULT_AEGIS_CONFIG.models,
        oracle: "pi:oracle-fast",
      },
      labor: {
        base_path: ".aegis/custom-labors",
      },
    });
  });

  it("fills missing nested config fields from defaults", () => {
    const projectRoot = createTempProjectRoot();

    writeConfigFixture(projectRoot, {
      thresholds: {
        stuck_warning_seconds: 30,
      },
    });

    expect(loadConfig(projectRoot).thresholds).toEqual({
      ...DEFAULT_AEGIS_CONFIG.thresholds,
      stuck_warning_seconds: 30,
    });
  });

  it("fails clearly when the config file is missing", () => {
    const projectRoot = createTempProjectRoot();

    expect(() => loadConfig(projectRoot)).toThrow(
      `Missing Aegis config at ${resolveConfigPath(projectRoot)}`,
    );
  });

  it("rejects unknown top-level config keys", () => {
    const projectRoot = createTempProjectRoot();

    writeConfigFixture(projectRoot, {
      runtime: "pi",
      unexpected: true,
    });

    expect(() => loadConfig(projectRoot)).toThrow(
      'Unknown config key "unexpected"',
    );
  });

  it("rejects invalid field types in nested config domains", () => {
    const projectRoot = createTempProjectRoot();

    writeConfigFixture(projectRoot, {
      runtime: "pi",
      models: {
        oracle: 3847,
      },
    });

    expect(() => loadConfig(projectRoot)).toThrow(
      'Expected "models.oracle" to be a string',
    );
  });

  it("rejects out-of-range numeric values", () => {
    const projectRoot = createTempProjectRoot();

    writeConfigFixture(projectRoot, {
      concurrency: {
        max_agents: 0,
      },
    });

    expect(() => loadConfig(projectRoot)).toThrow(
      'Expected "concurrency.max_agents" to be at least 1',
    );

    writeConfigFixture(projectRoot, {
      thresholds: {
        poll_interval_seconds: 0,
      },
    });

    expect(() => loadConfig(projectRoot)).toThrow(
      'Expected "thresholds.poll_interval_seconds" to be at least 1',
    );

    writeConfigFixture(projectRoot, {
      janus: {
        max_invocations_per_issue: 0,
      },
    });

    expect(() => loadConfig(projectRoot)).toThrow(
      'Expected "janus.max_invocations_per_issue" to be at least 1',
    );
  });

  it("reports malformed json with the config path", () => {
    const projectRoot = createTempProjectRoot();

    mkdirSync(path.dirname(resolveConfigPath(projectRoot)), { recursive: true });
    writeFileSync(resolveConfigPath(projectRoot), '{"runtime": "pi"', "utf8");

    expect(() => loadConfig(projectRoot)).toThrow(
      `Invalid Aegis config JSON at ${resolveConfigPath(projectRoot)}:`,
    );
  });
});
