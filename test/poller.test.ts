// test/poller.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BeadsIssue, AgentState } from "../src/types.js";

// Mock the beads module BEFORE importing poller
vi.mock("../src/beads.js", () => ({
  ready: vi.fn(),
}));

// Dynamic import after mock is set up
const { poll, diff } = await import("../src/poller.js");
const beadsMock = await import("../src/beads.js");

function makeIssue(id: string): BeadsIssue {
  return {
    id,
    title: `Issue ${id}`,
    description: "",
    type: "task",
    priority: 0,
    status: "ready",
    comments: [],
  };
}

function makeAgentState(issueId: string): AgentState {
  return {
    id: `agent-${issueId}`,
    caste: "titan",
    issue_id: issueId,
    issue_title: `Issue ${issueId}`,
    model: "claude-sonnet-4-5",
    turns: 0,
    max_turns: 100,
    tokens: 0,
    max_tokens: 200000,
    cost_usd: 0,
    started_at: Date.now(),
    last_tool_call_at: Date.now(),
    status: "running",
    labor_path: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// poll()
// ---------------------------------------------------------------------------
describe("poll()", () => {
  it("calls beads.ready() and returns the result", async () => {
    const issues = [makeIssue("aegis-001"), makeIssue("aegis-002")];
    vi.mocked(beadsMock.ready).mockResolvedValueOnce(issues);

    const result = await poll();

    expect(beadsMock.ready).toHaveBeenCalledOnce();
    expect(result).toEqual(issues);
  });

  it("returns empty array when beads.ready() returns empty", async () => {
    vi.mocked(beadsMock.ready).mockResolvedValueOnce([]);

    const result = await poll();

    expect(result).toEqual([]);
  });

  it("propagates errors from beads.ready()", async () => {
    vi.mocked(beadsMock.ready).mockRejectedValueOnce(new Error("bd CLI not found"));

    await expect(poll()).rejects.toThrow("bd CLI not found");
  });
});

// ---------------------------------------------------------------------------
// diff()
// ---------------------------------------------------------------------------
describe("diff()", () => {
  it("returns all issues when no agents are running", () => {
    const ready = [makeIssue("aegis-001"), makeIssue("aegis-002")];
    const running = new Map<string, AgentState>();

    const result = diff(ready, running);

    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(["aegis-001", "aegis-002"]);
  });

  it("returns issues not present in the running agents map", () => {
    const ready = [makeIssue("aegis-001"), makeIssue("aegis-002"), makeIssue("aegis-003")];
    const running = new Map<string, AgentState>([
      ["aegis-002", makeAgentState("aegis-002")],
    ]);

    const result = diff(ready, running);

    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toContain("aegis-001");
    expect(result.map((i) => i.id)).toContain("aegis-003");
    expect(result.map((i) => i.id)).not.toContain("aegis-002");
  });

  it("returns empty array when all ready issues are already running", () => {
    const ready = [makeIssue("aegis-001"), makeIssue("aegis-002")];
    const running = new Map<string, AgentState>([
      ["aegis-001", makeAgentState("aegis-001")],
      ["aegis-002", makeAgentState("aegis-002")],
    ]);

    const result = diff(ready, running);

    expect(result).toHaveLength(0);
  });

  it("matches issues by issue ID correctly", () => {
    const ready = [makeIssue("aegis-xyz")];
    // Different ID in running — should NOT filter out aegis-xyz
    const running = new Map<string, AgentState>([
      ["aegis-abc", makeAgentState("aegis-abc")],
    ]);

    const result = diff(ready, running);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("aegis-xyz");
  });

  it("returns empty array when ready list is empty", () => {
    const running = new Map<string, AgentState>([
      ["aegis-001", makeAgentState("aegis-001")],
    ]);

    const result = diff([], running);

    expect(result).toHaveLength(0);
  });

  it("does not mutate the ready array", () => {
    const ready = [makeIssue("aegis-001"), makeIssue("aegis-002")];
    const running = new Map<string, AgentState>([
      ["aegis-001", makeAgentState("aegis-001")],
    ]);

    diff(ready, running);

    expect(ready).toHaveLength(2);
  });
});
