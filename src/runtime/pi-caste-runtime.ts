import {
  createAgentSession,
  createCodingTools,
  createReadOnlyTools,
  type AgentSessionEvent,
} from "@mariozechner/pi-coding-agent";

import type {
  CasteName,
  CasteRunInput,
  CasteRuntime,
  CasteSessionMessage,
  CasteSessionResult,
} from "./caste-runtime.js";
import type { ResolvedConfiguredCasteModel } from "./pi-model-config.js";

function extractAssistantText(event: AgentSessionEvent): string {
  if (event.type !== "message_end") {
    return "";
  }

  const message = event.message as { content?: unknown } | undefined;
  const content = message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter((part) => {
      return (
        part !== null
        && typeof part === "object"
        && "type" in part
        && (part as { type?: string }).type === "text"
      );
    })
    .map((part) => (part as { text?: string }).text ?? "")
    .join("");
}

function extractMessageRole(event: AgentSessionEvent): CasteSessionMessage["role"] | null {
  if (event.type !== "message_end") {
    return null;
  }

  const message = event.message as { role?: unknown } | undefined;
  return message?.role === "user" || message?.role === "assistant"
    ? message.role
    : null;
}

function resolveTools(caste: CasteName, workingDirectory: string) {
  if (caste === "titan") {
    return createCodingTools(workingDirectory);
  }

  return createReadOnlyTools(workingDirectory);
}

export class PiCasteRuntime implements CasteRuntime {
  constructor(
    private readonly modelConfigs: Partial<Record<CasteName, ResolvedConfiguredCasteModel>> = {},
  ) {}

  async run(input: CasteRunInput): Promise<CasteSessionResult> {
    const startedAt = new Date().toISOString();
    const modelConfig = this.modelConfigs[input.caste];
    if (!modelConfig) {
      throw new Error(`Missing configured Pi model for caste "${input.caste}".`);
    }

    const messageLog: CasteSessionMessage[] = [{
      role: "user",
      content: input.prompt,
    }];
    const { session } = await createAgentSession({
      cwd: input.workingDirectory,
      model: modelConfig.model,
      thinkingLevel: modelConfig.thinkingLevel,
      tools: resolveTools(input.caste, input.workingDirectory),
    });
    const messages: string[] = [];
    const toolsUsed: string[] = [];

    try {
      await new Promise<void>((resolve, reject) => {
        const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
          if (event.type === "tool_execution_start") {
            toolsUsed.push(event.toolName);
            return;
          }

          const text = extractAssistantText(event);
          const role = extractMessageRole(event);
          if (text.length > 0) {
            messages.push(text);
            if (role) {
              messageLog.push({
                role,
                content: text,
              });
            }
            return;
          }

          if (event.type === "agent_end") {
            unsubscribe();
            const state = session.state as { error?: string | null };
            if (state.error) {
              reject(new Error(state.error));
              return;
            }
            resolve();
          }
        });

        void session.prompt(input.prompt).catch((error: unknown) => {
          reject(error);
        });
      });

      return {
        sessionId: session.sessionId,
        caste: input.caste,
        modelRef: modelConfig.reference,
        provider: modelConfig.provider,
        modelId: modelConfig.modelId,
        thinkingLevel: modelConfig.thinkingLevel,
        status: "succeeded",
        outputText: messages.at(-1) ?? "",
        toolsUsed,
        messageLog,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        sessionId: session.sessionId,
        caste: input.caste,
        modelRef: modelConfig.reference,
        provider: modelConfig.provider,
        modelId: modelConfig.modelId,
        thinkingLevel: modelConfig.thinkingLevel,
        status: "failed",
        outputText: messages.at(-1) ?? "",
        toolsUsed,
        messageLog,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      session.dispose();
    }
  }
}
