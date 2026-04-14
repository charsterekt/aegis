import path from "node:path";
import { readFileSync } from "node:fs";

import { DEFAULT_AEGIS_CONFIG } from "./defaults.js";
import {
  AEGIS_DIRECTORY,
  CONCURRENCY_KEYS,
  CONFIG_TOP_LEVEL_KEYS,
  JANUS_KEYS,
  LABOR_KEYS,
  MODEL_KEYS,
  THRESHOLD_KEYS,
  GIT_KEYS,
} from "./schema.js";
import type { AegisConfig } from "./schema.js";

export { AEGIS_DIRECTORY } from "./schema.js";

export const DEFAULT_CONFIG_FILE = "config.json";
export const AEGIS_CONFIG_PATH = `${AEGIS_DIRECTORY}/${DEFAULT_CONFIG_FILE}`;

export function resolveProjectRelativePath(
  root: string,
  relativePath: string,
) {
  return path.join(path.resolve(root), ...relativePath.split("/"));
}

export function resolveConfigPath(root = process.cwd()) {
  return resolveProjectRelativePath(root, AEGIS_CONFIG_PATH);
}

type PartialConfig = Partial<AegisConfig>;
type ConfigRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ConfigRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, fieldPath: string): asserts value is ConfigRecord {
  if (!isRecord(value)) {
    throw new Error(`Expected "${fieldPath}" to be an object`);
  }
}

function assertString(value: unknown, fieldPath: string) {
  if (typeof value !== "string") {
    throw new Error(`Expected "${fieldPath}" to be a string`);
  }
}

function assertBoolean(value: unknown, fieldPath: string) {
  if (typeof value !== "boolean") {
    throw new Error(`Expected "${fieldPath}" to be a boolean`);
  }
}

function assertNumber(value: unknown, fieldPath: string): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Expected "${fieldPath}" to be a number`);
  }
}

function assertNumberAtLeast(value: unknown, fieldPath: string, minimum: number) {
  assertNumber(value, fieldPath);
  if (value < minimum) {
    throw new Error(`Expected "${fieldPath}" to be at least ${minimum}`);
  }
}

function validateKnownKeys(
  value: ConfigRecord,
  fieldPath: string,
  allowedKeys: readonly string[],
) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      const prefix = fieldPath === "config" ? "config key" : `${fieldPath} key`;
      throw new Error(`Unknown ${prefix} "${key}"`);
    }
  }
}

export function validatePartialConfig(config: unknown): asserts config is PartialConfig {
  assertRecord(config, "config");
  validateKnownKeys(config, "config", CONFIG_TOP_LEVEL_KEYS);

  if ("runtime" in config) {
    assertString(config.runtime, "runtime");
  }

  if ("models" in config) {
    assertRecord(config.models, "models");
    validateKnownKeys(config.models, "models", MODEL_KEYS);
    for (const key of Object.keys(config.models)) {
      assertString(config.models[key], `models.${key}`);
    }
  }

  if ("concurrency" in config) {
    assertRecord(config.concurrency, "concurrency");
    validateKnownKeys(config.concurrency, "concurrency", CONCURRENCY_KEYS);
    for (const key of Object.keys(config.concurrency)) {
      assertNumberAtLeast(config.concurrency[key], `concurrency.${key}`, 1);
    }
  }

  if ("thresholds" in config) {
    assertRecord(config.thresholds, "thresholds");
    validateKnownKeys(config.thresholds, "thresholds", THRESHOLD_KEYS);

    for (const key of [
      "poll_interval_seconds",
      "stuck_warning_seconds",
      "stuck_kill_seconds",
      "janus_retry_threshold",
    ] as const) {
      if (key in config.thresholds) {
        assertNumberAtLeast(config.thresholds[key], `thresholds.${key}`, 1);
      }
    }

    if ("scope_overlap_threshold" in config.thresholds) {
      assertNumberAtLeast(
        config.thresholds.scope_overlap_threshold,
        "thresholds.scope_overlap_threshold",
        0,
      );
    }

    if ("allow_complex_auto_dispatch" in config.thresholds) {
      assertBoolean(
        config.thresholds.allow_complex_auto_dispatch,
        "thresholds.allow_complex_auto_dispatch",
      );
    }
  }

  if ("janus" in config) {
    assertRecord(config.janus, "janus");
    validateKnownKeys(config.janus, "janus", JANUS_KEYS);
    if ("enabled" in config.janus) {
      assertBoolean(config.janus.enabled, "janus.enabled");
    }
    if ("max_invocations_per_issue" in config.janus) {
      assertNumberAtLeast(
        config.janus.max_invocations_per_issue,
        "janus.max_invocations_per_issue",
        1,
      );
    }
  }

  if ("labor" in config) {
    assertRecord(config.labor, "labor");
    validateKnownKeys(config.labor, "labor", LABOR_KEYS);
    if ("base_path" in config.labor) {
      assertString(config.labor.base_path, "labor.base_path");
    }
  }

  if ("git" in config) {
    assertRecord(config.git, "git");
    validateKnownKeys(config.git, "git", GIT_KEYS);
    if ("base_branch" in config.git) {
      assertString(config.git.base_branch, "git.base_branch");
    }
  }
}

export function mergeConfig(config: PartialConfig): AegisConfig {
  return {
    ...DEFAULT_AEGIS_CONFIG,
    ...config,
    models: {
      ...DEFAULT_AEGIS_CONFIG.models,
      ...config.models,
    },
    concurrency: {
      ...DEFAULT_AEGIS_CONFIG.concurrency,
      ...config.concurrency,
    },
    thresholds: {
      ...DEFAULT_AEGIS_CONFIG.thresholds,
      ...config.thresholds,
    },
    janus: {
      ...DEFAULT_AEGIS_CONFIG.janus,
      ...config.janus,
    },
    labor: {
      ...DEFAULT_AEGIS_CONFIG.labor,
      ...config.labor,
    },
    git: {
      ...DEFAULT_AEGIS_CONFIG.git,
      ...config.git,
    },
  };
}

export function applyConfigPatch(
  current: AegisConfig,
  patch: unknown,
): AegisConfig {
  validatePartialConfig(patch);
  const partial = patch as PartialConfig;

  return {
    ...current,
    ...partial,
    models: {
      ...current.models,
      ...partial.models,
    },
    concurrency: {
      ...current.concurrency,
      ...partial.concurrency,
    },
    thresholds: {
      ...current.thresholds,
      ...partial.thresholds,
    },
    janus: {
      ...current.janus,
      ...partial.janus,
    },
    labor: {
      ...current.labor,
      ...partial.labor,
    },
    git: {
      ...current.git,
      ...partial.git,
    },
  };
}

export function loadConfig(root = process.cwd()): AegisConfig {
  const configPath = resolveConfigPath(root);

  let rawConfig: string;

  try {
    rawConfig = readFileSync(configPath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`Missing Aegis config at ${configPath}`);
    }

    throw error;
  }

  let parsedConfig: unknown;

  try {
    parsedConfig = JSON.parse(rawConfig) as unknown;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid Aegis config JSON at ${configPath}: ${details}`);
  }

  validatePartialConfig(parsedConfig);
  return mergeConfig(parsedConfig);
}
