import { Type } from "@sinclair/typebox";

import { parseJanusResolutionArtifact, type JanusResolutionArtifact } from "./janus-parser.js";
import { createStructuredToolContract } from "../tool-contract.js";

export const JANUS_EMIT_RESOLUTION_TOOL_NAME = "emit_janus_resolution_artifact";

const janusStructuredContract = createStructuredToolContract<JanusResolutionArtifact>({
  toolName: JANUS_EMIT_RESOLUTION_TOOL_NAME,
  label: "Emit Janus Resolution Artifact",
  description:
    "Finalize conflict handling by returning contract JSON with keys originatingIssueId, queueItemId, preservedLaborPath, conflictSummary, resolutionStrategy, filesTouched, validationsRun, residualRisks, recommendedNextAction.",
  parameters: Type.Object(
    {
      originatingIssueId: Type.String(),
      queueItemId: Type.String(),
      preservedLaborPath: Type.String(),
      conflictSummary: Type.String(),
      resolutionStrategy: Type.String(),
      filesTouched: Type.Array(Type.String()),
      validationsRun: Type.Array(Type.String()),
      residualRisks: Type.Array(Type.String()),
      recommendedNextAction: Type.Union([
        Type.Literal("requeue"),
        Type.Literal("manual_decision"),
        Type.Literal("fail"),
      ]),
    },
    {
      additionalProperties: false,
    },
  ),
  detailsKey: "artifact",
  successText: "Janus resolution artifact captured.",
  invalidPayloadError: "Janus resolution artifact tool received invalid payload.",
  parse: parseJanusResolutionArtifact,
});

export function createJanusEmitResolutionTool() {
  return janusStructuredContract.createTool();
}

export function extractJanusResolutionFromToolEvent(event: Parameters<
  typeof janusStructuredContract.extractFromToolEvent
>[0]): JanusResolutionArtifact | null {
  return janusStructuredContract.extractFromToolEvent(event);
}

export function enforceJanusToolPayloadContract(payload: unknown): unknown | undefined {
  return janusStructuredContract.enforcePayloadContract(payload);
}

export function stringifyJanusResolutionArtifact(artifact: JanusResolutionArtifact): string {
  return janusStructuredContract.stringify(artifact);
}
