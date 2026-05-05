import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { AgoraStore } from "../../../packages/agora/src/index.js";
import { AgoraTrackerClient } from "../../../src/tracker/agora-tracker.js";

const tempRoots: string[] = [];

function createRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "aegis-agora-tracker-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("AgoraTrackerClient", () => {
  it("lists ready executable tickets in tracker order", async () => {
    const root = createRoot();
    const store = new AgoraStore({ root });
    store.createTicket({
      title: "Coordination epic",
      body: "Not runnable.",
      column: "ready",
      labels: ["mock-run", "role:coordination"],
      actor: "seed",
    });
    const first = store.createTicket({
      title: "First executable",
      body: "Run first.",
      column: "ready",
      labels: ["mock-run", "role:executable"],
      actor: "seed",
    });
    const second = store.createTicket({
      title: "Second executable",
      body: "Run second.",
      column: "ready",
      labels: ["mock-run", "role:executable"],
      actor: "seed",
    });
    store.createTicket({
      title: "Blocked executable",
      body: "Wait.",
      column: "blocked",
      labels: ["mock-run", "role:executable"],
      actor: "seed",
      blockedBy: [first.id],
    });

    await expect(new AgoraTrackerClient().listReadyIssues(root)).resolves.toEqual([
      { id: first.id, title: "First executable" },
      { id: second.id, title: "Second executable" },
    ]);
  });

  it("maps Agora tickets into the generic Aegis issue model", async () => {
    const root = createRoot();
    const store = new AgoraStore({ root });
    const parent = store.createTicket({
      title: "Parent",
      body: "Parent body.",
      column: "backlog",
      actor: "seed",
    });
    const blocker = store.createTicket({
      title: "Blocker",
      body: "Blocker body.",
      column: "done",
      actor: "seed",
    });
    const issue = store.createTicket({
      title: "Child",
      body: "Child body.",
      kind: "bug",
      column: "blocked",
      parent: parent.id,
      blockedBy: [blocker.id],
      labels: ["mock-run", "role:executable", "priority:2"],
      scope: ["src/App.tsx"],
      actor: "seed",
    });

    await expect(new AgoraTrackerClient().getIssue(issue.id, root)).resolves.toEqual({
      id: issue.id,
      title: "Child",
      description: "Child body.",
      issueClass: "fix",
      status: "blocked",
      priority: 2,
      blockers: [blocker.id],
      parentId: parent.id,
      childIds: [],
      labels: ["mock-run", "priority:2", "role:executable"],
      fileScope: ["src/App.tsx"],
    });
  });

  it("closes, creates, and links tickets through AgoraStore", async () => {
    const root = createRoot();
    const tracker = new AgoraTrackerClient();
    const store = new AgoraStore({ root });
    const parent = store.createTicket({
      title: "Parent work",
      body: "Needs child.",
      column: "ready",
      labels: ["mock-run", "role:executable"],
      actor: "seed",
    });

    const childId = await tracker.createIssue({
      title: "Blocking child",
      description: "Resolve missing prerequisite.",
      dependencies: [parent.id],
      fileScope: ["src/App.tsx"],
    }, root);
    await tracker.updateIssueScope({
      issueId: childId,
      fileScope: ["src/App.tsx", "src/main.tsx"],
      reason: "Expand child scope.",
    }, root);
    await tracker.linkBlockingIssue({
      blockingIssueId: childId,
      blockedIssueId: parent.id,
    }, root);
    await tracker.closeIssue(childId, root);

    const tickets = new AgoraStore({ root }).load().tickets;
    expect(tickets[childId]?.column).toBe("done");
    expect(tickets[childId]?.scope).toEqual(["src/App.tsx", "src/main.tsx"]);
    expect(tickets[parent.id]?.blockedBy).toEqual([childId]);
    expect(tickets[childId]?.blocks).toEqual([parent.id]);
  });
});
