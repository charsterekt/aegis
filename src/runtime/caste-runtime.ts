import type { AegisThinkingLevel } from "../config/schema.js";

export type CasteName = "oracle" | "titan" | "sentinel" | "janus";

export interface CasteSessionMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CasteRunInput {
  caste: CasteName;
  issueId: string;
  root: string;
  workingDirectory: string;
  prompt: string;
}

export interface CasteSessionResult {
  sessionId: string;
  caste: CasteName;
  modelRef: string;
  provider: string;
  modelId: string;
  thinkingLevel: AegisThinkingLevel;
  status: "succeeded" | "failed";
  outputText: string;
  toolsUsed: string[];
  messageLog: CasteSessionMessage[];
  startedAt: string;
  finishedAt: string;
  error?: string;
}

export interface CasteRuntime {
  run(input: CasteRunInput): Promise<CasteSessionResult>;
}
