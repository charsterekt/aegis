import path from "node:path";

import {
  AEGIS_CONFIG_PATH,
  resolveProjectRelativePath,
} from "./load-config.js";
import { AEGIS_DIRECTORY, RUNTIME_STATE_FILES } from "./schema.js";

export const REQUIRED_PROJECT_DIRECTORIES = [
  AEGIS_DIRECTORY,
  ".aegis/labors",
  ".aegis/evals",
] as const;

export const REQUIRED_PROJECT_FILES = [
  AEGIS_CONFIG_PATH,
  ...RUNTIME_STATE_FILES,
] as const;

export const DEFAULT_GITIGNORE_ENTRIES = [
  AEGIS_CONFIG_PATH,
  ".aegis/dispatch-state.json",
  ".aegis/merge-queue.json",
  ".aegis/labors/",
  ".aegis/evals/",
] as const;

export interface InitProjectPlan {
  repoRoot: string;
  directories: string[];
  files: string[];
  gitIgnoreEntries: readonly string[];
}

export function buildInitProjectPlan(root = process.cwd()): InitProjectPlan {
  const repoRoot = path.resolve(root);

  return {
    repoRoot,
    directories: REQUIRED_PROJECT_DIRECTORIES.map((entry) =>
      resolveProjectRelativePath(repoRoot, entry),
    ),
    files: REQUIRED_PROJECT_FILES.map((entry) =>
      resolveProjectRelativePath(repoRoot, entry),
    ),
    gitIgnoreEntries: DEFAULT_GITIGNORE_ENTRIES,
  };
}
