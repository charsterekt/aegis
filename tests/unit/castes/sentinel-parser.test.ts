import { describe, expect, it } from "vitest";

import { parseSentinelVerdict } from "../../../src/castes/sentinel/sentinel-parser.js";

describe("parseSentinelVerdict", () => {
  it("parses a valid verdict", () => {
    expect(
      parseSentinelVerdict(JSON.stringify({
        verdict: "pass",
        reviewSummary: "clean",
        blockingFindings: [],
        advisories: [],
        touchedFiles: ["src/index.ts"],
        contractChecks: ["no old follow-up authority"],
      })),
    ).toMatchObject({
      verdict: "pass",
      reviewSummary: "clean",
      blockingFindings: [],
    });
  });

  it("parses fail_blocking with typed blocking findings and advisories", () => {
    expect(
      parseSentinelVerdict(JSON.stringify({
        verdict: "fail_blocking",
        reviewSummary: "contract broken",
        blockingFindings: [{
          finding_kind: "contract_gap",
          summary: "missing required test",
          required_files: ["tests/unit/core/example.test.ts"],
          owner_issue: "aegis-123",
          route: "rework_owner",
        }],
        advisories: ["rename helper later"],
        touchedFiles: ["src/index.ts"],
        contractChecks: ["required tests run"],
      })),
    ).toEqual({
      verdict: "fail_blocking",
      reviewSummary: "contract broken",
      blockingFindings: [{
        finding_kind: "contract_gap",
        summary: "missing required test",
        required_files: ["tests/unit/core/example.test.ts"],
        owner_issue: "aegis-123",
        route: "rework_owner",
      }],
      advisories: ["rename helper later"],
      touchedFiles: ["src/index.ts"],
      contractChecks: ["required tests run"],
    });
  });

  it("normalizes quoted enum values from weak local tool callers", () => {
    expect(
      parseSentinelVerdict(JSON.stringify({
        verdict: "\"fail_blocking\"",
        reviewSummary: "contract broken",
        blockingFindings: [{
          finding_kind: "\"contract_gap\"",
          summary: "missing required test",
          required_files: ["tests/unit/core/example.test.ts"],
          owner_issue: "aegis-123",
          route: "\"rework_owner\"",
        }],
        advisories: [],
        touchedFiles: ["src/index.ts"],
        contractChecks: ["required tests run"],
      })),
    ).toMatchObject({
      verdict: "fail_blocking",
      blockingFindings: [{
        finding_kind: "contract_gap",
        route: "rework_owner",
      }],
    });
  });

  it("rejects legacy string blocking findings", () => {
    expect(() =>
      parseSentinelVerdict(JSON.stringify({
        verdict: "fail_blocking",
        reviewSummary: "contract broken",
        blockingFindings: ["missing required test"],
        advisories: [],
        touchedFiles: ["src/index.ts"],
        contractChecks: ["required tests run"],
      })),
    ).toThrow(/blockingFindings/i);
  });

  it("rejects pass verdicts that include blocking findings", () => {
    expect(() =>
      parseSentinelVerdict(JSON.stringify({
        verdict: "pass",
        reviewSummary: "contradictory",
        blockingFindings: [{
          finding_kind: "contract_gap",
          summary: "missing required test",
          required_files: ["tests/unit/core/example.test.ts"],
          owner_issue: "aegis-123",
          route: "rework_owner",
        }],
        advisories: [],
        touchedFiles: ["src/index.ts"],
        contractChecks: ["required tests run"],
      })),
    ).toThrow(/pass verdict/i);
  });

  it("rejects fail_blocking verdicts without blocking findings", () => {
    expect(() =>
      parseSentinelVerdict(JSON.stringify({
        verdict: "fail_blocking",
        reviewSummary: "missing evidence",
        blockingFindings: [],
        advisories: [],
        touchedFiles: ["src/index.ts"],
        contractChecks: ["required tests run"],
      })),
    ).toThrow(/fail_blocking verdict/i);
  });

  it("extracts string summaries from live contractChecks objects", () => {
    expect(
      parseSentinelVerdict(JSON.stringify({
        verdict: "pass",
        reviewSummary: "clean",
        blockingFindings: [],
        advisories: [],
        touchedFiles: ["docs/setup-contract.md"],
        contractChecks: [
          { check: "Local run targets cover install/dev/build/preview", result: "pass" },
        ],
      })).contractChecks,
    ).toEqual(["Local run targets cover install/dev/build/preview: pass"]);
  });

  it("rejects old follow-up control fields", () => {
    expect(() =>
      parseSentinelVerdict(JSON.stringify({
        verdict: "pass",
        reviewSummary: "clean",
        blockingFindings: [],
        advisories: [],
        touchedFiles: [],
        contractChecks: [],
        followUpIssueIds: ["aegis-2"],
      })),
    ).toThrow(/unexpected field/i);
  });

  it("rejects missing required fields", () => {
    expect(() =>
      parseSentinelVerdict(JSON.stringify({
        verdict: "pass",
        reviewSummary: "clean",
      })),
    ).toThrow(/missing required field/i);
  });
});
