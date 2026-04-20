import { describe, expect, it } from "vitest";

import {
  TODO_MOCK_RUN_ISSUES,
  TODO_READY_QUEUE_EXPECTATION,
} from "../../../src/mock-run/todo-manifest.js";

function findIssue(key: string) {
  const issue = TODO_MOCK_RUN_ISSUES.find((candidate) => candidate.key === key);
  if (!issue) {
    throw new Error(`Missing issue key: ${key}`);
  }
  return issue;
}

describe("todo manifest graph", () => {
  it("keeps deterministic lane parallelism and gate dependencies", () => {
    const foundationGate = findIssue("foundation.gate");
    const commandsGate = findIssue("commands.gate");
    const integrationGate = findIssue("integration.gate");

    expect(foundationGate.blocks).toEqual(["foundation.lane_a", "foundation.lane_b"]);
    expect(commandsGate.blocks).toEqual(["commands.lane_a", "commands.lane_b"]);
    expect(integrationGate.blocks).toEqual(["integration.lane_a", "integration.lane_b"]);
  });

  it("covers scaffold, dependency install, react ui, readme, and localhost serving tasks", () => {
    const searchableText = TODO_MOCK_RUN_ISSUES
      .map((issue) => `${issue.title} ${issue.description}`.toLowerCase());

    expect(searchableText.some((entry) => entry.includes("scaffold"))).toBe(true);
    expect(searchableText.some((entry) => entry.includes("install") && entry.includes("depend"))).toBe(true);
    expect(searchableText.some((entry) => entry.includes("react ui"))).toBe(true);
    expect(searchableText.some((entry) => entry.includes("readme"))).toBe(true);
    expect(searchableText.some((entry) => entry.includes("localhost"))).toBe(true);
  });

  it("starts with foundation contract as the only ready seed", () => {
    expect(TODO_READY_QUEUE_EXPECTATION).toEqual(["foundation.contract"]);
  });
});

