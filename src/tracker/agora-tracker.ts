import { AgoraStore, type AgoraTicket } from "../../packages/agora/dist/index.js";

import type { AegisIssue, IssueStatus, WorkIssueClass } from "./issue-model.js";
import type {
  TrackerClient,
  TrackerCreateIssueInput,
  TrackerLinkInput,
  TrackerReadyIssue,
  TrackerUpdateIssueScopeInput,
} from "./tracker.js";

function hasLabel(ticket: AgoraTicket, label: string) {
  return ticket.labels.includes(label);
}

function isExecutable(ticket: AgoraTicket) {
  return !hasLabel(ticket, "role:coordination");
}

function parsePriority(ticket: AgoraTicket) {
  const priorityLabel = ticket.labels.find((label) => /^priority:\d+$/.test(label));
  if (!priorityLabel) {
    return 1;
  }

  return Number(priorityLabel.slice("priority:".length));
}

function normalizeStatus(ticket: AgoraTicket): IssueStatus {
  if (ticket.column === "done") {
    return "closed";
  }
  if (ticket.column === "blocked" || ticket.column === "halted") {
    return "blocked";
  }
  if (ticket.column === "in_progress" || ticket.column === "in_review" || ticket.column === "ready_to_merge") {
    return "in_progress";
  }

  return "open";
}

function normalizeIssueClass(ticket: AgoraTicket): WorkIssueClass {
  if (ticket.kind === "bug" || ticket.kind === "review_fix") {
    return "fix";
  }
  if (ticket.kind === "blocker") {
    return "clarification";
  }

  return "primary";
}

function toAegisIssue(ticket: AgoraTicket): AegisIssue {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.body.length > 0 ? ticket.body : null,
    issueClass: normalizeIssueClass(ticket),
    status: normalizeStatus(ticket),
    priority: parsePriority(ticket),
    blockers: [...ticket.blockedBy],
    parentId: ticket.parent,
    childIds: [...ticket.children],
    labels: [...ticket.labels],
    fileScope: [...ticket.scope],
  };
}

export class AgoraTrackerClient implements TrackerClient {
  private store(root: string) {
    return new AgoraStore({ root });
  }

  async listReadyIssues(root = process.cwd()): Promise<TrackerReadyIssue[]> {
    return this.store(root)
      .board()
      .columns.ready
      .filter((ticket) => isExecutable(ticket))
      .map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
      }));
  }

  async getIssue(id: string, root = process.cwd()): Promise<AegisIssue> {
    const ticket = this.store(root).load().tickets[id];
    if (!ticket) {
      throw new Error(`Agora ticket "${id}" was not found.`);
    }

    return toAegisIssue(ticket);
  }

  async closeIssue(id: string, root = process.cwd()): Promise<void> {
    this.store(root).moveTicket({
      ticketId: id,
      to: "done",
      actor: "aegis",
      reason: "Completed by Aegis.",
      reasonKind: "completed",
      force: true,
    });
  }

  async createIssue(
    input: TrackerCreateIssueInput,
    root = process.cwd(),
  ): Promise<string> {
    const store = this.store(root);
    const parent = input.dependencies?.[0] ?? null;
    const ticket = store.createTicket({
      title: input.title,
      body: input.description,
      kind: "blocker",
      column: "ready",
      parent,
      scope: input.fileScope ?? [],
      labels: ["aegis-created", "role:executable", "priority:1"],
      actor: "aegis",
    });

    return ticket.id;
  }

  async linkBlockingIssue(input: TrackerLinkInput, root = process.cwd()): Promise<void> {
    this.store(root).linkBlockingTicket({
      blockingTicketId: input.blockingIssueId,
      blockedTicketId: input.blockedIssueId,
      actor: "aegis",
      reason: `Aegis linked ${input.blockingIssueId} as blocker for ${input.blockedIssueId}.`,
    });
  }

  async updateIssueScope(
    input: TrackerUpdateIssueScopeInput,
    root = process.cwd(),
  ): Promise<void> {
    this.store(root).updateTicketScope({
      ticketId: input.issueId,
      scope: input.fileScope,
      actor: "aegis",
      reason: input.reason,
    });
  }
}
