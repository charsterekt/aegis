import type {
  AdapterCasteName,
  AdapterSessionSnapshot,
  AdapterSessionStatus,
  RuntimeAdapterContract,
} from "./adapter-contract.js";

export interface RuntimeLaunchInput {
  root: string;
  issueId: string;
  title: string;
  caste: Exclude<AdapterCasteName, "janus">;
  stage: "scouting" | "implementing" | "reviewing";
}

export interface RuntimeLaunchResult {
  sessionId: string;
  startedAt: string;
}

export interface RuntimeSessionSnapshot {
  sessionId: string;
  status: AdapterSessionStatus;
  finishedAt?: string;
  error?: string;
}

export type AgentRuntimeContractSurface = Pick<
  RuntimeAdapterContract,
  "spawn" | "abort" | "status"
>;

// Existing daemon runtime method names map to the canonical contract as:
// launch = spawn, terminate = abort, readSession = status.
export interface AgentRuntime {
  launch(input: RuntimeLaunchInput): Promise<RuntimeLaunchResult>;
  readSession(root: string, sessionId: string): Promise<RuntimeSessionSnapshot | null>;
  terminate(
    root: string,
    sessionId: string,
    reason: string,
  ): Promise<RuntimeSessionSnapshot | null>;
}

export type { AdapterSessionSnapshot };
