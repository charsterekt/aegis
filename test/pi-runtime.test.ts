import { describe, it, expect, vi, beforeEach } from "vitest";

import type { AegisConfig } from "../src/types.js";

const mockSessionStats = {
  tokens: { total: 42, input: 30, output: 12, cacheRead: 0, cacheWrite: 0 },
  cost: 0.123,
  sessionFile: undefined,
  sessionId: "mock-session",
  userMessages: 1,
  assistantMessages: 1,
  toolCalls: 2,
  toolResults: 2,
  totalMessages: 4,
};

const mockSession = {
  prompt: vi.fn().mockResolvedValue(undefined),
  steer: vi.fn().mockResolvedValue(undefined),
  abort: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockReturnValue(() => {}),
  getSessionStats: vi.fn().mockReturnValue(mockSessionStats),
};

const mockCreate = vi.fn().mockResolvedValue({ session: mockSession });
const mockSMInMemory = vi.fn().mockReturnValue("in-memory-sm");
const mockSetRuntimeApiKey = vi.fn();
const mockAuthInstance = { setRuntimeApiKey: mockSetRuntimeApiKey };
const mockAuthCtor = vi.fn().mockImplementation(function () { return mockAuthInstance; });
(mockAuthCtor as unknown as Record<string, unknown>).create = vi.fn().mockReturnValue(mockAuthInstance);
const mockModelRegistryInstance = { models: [] };
const mockModelRegistryCtor = vi.fn().mockImplementation(function () { return mockModelRegistryInstance; });
const mockROTools = [{ name: "read" }];
const mockCodingTools = [{ name: "read" }, { name: "bash" }, { name: "edit" }, { name: "write" }];
const mockGetModel = vi.fn().mockReturnValue({ provider: "anthropic", id: "claude-haiku-4-5" });

vi.mock("@mariozechner/pi-coding-agent", () => ({
  createAgentSession: mockCreate,
  SessionManager: { inMemory: mockSMInMemory },
  AuthStorage: mockAuthCtor,
  ModelRegistry: mockModelRegistryCtor,
  readOnlyTools: mockROTools,
  codingTools: mockCodingTools,
}));

vi.mock("@mariozechner/pi-ai", () => ({ getModel: mockGetModel }));

const { PiRuntime, PiAgentHandle, casteToolFilter } = await import("../src/runtimes/pi-runtime.js");

const CFG: AegisConfig = {
  version: 1,
  auth: { anthropic: "sk-ant-test", openai: "sk-openai-test", google: null },
  models: {
    oracle: "claude-haiku-4-5",
    titan: "claude-sonnet-4-5",
    sentinel: "claude-opus-4-5",
    metis: "claude-haiku-4-5",
    prometheus: "claude-opus-4-5",
  },
  concurrency: { max_agents: 10, max_oracles: 3, max_titans: 3, max_sentinels: 2 },
  budgets: {
    oracle_turns: 50,
    oracle_tokens: 50000,
    titan_turns: 200,
    titan_tokens: 200000,
    sentinel_turns: 100,
    sentinel_tokens: 100000,
  },
  timing: { poll_interval_seconds: 5, stuck_warning_seconds: 90, stuck_kill_seconds: 150 },
  mnemosyne: { max_records: 500, context_budget_tokens: 4000 },
  labors: { base_path: ".aegis/labors" },
  olympus: { port: 7777, open_browser: false },
};

describe("casteToolFilter()", () => {
  it("returns readOnlyTools for oracle", () => {
    expect(casteToolFilter("oracle")).toBe(mockROTools);
  });

  it("returns readOnlyTools for sentinel", () => {
    expect(casteToolFilter("sentinel")).toBe(mockROTools);
  });

  it("returns codingTools for titan", () => {
    expect(casteToolFilter("titan")).toBe(mockCodingTools);
  });
});

