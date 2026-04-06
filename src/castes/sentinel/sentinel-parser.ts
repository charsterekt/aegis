/**
 * Sentinel verdict parsing contract.
 *
 * SPECv2 §10.3.1 defines the machine-parseable SentinelVerdict shape. This
 * module parses and validates that contract strictly so downstream code can
 * rely on a stable structure.
 */

// ---------------------------------------------------------------------------
// SentinelVerdict contract
// ---------------------------------------------------------------------------

export type SentinelVerdictValue = "pass" | "fail";

export interface SentinelVerdict {
  verdict: SentinelVerdictValue;
  reviewSummary: string;
  issuesFound: string[];
  followUpIssueIds: string[];
  riskAreas: string[];
}

export type SentinelVerdictParseReason = "invalid_json" | "invalid_shape";

export class SentinelVerdictParseError extends Error {
  readonly reason: SentinelVerdictParseReason;

  constructor(reason: SentinelVerdictParseReason, message: string) {
    super(message);
    this.name = "SentinelVerdictParseError";
    this.reason = reason;
  }
}

const SENTINEL_VERDICT_KEYS = new Set([
  "verdict",
  "reviewSummary",
  "issuesFound",
  "followUpIssueIds",
  "riskAreas",
]);

function assertPlainObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SentinelVerdictParseError(
      "invalid_shape",
      "Sentinel verdict must be a JSON object.",
    );
  }
  return value as Record<string, unknown>;
}

function assertString(value: unknown, key: string): string {
  if (typeof value !== "string") {
    throw new SentinelVerdictParseError(
      "invalid_shape",
      `Sentinel verdict field '${key}' must be a string.`,
    );
  }
  return value;
}

function assertStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new SentinelVerdictParseError(
      "invalid_shape",
      `Sentinel verdict field '${key}' must be an array of strings.`,
    );
  }
  return value.slice();
}

function assertVerdict(value: unknown): SentinelVerdictValue {
  if (value === "pass" || value === "fail") {
    return value;
  }
  throw new SentinelVerdictParseError(
    "invalid_shape",
    "Sentinel verdict field 'verdict' must be one of 'pass' or 'fail'.",
  );
}

/**
 * Parse a raw Sentinel output string into a strict SentinelVerdict.
 *
 * The parser rejects malformed JSON, missing fields, wrong types, and unknown
 * top-level keys so later stages do not infer meaning from narrative text.
 */
export function parseSentinelVerdict(raw: string): SentinelVerdict {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new SentinelVerdictParseError(
      "invalid_json",
      `Sentinel verdict is not valid JSON: ${(err as Error).message}`,
    );
  }

  const obj = assertPlainObject(parsed);
  for (const key of Object.keys(obj)) {
    if (!SENTINEL_VERDICT_KEYS.has(key)) {
      throw new SentinelVerdictParseError(
        "invalid_shape",
        `Sentinel verdict contains an unexpected field: ${key}`,
      );
    }
  }

  const verdictField = obj["verdict"];
  const reviewSummary = obj["reviewSummary"];
  const issuesFound = obj["issuesFound"];
  const followUpIssueIds = obj["followUpIssueIds"];
  const riskAreas = obj["riskAreas"];

  const requiredFields = ["verdict", "reviewSummary", "issuesFound", "followUpIssueIds", "riskAreas"];
  for (const field of requiredFields) {
    if (!(field in obj)) {
      throw new SentinelVerdictParseError(
        "invalid_shape",
        `Sentinel verdict is missing required field '${field}'.`,
      );
    }
  }

  return {
    verdict: assertVerdict(verdictField),
    reviewSummary: assertString(reviewSummary, "reviewSummary"),
    issuesFound: assertStringArray(issuesFound, "issuesFound"),
    followUpIssueIds: assertStringArray(followUpIssueIds, "followUpIssueIds"),
    riskAreas: assertStringArray(riskAreas, "riskAreas"),
  };
}
