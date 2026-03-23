import { mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

import { createAgentSession, SessionManager, AuthStorage, ModelRegistry, readOnlyTools, codingTools } from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";
import type { AgentSession } from "@mariozechner/pi-coding-agent";

import type {
  AgentHandle,
  AgentRuntime,
  AgentStats,
  AegisConfig,
  Caste,
  SpawnOptions,
} from "../types.js";

type CreateAgentSessionOptions = NonNullable<Parameters<typeof createAgentSession>[0]>;

function getAgentDir(): string {
  return join(homedir(), ".pi", "agent");
}

function applyWindowsSpawnFixes(): void {
  if (platform() !== "win32") return;

  try {
    mkdirSync("C:\\tmp", { recursive: true });
  } catch {
    // best-effort — if we can't create it, the downstream spawn failure should
    // surface rather than being swallowed here.
  }

  if (process.env["MSYSTEM"]) {
    process.env["SHELL"] = "cmd.exe";
    if (!process.env["COMSPEC"]) {
      process.env["COMSPEC"] = "C:\\Windows\\System32\\cmd.exe";
    }
  }
}

function makeAuthStorage(config: AegisConfig): AuthStorage {
  const authStorage = AuthStorage.create(join(getAgentDir(), "auth.json"));

  if (config.auth.anthropic) authStorage.setRuntimeApiKey("anthropic", config.auth.anthropic);
  if (config.auth.openai) authStorage.setRuntimeApiKey("openai", config.auth.openai);
  if (config.auth.google) authStorage.setRuntimeApiKey("google", config.auth.google);

  return authStorage;
}

function resolveModel(modelName: string) {
  // getModel is generic over known literal model IDs; runtime config uses strings.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getModelAny = getModel as (provider: string, id: string) => any;

  if (modelName.includes(":")) {
    const [provider = "anthropic", id = modelName] = modelName.split(":", 2);
    return getModelAny(provider, id);
  }

  return getModelAny("anthropic", modelName);
}

export function casteToolFilter(caste: Caste): typeof codingTools | typeof readOnlyTools {
  if (caste === "titan") return codingTools;
  return readOnlyTools;
}

export class PiAgentHandle implements AgentHandle {
  constructor(private readonly session: AgentSession) {}

  prompt(text: string): Promise<void> {
    return this.session.prompt(text);
  }

  steer(text: string): Promise<void> {
    return this.session.steer(text);
  }

  abort(): Promise<void> {
    return this.session.abort();
  }

  subscribe(listener: Parameters<AgentHandle["subscribe"]>[0]): ReturnType<AgentHandle["subscribe"]> {
    return this.session.subscribe((event) => listener(event));
  }

  getStats(): AgentStats {
    const stats = this.session.getSessionStats();
    return {
      sessionId: stats.sessionId,
      cost: stats.cost,
      tokens: {
        total: stats.tokens.total,
        input: stats.tokens.input,
        output: stats.tokens.output,
        cacheRead: stats.tokens.cacheRead,
        cacheWrite: stats.tokens.cacheWrite,
      },
    };
  }
}

export class PiRuntime implements AgentRuntime {
  constructor(private readonly config: AegisConfig) {}

  getTools(caste: Caste): readonly unknown[] {
    return casteToolFilter(caste);
  }

  async spawn(opts: SpawnOptions): Promise<AgentHandle> {
    applyWindowsSpawnFixes();

    const authStorage = makeAuthStorage(this.config);
    const modelRegistry = new ModelRegistry(authStorage);
    const model = resolveModel(opts.model);

    if (!model) {
      throw new Error(`Model not found: ${opts.model}`);
    }

    const { session } = await createAgentSession({
      cwd: opts.cwd,
      agentDir: getAgentDir(),
      sessionManager: SessionManager.inMemory(),
      authStorage,
      modelRegistry,
      model,
      tools: opts.tools as CreateAgentSessionOptions["tools"],
      systemPrompt: opts.systemPrompt,
    } as CreateAgentSessionOptions);

    return new PiAgentHandle(session);
  }
}
