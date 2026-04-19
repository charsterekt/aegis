import type { AgentSessionEvent, ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { TObject } from "@sinclair/typebox";

interface StructuredToolContractOptions<TArtifact> {
  toolName: string;
  label: string;
  description: string;
  parameters: TObject;
  detailsKey: string;
  successText: string;
  invalidPayloadError: string;
  parse: (raw: string) => TArtifact;
}

interface RecordLike {
  [key: string]: unknown;
}

export interface StructuredToolContract<TArtifact> {
  toolName: string;
  createTool(): ToolDefinition;
  extractFromToolEvent(event: AgentSessionEvent): TArtifact | null;
  enforcePayloadContract(payload: unknown): unknown | undefined;
  stringify(value: TArtifact): string;
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStructuredValue<TArtifact>(
  value: unknown,
  parse: (raw: string) => TArtifact,
): TArtifact | null {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    return null;
  }

  try {
    return parse(serialized);
  } catch {
    return null;
  }
}

function hasResponsesToolOutput(items: unknown): boolean {
  if (!Array.isArray(items)) {
    return false;
  }

  return items.some((item) => isRecord(item) && item["type"] === "function_call_output");
}

function hasChatToolResultMessages(messages: unknown): boolean {
  if (!Array.isArray(messages)) {
    return false;
  }

  return messages.some((message) => {
    if (!isRecord(message)) {
      return false;
    }

    return message["role"] === "tool" || message["role"] === "toolResult";
  });
}

function enforceFunctionToolPayloadContract(
  payload: unknown,
  toolName: string,
): unknown | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const hasToolPayload =
    Array.isArray(payload["tools"])
    || "tool_choice" in payload
    || "parallel_tool_calls" in payload;
  if (!hasToolPayload) {
    return undefined;
  }

  const alreadyHasToolResult =
    hasResponsesToolOutput(payload["input"])
    || hasChatToolResultMessages(payload["messages"]);
  if (alreadyHasToolResult) {
    return undefined;
  }

  return {
    ...payload,
    tool_choice: {
      type: "function",
      name: toolName,
    },
    parallel_tool_calls: false,
  };
}

export function createStructuredToolContract<TArtifact>(
  options: StructuredToolContractOptions<TArtifact>,
): StructuredToolContract<TArtifact> {
  return {
    toolName: options.toolName,
    createTool() {
      return {
        name: options.toolName,
        label: options.label,
        description: options.description,
        parameters: options.parameters,
        async execute(_toolCallId, params) {
          const parsed = parseStructuredValue(params, options.parse);
          if (!parsed) {
            throw new Error(options.invalidPayloadError);
          }

          return {
            content: [{
              type: "text",
              text: options.successText,
            }],
            details: {
              [options.detailsKey]: parsed,
            },
          };
        },
      };
    },
    extractFromToolEvent(event: AgentSessionEvent): TArtifact | null {
      if (
        event.type !== "tool_execution_end"
        || event.toolName !== options.toolName
        || event.isError
      ) {
        return null;
      }

      if (!isRecord(event.result)) {
        return null;
      }

      const details = event.result.details;
      if (!isRecord(details) || !(options.detailsKey in details)) {
        return null;
      }

      return parseStructuredValue(details[options.detailsKey], options.parse);
    },
    enforcePayloadContract(payload: unknown): unknown | undefined {
      return enforceFunctionToolPayloadContract(payload, options.toolName);
    },
    stringify(value: TArtifact): string {
      return JSON.stringify(value);
    },
  };
}
