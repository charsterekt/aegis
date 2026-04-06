/**
 * S09A contract seed — Sentinel parser contract tests.
 *
 * These tests define the strict machine-parseable shape for SentinelVerdict
 * from SPECv2 §10.3.1 and the failure semantics for malformed output.
 */

import { describe, expect, it } from "vitest";

import {
  SentinelVerdictParseError,
  parseSentinelVerdict,
} from "../../../../src/castes/sentinel/sentinel-parser.js";

function makeVerdict(overrides: Record<string, unknown> = {}) {
  return {
    verdict: "pass" as const,
    reviewSummary: "Code review completed. No issues found.",
    issuesFound: [],
    followUpIssueIds: [],
    riskAreas: ["Edge case in error handling not covered by tests"],
    ...overrides,
  };
}

describe("parseSentinelVerdict", () => {
  it("parses a valid minimal SentinelVerdict with pass", () => {
    const raw = JSON.stringify(makeVerdict());

    expect(parseSentinelVerdict(raw)).toEqual({
      verdict: "pass",
      reviewSummary: "Code review completed. No issues found.",
      issuesFound: [],
      followUpIssueIds: [],
      riskAreas: ["Edge case in error handling not covered by tests"],
    });
  });

  it("parses a fail verdict with issues and follow-up ids", () => {
    const raw = JSON.stringify(
      makeVerdict({
        verdict: "fail",
        reviewSummary: "Code review found critical issues.",
        issuesFound: [
          "Missing null check in dispatch-state.ts",
          "Race condition in merge queue handler",
        ],
        followUpIssueIds: ["aegis-fjm.30.1", "aegis-fjm.30.2"],
        riskAreas: ["Merge queue retry logic", "Error boundary handling"],
      }),
    );

    expect(parseSentinelVerdict(raw)).toEqual({
      verdict: "fail",
      reviewSummary: "Code review found critical issues.",
      issuesFound: [
        "Missing null check in dispatch-state.ts",
        "Race condition in merge queue handler",
      ],
      followUpIssueIds: ["aegis-fjm.30.1", "aegis-fjm.30.2"],
      riskAreas: ["Merge queue retry logic", "Error boundary handling"],
    });
  });

  it("parses a verdict with empty arrays", () => {
    const raw = JSON.stringify(
      makeVerdict({
        issuesFound: [],
        followUpIssueIds: [],
        riskAreas: [],
      }),
    );

    const result = parseSentinelVerdict(raw);
    expect(result.issuesFound).toEqual([]);
    expect(result.followUpIssueIds).toEqual([]);
    expect(result.riskAreas).toEqual([]);
  });

  it.each([
    ["reviewSummary", { verdict: "pass", issuesFound: [], followUpIssueIds: [], riskAreas: [] }],
    ["issuesFound", { verdict: "pass", reviewSummary: "ok", followUpIssueIds: [], riskAreas: [] }],
    ["followUpIssueIds", { verdict: "pass", reviewSummary: "ok", issuesFound: [], riskAreas: [] }],
    ["riskAreas", { verdict: "pass", reviewSummary: "ok", issuesFound: [], followUpIssueIds: [] }],
    ["verdict", { reviewSummary: "ok", issuesFound: [], followUpIssueIds: [], riskAreas: [] }],
  ])("rejects a missing required field: %s", (field, payload) => {
    const raw = JSON.stringify(payload);

    expect(() => parseSentinelVerdict(raw)).toThrow(SentinelVerdictParseError);
    expect(() => parseSentinelVerdict(raw)).toThrow(new RegExp(field, "i"));
  });

  it("rejects invalid verdict values", () => {
    const raw = JSON.stringify(makeVerdict({ verdict: "rejected" }));

    expect(() => parseSentinelVerdict(raw)).toThrow(SentinelVerdictParseError);
    expect(() => parseSentinelVerdict(raw)).toThrow(/verdict/i);
  });

  it("rejects non-string reviewSummary: number", () => {
    const raw = JSON.stringify(makeVerdict({ reviewSummary: 42 }));

    expect(() => parseSentinelVerdict(raw)).toThrow(SentinelVerdictParseError);
    expect(() => parseSentinelVerdict(raw)).toThrow(/reviewSummary/i);
  });

  it("rejects non-string reviewSummary: null", () => {
    const raw = JSON.stringify(makeVerdict({ reviewSummary: null }));

    expect(() => parseSentinelVerdict(raw)).toThrow(SentinelVerdictParseError);
  });

  it("rejects non-array issuesFound", () => {
    const raw = JSON.stringify(makeVerdict({ issuesFound: "just a string" }));

    expect(() => parseSentinelVerdict(raw)).toThrow(SentinelVerdictParseError);
    expect(() => parseSentinelVerdict(raw)).toThrow(/issuesFound/i);
  });

  it("rejects non-array followUpIssueIds", () => {
    const raw = JSON.stringify(makeVerdict({ followUpIssueIds: "not-an-array" }));

    expect(() => parseSentinelVerdict(raw)).toThrow(SentinelVerdictParseError);
    expect(() => parseSentinelVerdict(raw)).toThrow(/followUpIssueIds/i);
  });

  it("rejects non-array riskAreas", () => {
    const raw = JSON.stringify(makeVerdict({ riskAreas: 123 }));

    expect(() => parseSentinelVerdict(raw)).toThrow(SentinelVerdictParseError);
    expect(() => parseSentinelVerdict(raw)).toThrow(/riskAreas/i);
  });

  it("rejects issuesFound with non-string items", () => {
    const raw = JSON.stringify(
      makeVerdict({ issuesFound: ["valid issue", 42] }),
    );

    expect(() => parseSentinelVerdict(raw)).toThrow(SentinelVerdictParseError);
    expect(() => parseSentinelVerdict(raw)).toThrow(/issuesFound/i);
  });

  it("rejects followUpIssueIds with non-string items", () => {
    const raw = JSON.stringify(
      makeVerdict({ followUpIssueIds: ["aegis-fjm.30.1", null] }),
    );

    expect(() => parseSentinelVerdict(raw)).toThrow(SentinelVerdictParseError);
  });

  it("rejects riskAreas with non-string items", () => {
    const raw = JSON.stringify(
      makeVerdict({ riskAreas: ["Valid risk", { nested: true }] }),
    );

    expect(() => parseSentinelVerdict(raw)).toThrow(SentinelVerdictParseError);
  });

  it("rejects extra top-level keys to keep the contract strict", () => {
    const raw = JSON.stringify(
      makeVerdict({
        extraField: "not part of the contract",
      }),
    );

    expect(() => parseSentinelVerdict(raw)).toThrow(SentinelVerdictParseError);
    expect(() => parseSentinelVerdict(raw)).toThrow(/extraField/i);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseSentinelVerdict("{ not json")).toThrow(SentinelVerdictParseError);
    expect(() => parseSentinelVerdict("{ not json")).toThrow(/JSON/i);
  });

  it("rejects non-object JSON roots: null", () => {
    expect(() => parseSentinelVerdict("null")).toThrow(SentinelVerdictParseError);
    const err = (() => {
      try { parseSentinelVerdict("null"); } catch (e) { return e as SentinelVerdictParseError; }
    })();
    expect(err?.reason).toBe("invalid_shape");
  });

  it("rejects non-object JSON roots: array", () => {
    expect(() => parseSentinelVerdict("[]")).toThrow(SentinelVerdictParseError);
    const err = (() => {
      try { parseSentinelVerdict("[]"); } catch (e) { return e as SentinelVerdictParseError; }
    })();
    expect(err?.reason).toBe("invalid_shape");
  });

  it("rejects non-object JSON roots: string", () => {
    expect(() => parseSentinelVerdict('"hello"')).toThrow(SentinelVerdictParseError);
    const err = (() => {
      try { parseSentinelVerdict('"hello"'); } catch (e) { return e as SentinelVerdictParseError; }
    })();
    expect(err?.reason).toBe("invalid_shape");
  });

  it("rejects non-object JSON roots: number", () => {
    expect(() => parseSentinelVerdict("42")).toThrow(SentinelVerdictParseError);
    const err = (() => {
      try { parseSentinelVerdict("42"); } catch (e) { return e as SentinelVerdictParseError; }
    })();
    expect(err?.reason).toBe("invalid_shape");
  });

  it("distinguishes invalid_json vs invalid_shape error reasons", () => {
    const jsonErr = (() => {
      try { parseSentinelVerdict("{bad"); } catch (e) { return e as SentinelVerdictParseError; }
    })();
    expect(jsonErr?.reason).toBe("invalid_json");

    const shapeErr = (() => {
      try { parseSentinelVerdict("{}"); } catch (e) { return e as SentinelVerdictParseError; }
    })();
    expect(shapeErr?.reason).toBe("invalid_shape");
  });

  it("accepts a pass verdict with non-empty riskAreas", () => {
    const raw = JSON.stringify(
      makeVerdict({
        verdict: "pass",
        riskAreas: ["Potential memory leak in long-running sessions"],
      }),
    );

    const result = parseSentinelVerdict(raw);
    expect(result.verdict).toBe("pass");
    expect(result.riskAreas).toEqual(["Potential memory leak in long-running sessions"]);
  });

  it("accepts a fail verdict with empty followUpIssueIds", () => {
    // Contract does not require followUpIssueIds to be non-empty on fail;
    // the dispatcher handles issue creation separately.
    const raw = JSON.stringify(
      makeVerdict({
        verdict: "fail",
        reviewSummary: "Review failed",
        issuesFound: ["Missing tests"],
        followUpIssueIds: [],
        riskAreas: [],
      }),
    );

    const result = parseSentinelVerdict(raw);
    expect(result.verdict).toBe("fail");
    expect(result.followUpIssueIds).toEqual([]);
  });
});