describe("PiAgentHandle", () => {
  beforeEach(() => {
    mockSession.prompt.mockClear();
    mockSession.steer.mockClear();
    mockSession.abort.mockClear();
    mockSession.subscribe.mockClear();
    mockSession.getSessionStats.mockClear();
    mockSession.getSessionStats.mockReturnValue(mockSessionStats);
  });

  it("proxies prompt, steer, abort, and subscribe", async () => {
    const handle = new PiAgentHandle(mockSession as never);

    await handle.prompt("hello");
    await handle.steer("focus");
    await handle.abort();
    handle.subscribe(() => undefined);

    expect(mockSession.prompt).toHaveBeenCalledWith("hello");
    expect(mockSession.steer).toHaveBeenCalledWith("focus");
    expect(mockSession.abort).toHaveBeenCalledOnce();
    expect(mockSession.subscribe).toHaveBeenCalledOnce();
  });

  it("maps session stats to AgentStats", () => {
    const handle = new PiAgentHandle(mockSession as never);

    expect(handle.getStats()).toEqual({
      sessionId: "mock-session",
      cost: 0.123,
      tokens: {
        total: 42,
        input: 30,
        output: 12,
        cacheRead: 0,
        cacheWrite: 0,
      },
    });
  });
});

describe("PiRuntime.spawn()", () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockGetModel.mockClear();
    mockModelRegistryCtor.mockClear();
    mockSMInMemory.mockClear();
    mockSetRuntimeApiKey.mockClear();
  });

  it("creates an AgentHandle from the Pi session", async () => {
    const runtime = new PiRuntime(CFG);
    const handle = await runtime.spawn({
      caste: "oracle",
      cwd: "/repo",
      tools: mockROTools,
      systemPrompt: "SYSTEM",
      model: "claude-haiku-4-5",
    });

    expect(handle).toBeInstanceOf(PiAgentHandle);
    expect(mockCreate.mock.calls[0]?.[0]).toMatchObject({
      cwd: "/repo",
      tools: mockROTools,
      systemPrompt: "SYSTEM",
      sessionManager: "in-memory-sm",
    });
  });

  it("uses anthropic as the default provider", async () => {
    const runtime = new PiRuntime(CFG);

    await runtime.spawn({
      caste: "oracle",
      cwd: "/repo",
      tools: mockROTools,
      systemPrompt: "SYSTEM",
      model: "claude-haiku-4-5",
    });

    expect(mockGetModel).toHaveBeenCalledWith("anthropic", "claude-haiku-4-5");
  });

  it("supports provider:model names", async () => {
    const runtime = new PiRuntime(CFG);

    await runtime.spawn({
      caste: "oracle",
      cwd: "/repo",
      tools: mockROTools,
      systemPrompt: "SYSTEM",
      model: "openai:gpt-4o",
    });

    expect(mockGetModel).toHaveBeenCalledWith("openai", "gpt-4o");
  });

  it("throws when the model cannot be resolved", async () => {
    mockGetModel.mockReturnValueOnce(null);
    const runtime = new PiRuntime(CFG);

    await expect(
      runtime.spawn({
        caste: "oracle",
        cwd: "/repo",
        tools: mockROTools,
        systemPrompt: "SYSTEM",
        model: "bad-model-id",
      })
    ).rejects.toThrow("Model not found: bad-model-id");
  });

  it("creates a ModelRegistry from the auth storage and passes it to createAgentSession", async () => {
    const runtime = new PiRuntime(CFG);

    await runtime.spawn({
      caste: "oracle",
      cwd: "/repo",
      tools: mockROTools,
      systemPrompt: "SYSTEM",
      model: "claude-haiku-4-5",
    });

    expect(mockModelRegistryCtor).toHaveBeenCalledOnce();
    expect(mockModelRegistryCtor.mock.calls[0]?.[0]).toBe(mockAuthInstance);
    expect(mockCreate.mock.calls[0]?.[0].modelRegistry).toBe(mockModelRegistryInstance);
  });

  it("applies configured runtime API keys to the auth storage", async () => {
    const runtime = new PiRuntime(CFG);

    await runtime.spawn({
      caste: "oracle",
      cwd: "/repo",
      tools: mockROTools,
      systemPrompt: "SYSTEM",
      model: "claude-haiku-4-5",
    });

    expect(mockSetRuntimeApiKey).toHaveBeenCalledWith("anthropic", "sk-ant-test");
    expect(mockSetRuntimeApiKey).toHaveBeenCalledWith("openai", "sk-openai-test");
  });

  it("creates auth storage under ~/.pi/agent/auth.json", async () => {
    const runtime = new PiRuntime(CFG);

    await runtime.spawn({
      caste: "oracle",
      cwd: "/repo",
      tools: mockROTools,
      systemPrompt: "SYSTEM",
      model: "claude-haiku-4-5",
    });

    expect((mockAuthCtor as unknown as Record<string, unknown>).create).toHaveBeenCalledWith(
      expect.stringContaining(".pi\\agent\\auth.json")
    );
  });
});
