export interface FileScope {
  files: string[];
}

export interface NormalizeScopeFileOptions {
  lowercase?: boolean;
}

export function normalizeScopeFile(
  candidate: string,
  options: NormalizeScopeFileOptions = {},
) {
  const normalized = candidate.replace(/\\/g, "/").replace(/^\.\//, "").trim();
  return options.lowercase ? normalized.toLowerCase() : normalized;
}

export function normalizeFileScope(files: string[]): FileScope | null {
  const normalized = [...new Set(
    files
      .map((entry) => normalizeScopeFile(entry))
      .filter((entry) => entry.length > 0),
  )].sort();

  return normalized.length > 0 ? { files: normalized } : null;
}

export function normalizeScopeStem(candidate: string) {
  const normalized = normalizeScopeFile(candidate);
  const lastSlashIndex = normalized.lastIndexOf("/");
  const lastDotIndex = normalized.lastIndexOf(".");
  return lastDotIndex > lastSlashIndex
    ? normalized.slice(0, lastDotIndex)
    : normalized;
}

export function calculateScopeOverlapCount(left: string[], right: string[]) {
  const leftStems = new Set(left.map((entry) => normalizeScopeStem(entry)).filter((entry) => entry.length > 0));
  const rightStems = new Set(right.map((entry) => normalizeScopeStem(entry)).filter((entry) => entry.length > 0));
  let overlap = 0;
  for (const entry of leftStems) {
    if (rightStems.has(entry)) {
      overlap += 1;
    }
  }
  return overlap;
}

export function hasScopeIntersection(left: string[], right: string[]) {
  const rightSet = new Set(right.map((entry) => normalizeScopeFile(entry)));
  return left.map((entry) => normalizeScopeFile(entry)).some((entry) => rightSet.has(entry));
}

export function hasNewScope(current: string[], expanded: string[]) {
  const currentSet = new Set(current.map((entry) => normalizeScopeFile(entry)));
  return expanded.some((entry) => !currentSet.has(normalizeScopeFile(entry)));
}
