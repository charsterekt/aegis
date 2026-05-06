import { describe, expect, it } from "vitest";

import { parseTitanArtifact } from "../../../src/castes/titan/titan-parser.js";

describe("parseTitanArtifact", () => {
  it("parses a valid titan success artifact", () => {
    expect(
      parseTitanArtifact(JSON.stringify({
        outcome: "success",
        summary: "done",
        files_changed: ["src/index.ts"],
        tests_and_checks_run: ["npm test"],
        known_risks: [],
        follow_up_work: [],
      })),
    ).toMatchObject({
      outcome: "success",
      summary: "done",
      files_changed: ["src/index.ts"],
    });
  });

  it("normalizes quoted outcome and proposal enums from weak local tool callers", () => {
    expect(
      parseTitanArtifact(JSON.stringify({
        outcome: "\"clarification\"",
        summary: "needs product answer",
        files_changed: [],
        tests_and_checks_run: [],
        known_risks: ["blocked on ambiguity"],
        follow_up_work: [],
        mutation_proposal: {
          proposal_type: "\"create_clarification_blocker\"",
          summary: "Need acceptance rule.",
          suggested_title: "Clarify acceptance rule",
          suggested_description: "Parent cannot proceed until acceptance rule is explicit.",
          scope_evidence: ["Issue asks for policy but omits gate condition."],
        },
      })),
    ).toMatchObject({
      outcome: "clarification",
      mutation_proposal: {
        proposal_type: "create_clarification_blocker",
      },
    });
  });

  it("parses a valid already-satisfied artifact", () => {
    expect(
      parseTitanArtifact(JSON.stringify({
        outcome: "already_satisfied",
        summary: "Issue contract already satisfied by prior merged work.",
        files_changed: [],
        tests_and_checks_run: ["npm run build"],
        known_risks: [],
        follow_up_work: [],
      })),
    ).toMatchObject({
      outcome: "already_satisfied",
      files_changed: [],
      tests_and_checks_run: ["npm run build"],
    });
  });

  it("parses a blocking mutation proposal", () => {
    expect(
      parseTitanArtifact(JSON.stringify({
        outcome: "clarification",
        summary: "needs product answer",
        files_changed: [],
        tests_and_checks_run: [],
        known_risks: ["blocked on ambiguity"],
        follow_up_work: [],
        mutation_proposal: {
          proposal_type: "create_clarification_blocker",
          summary: "Need acceptance rule.",
          suggested_title: "Clarify acceptance rule",
          suggested_description: "Parent cannot proceed until acceptance rule is explicit.",
          scope_evidence: ["Issue asks for policy but omits gate condition."],
        },
      })),
    ).toMatchObject({
      outcome: "clarification",
      mutation_proposal: {
        proposal_type: "create_clarification_blocker",
        suggested_title: "Clarify acceptance rule",
      },
    });
  });

  it("rejects non-blocking follow-up creation authority", () => {
    expect(() =>
      parseTitanArtifact(JSON.stringify({
        outcome: "success",
        summary: "done",
        files_changed: [],
        tests_and_checks_run: [],
        known_risks: [],
        follow_up_work: [],
        mutation_proposal: {
          proposal_type: "create_follow_up",
          summary: "nice to have cleanup",
          suggested_title: "Cleanup",
          suggested_description: "Non-blocking cleanup.",
          scope_evidence: ["Observed while editing."],
        },
      })),
    ).toThrow(/proposal_type/i);
  });

  it("normalizes live blocking_dependency proposals into out-of-scope blockers", () => {
    expect(
      parseTitanArtifact(JSON.stringify({
        outcome: "failure",
        summary: "package manifest is out of scope",
        files_changed: [],
        tests_and_checks_run: ["npm install"],
        known_risks: [],
        follow_up_work: [],
        mutation_proposal: {
          proposal_type: "blocking_dependency",
          summary: "Need package manifest scope.",
          suggested_title: "Allow package manifest updates",
          suggested_description: "Scripts must be added to package.json.",
          scope_evidence: "package.json is outside the current allowed file scope.",
        },
      })).mutation_proposal,
    ).toEqual({
      proposal_type: "create_out_of_scope_blocker",
      summary: "Need package manifest scope.",
      suggested_title: "Allow package manifest updates",
      suggested_description: "Scripts must be added to package.json.",
      scope_evidence: ["package.json is outside the current allowed file scope."],
    });
  });

  it("rejects unexpected keys", () => {
    expect(() =>
      parseTitanArtifact(JSON.stringify({
        outcome: "success",
        summary: "done",
        files_changed: [],
        tests_and_checks_run: [],
        known_risks: [],
        follow_up_work: [],
        extra: true,
      })),
    ).toThrow(/unexpected keys/i);
  });

  it("rejects obsolete Mnemosyne artifact fields", () => {
    expect(() =>
      parseTitanArtifact(JSON.stringify({
        outcome: "success",
        summary: "done",
        files_changed: [],
        tests_and_checks_run: [],
        known_risks: [],
        follow_up_work: [],
        learnings_written_to_mnemosyne: [],
      })),
    ).toThrow(/unexpected keys/i);
  });
});
