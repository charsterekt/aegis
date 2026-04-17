export const CASTE_CONFIG_KEYS = [
  "oracle",
  "titan",
  "sentinel",
  "janus",
] as const;

export type CasteConfigKey = (typeof CASTE_CONFIG_KEYS)[number];

export type CasteConfigRecord<T> = Record<CasteConfigKey, T>;

export function createCasteConfig<T>(
  resolver: (caste: CasteConfigKey) => T,
): CasteConfigRecord<T> {
  const result = {} as CasteConfigRecord<T>;

  for (const caste of CASTE_CONFIG_KEYS) {
    result[caste] = resolver(caste);
  }

  return result;
}
