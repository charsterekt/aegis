import { randomUUID } from "node:crypto";

import type {
  AgentRuntime,
  RuntimeLaunchInput,
  RuntimeLaunchResult,
} from "./agent-runtime.js";
import { readSessionReport, writeSessionReport } from "./session-report.js";

export class ScriptedAgentRuntime implements AgentRuntime {
  async launch(input: RuntimeLaunchInput): Promise<RuntimeLaunchResult> {
    const sessionId = randomUUID();
    const startedAt = new Date().toISOString();

    void input;
    writeSessionReport(input.root, {
      sessionId,
      status: "succeeded",
      finishedAt: startedAt,
    });

    return {
      sessionId,
      startedAt,
    };
  }

  async readSession(root: string, sessionId: string) {
    return readSessionReport(root, sessionId);
  }

  async terminate(root: string, sessionId: string, reason: string) {
    const finishedAt = new Date().toISOString();
    const snapshot = {
      sessionId,
      status: "failed" as const,
      finishedAt,
      error: reason,
    };

    writeSessionReport(root, snapshot);
    return snapshot;
  }
}

class UnsupportedPiDispatchRuntime implements AgentRuntime {
  async launch(_input: RuntimeLaunchInput): Promise<RuntimeLaunchResult> {
    throw new Error(
      "Provider-backed dispatch runtime is not implemented. Use `scripted` for deterministic loop tests.",
    );
  }

  async readSession() {
    return null;
  }

  async terminate(_root: string, sessionId: string, reason: string) {
    return {
      sessionId,
      status: "failed" as const,
      finishedAt: new Date().toISOString(),
      error: reason,
    };
  }
}

export function createAgentRuntime(runtime: string): AgentRuntime {
  if (runtime === "scripted") {
    return new ScriptedAgentRuntime();
  }

  if (runtime === "pi") {
    return new UnsupportedPiDispatchRuntime();
  }

  throw new Error(`Unsupported runtime adapter: ${runtime}`);
}
