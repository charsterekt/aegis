import path from "node:path";

import { AEGIS_DIRECTORY } from "./schema.js";

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
