import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { AgentCaste, DispatchRecord } from "./dispatch-state.js";

const TOOL_BY_CASTE: Record<AgentCaste, string> = {
  oracle: "emit_oracle_assessment",
  titan: "emit_titan_artifact",
  sentinel: "emit_sentinel_verdict",
  janus: "emit_janus_resolution_artifact",
};

interface FailureSteeringInput {
  root: string;
  caste: AgentCaste;
  record: DispatchRecord;
}

interface TranscriptSummary {
  error: string | null;
  outputText: string | null;
  recentMessages: string[];
}

function readTranscriptSummary(root: string, ref: string | null | undefined): TranscriptSummary | null {
  if (!ref) {
    return null;
  }

  const resolvedPath = path.isAbsolute(ref) ? ref : path.join(root, ref);
  if (!existsSync(resolvedPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(resolvedPath, "utf8")) as Record<string, unknown>;
    const messageLog = Array.isArray(parsed.messageLog) ? parsed.messageLog : [];
    const recentMessages = messageLog
      .slice(-4)
      .flatMap((message) => {
        if (typeof message !== "object" || message === null || Array.isArray(message)) {
          return [];
        }
        const content = (message as Record<string, unknown>).content;
        return typeof content === "string" ? [content] : [];
      });

    return {
      error: typeof parsed.error === "string" ? parsed.error : null,
      outputText: typeof parsed.outputText === "string" ? parsed.outputText : null,
      recentMessages,
    };
  } catch {
    return null;
  }
}

function compactText(input: string) {
  return input.replace(/\s+/g, " ").trim().slice(0, 240);
}

function containsAny(haystack: string, needles: string[]) {
  const normalized = haystack.toLowerCase();
  return needles.some((needle) => normalized.includes(needle.toLowerCase()));
}

function addUnique(lines: string[], line: string) {
  if (!lines.includes(line)) {
    lines.push(line);
  }
}

export function buildFailureSteeringPromptLines(input: FailureSteeringInput): string[] {
  const lines: string[] = [];
  const transcript = readTranscriptSummary(input.root, input.record.failureTranscriptRef);
  const transcriptText = [
    transcript?.error ?? "",
    transcript?.outputText ?? "",
    ...(transcript?.recentMessages ?? []),
  ].join("\n");
  const toolName = TOOL_BY_CASTE[input.caste];

  if (input.record.operationalFailureKind === "provider_usage_limit") {
    addUnique(
      lines,
      "Previous attempt hit a provider usage or quota limit; do not treat that as a code or contract defect.",
    );
  }

  if (input.record.failureCount > 0 || transcript) {
    addUnique(
      lines,
      `Previous ${input.caste} attempt failed; change behavior instead of repeating the same failed sequence.`,
    );
  }

  if (containsAny(transcriptText, ["missing", "no 'emit_", "tool contract violation", "Tool contract repair required"])) {
    addUnique(
      lines,
      `The prior failure missed the final artifact contract; end this attempt by calling ${toolName} exactly once with the final payload.`,
    );
  }

  if (containsAny(transcriptText, ["outside the allowed scope", "outside scope", "out-of-scope", "tool is blocking me"])) {
    if (input.caste === "titan") {
      addUnique(
        lines,
        "Do not retry out-of-scope writes; if required files are outside allowed scope, skip the check with a reason or emit a blocking mutation_proposal.",
      );
    } else if (input.caste === "sentinel") {
      addUnique(
        lines,
        "Do not edit files during review; report in-scope defects as rework_owner and true out-of-scope blockers as create_blocker.",
      );
    } else if (input.caste === "janus") {
      addUnique(
        lines,
        "Do not make broad implementation edits; route merge-boundary work through requeue_parent or create_integration_blocker.",
      );
    } else {
      addUnique(
        lines,
        "Do not expand scope during scouting; report scope risk only in the assessment artifact.",
      );
    }
  }

  if (input.caste === "titan" && input.record.failureCount > 0) {
    addUnique(
      lines,
      "Stage and commit in-scope edits before emitting the artifact; if no edits are needed, report already_satisfied with checks.",
    );
  }

  if (transcript?.error) {
    addUnique(lines, `Relevant prior error: ${compactText(transcript.error)}`);
  }

  return lines.slice(0, 6);
}
