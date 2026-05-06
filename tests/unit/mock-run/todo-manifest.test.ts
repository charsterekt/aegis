import { describe, expect, it } from "vitest";

import { formatMockRunIssueDescription } from "../../../src/mock-run/seed-mock-run.js";
import { TODO_MOCK_RUN_ISSUES, TODO_READY_QUEUE_EXPECTATION } from "../../../src/mock-run/todo-manifest.js";
import type { MockRunIssueDefinition } from "../../../src/mock-run/types.js";

function fileScopeOf(issue: MockRunIssueDefinition) {
  return (issue as MockRunIssueDefinition & { fileScope?: string[] }).fileScope ?? [];
}

describe("TODO_MOCK_RUN_ISSUES", () => {
  it("keeps the live proof graph small enough for local models while preserving product scope", () => {
    const executableIssues = TODO_MOCK_RUN_ISSUES.filter((issue) => issue.queueRole === "executable");

    expect(executableIssues).toHaveLength(8);
    expect(executableIssues.map((issue) => issue.key)).toEqual([
      "foundation.app",
      "core.todo",
      "ui.components",
      "motion.polish",
      "app.integration",
      "release.smoke",
      "janus.integration",
      "release.final",
    ]);
  });

  it("starts with product-building lanes instead of standalone contract documents", () => {
    expect(TODO_READY_QUEUE_EXPECTATION).toEqual(["foundation.app"]);

    for (const key of TODO_READY_QUEUE_EXPECTATION) {
      const issue = TODO_MOCK_RUN_ISSUES.find((candidate) => candidate.key === key)!;
      expect(issue.fileScope?.some((file) => file.startsWith("docs/"))).toBe(false);
      expect(issue.description.toLowerCase()).toContain("todo");
    }
  });

  it("retains a Janus integration lane in the drained product proof", () => {
    const janusIssue = TODO_MOCK_RUN_ISSUES.find((issue) => issue.key === "janus.integration")!;

    expect(janusIssue.description).toContain("Janus");
    expect(janusIssue.blocks).toEqual(["app.integration"]);
    expect(janusIssue.fileScope).toEqual(["README.md"]);
  });

  it("declares explicit file ownership for every executable issue", () => {
    const executableIssues = TODO_MOCK_RUN_ISSUES.filter((issue) => issue.queueRole === "executable");

    expect(executableIssues).not.toHaveLength(0);
    for (const issue of executableIssues) {
      expect(fileScopeOf(issue), issue.key).not.toHaveLength(0);
    }
  });

  it("keeps parallel executable lane ownership disjoint", () => {
    const grouped = new Map<string, MockRunIssueDefinition[]>();
    for (const issue of TODO_MOCK_RUN_ISSUES.filter((candidate) => candidate.queueRole === "executable")) {
      const key = `${issue.parentKey ?? "_root"}::${issue.blocks.slice().sort().join("|")}`;
      grouped.set(key, [...(grouped.get(key) ?? []), issue]);
    }

    for (const issues of grouped.values()) {
      if (issues.length < 2) {
        continue;
      }
      const ownerByFile = new Map<string, string>();
      for (const issue of issues) {
        for (const file of fileScopeOf(issue)) {
          expect(ownerByFile.get(file), `${file} is shared by ${ownerByFile.get(file)} and ${issue.key}`).toBeUndefined();
          ownerByFile.set(file, issue.key);
        }
      }
    }
  });

  it("formats file ownership into the seeded issue description", () => {
    const issue = {
      ...TODO_MOCK_RUN_ISSUES.find((candidate) => candidate.key === "foundation.app")!,
      fileScope: ["package.json"],
    };

    expect(formatMockRunIssueDescription(issue)).toContain(
      "Aegis file ownership: package.json",
    );
  });

  it("keeps product implementation ordered before release verification", () => {
    const byKey = new Map(TODO_MOCK_RUN_ISSUES.map((issue) => [issue.key, issue]));

    expect(byKey.get("core.todo")?.blocks).toEqual(["foundation.app"]);
    expect(byKey.get("ui.components")?.blocks).toEqual(["core.todo"]);
    expect(byKey.get("motion.polish")?.blocks).toEqual(["core.todo"]);
    expect(byKey.get("app.integration")?.blocks).toEqual(["ui.components", "motion.polish"]);
    expect(byKey.get("release.smoke")?.blocks).toEqual(["app.integration"]);
    expect(byKey.get("janus.integration")?.blocks).toEqual(["app.integration"]);
    expect(byKey.get("release.final")?.blocks).toEqual(["release.smoke", "janus.integration"]);
  });

  it("keeps product UI requirements free of orchestration vocabulary", () => {
    const forbiddenProductTerms = [
      "React + TypeScript App Shell",
      "Workspace",
      "Motion gate",
      "Motion proof",
      "lane mounted",
      "proof lane",
      "setup shell",
    ];
    const productIssues = TODO_MOCK_RUN_ISSUES.filter((issue) => issue.queueRole === "executable");

    for (const issue of productIssues) {
      for (const term of forbiddenProductTerms) {
        expect(issue.description, `${issue.key} leaked ${term}`).not.toContain(term);
      }
    }
  });

  it("requires a product-first todo app rather than proof scaffolding", () => {
    const ui = TODO_MOCK_RUN_ISSUES.find((issue) => issue.key === "ui.components")!;
    const motion = TODO_MOCK_RUN_ISSUES.find((issue) => issue.key === "motion.polish")!;
    const releaseFinal = TODO_MOCK_RUN_ISSUES.find((issue) => issue.key === "release.final")!;

    expect(ui.description).toContain("first viewport");
    expect(ui.description).toContain("Ban visible orchestration words");
    expect(ui.description).toContain("Todo app");
    expect(motion.description).toContain("observable add, complete, delete transitions");
    expect(releaseFinal.description).toContain("no visible orchestration vocabulary");
    expect(releaseFinal.description).toContain("Playwright");
  });

  it("lists blockers before dependents for deterministic seeding", () => {
    const seen = new Set<string>();

    for (const issue of TODO_MOCK_RUN_ISSUES) {
      for (const blocker of issue.blocks) {
        expect(seen.has(blocker), `${issue.key} references later blocker ${blocker}`).toBe(true);
      }
      seen.add(issue.key);
    }
  });
});
