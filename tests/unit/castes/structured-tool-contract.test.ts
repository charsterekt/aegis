import { describe, expect, it } from "vitest";

import {
  enforceJanusToolPayloadContract,
  extractJanusResolutionFromToolEvent,
  JANUS_EMIT_RESOLUTION_TOOL_NAME,
} from "../../../src/castes/janus/janus-tool-contract.js";
import {
  enforceSentinelToolPayloadContract,
  extractSentinelVerdictFromToolEvent,
  SENTINEL_EMIT_VERDICT_TOOL_NAME,
} from "../../../src/castes/sentinel/sentinel-tool-contract.js";
import {
  enforceTitanToolPayloadContract,
  extractTitanArtifactFromToolEvent,
  TITAN_EMIT_ARTIFACT_TOOL_NAME,
} from "../../../src/castes/titan/titan-tool-contract.js";

describe("non-oracle structured tool contracts", () => {
  it("enforces Titan payload to forced function call", () => {
    expect(enforceTitanToolPayloadContract({
      model: "gpt-5.4-mini",
      tools: [],
      tool_choice: "auto",
      parallel_tool_calls: true,
    })).toEqual({
      model: "gpt-5.4-mini",
      tools: [],
      tool_choice: {
        type: "function",
        name: TITAN_EMIT_ARTIFACT_TOOL_NAME,
      },
      parallel_tool_calls: false,
    });
  });

  it("extracts Titan artifact from matching tool event", () => {
    expect(extractTitanArtifactFromToolEvent({
      type: "tool_execution_end",
      toolCallId: "call-1",
      toolName: TITAN_EMIT_ARTIFACT_TOOL_NAME,
      isError: false,
      result: {
        content: [],
        details: {
          artifact: {
            outcome: "success",
            summary: "implemented",
            files_changed: ["src/index.ts"],
            tests_and_checks_run: [],
            known_risks: [],
            follow_up_work: [],
            learnings_written_to_mnemosyne: [],
          },
        },
      },
    })).toMatchObject({
      outcome: "success",
      summary: "implemented",
    });
  });

  it("extracts Sentinel verdict from matching tool event", () => {
    expect(extractSentinelVerdictFromToolEvent({
      type: "tool_execution_end",
      toolCallId: "call-2",
      toolName: SENTINEL_EMIT_VERDICT_TOOL_NAME,
      isError: false,
      result: {
        content: [],
        details: {
          verdict: {
            verdict: "pass",
            reviewSummary: "clean merge",
            issuesFound: [],
            followUpIssueIds: [],
            riskAreas: [],
          },
        },
      },
    })).toEqual({
      verdict: "pass",
      reviewSummary: "clean merge",
      issuesFound: [],
      followUpIssueIds: [],
      riskAreas: [],
    });
  });

  it("does not re-force Janus payload after tool result exists", () => {
    expect(enforceJanusToolPayloadContract({
      model: "gpt-5.4-mini",
      tools: [],
      tool_choice: "auto",
      parallel_tool_calls: true,
      input: [
        {
          type: "function_call_output",
          call_id: "call_1",
          output: "{\"recommendedNextAction\":\"requeue\"}",
        },
      ],
    })).toBeUndefined();
  });

  it("extracts Janus artifact from matching tool event", () => {
    expect(extractJanusResolutionFromToolEvent({
      type: "tool_execution_end",
      toolCallId: "call-3",
      toolName: JANUS_EMIT_RESOLUTION_TOOL_NAME,
      isError: false,
      result: {
        content: [],
        details: {
          artifact: {
            originatingIssueId: "aegis-1",
            queueItemId: "queue-aegis-1",
            preservedLaborPath: "scratchpad/aegis-1",
            conflictSummary: "conflict in README",
            resolutionStrategy: "manual",
            filesTouched: [],
            validationsRun: [],
            residualRisks: [],
            recommendedNextAction: "manual_decision",
          },
        },
      },
    })).toMatchObject({
      originatingIssueId: "aegis-1",
      recommendedNextAction: "manual_decision",
    });
  });

  it("returns null for malformed Sentinel verdict payload", () => {
    expect(extractSentinelVerdictFromToolEvent({
      type: "tool_execution_end",
      toolCallId: "call-4",
      toolName: SENTINEL_EMIT_VERDICT_TOOL_NAME,
      isError: false,
      result: {
        content: [],
        details: {
          verdict: {
            reviewSummary: "missing required verdict",
            issuesFound: [],
            followUpIssueIds: [],
            riskAreas: [],
          },
        },
      },
    })).toBeNull();
  });
});
