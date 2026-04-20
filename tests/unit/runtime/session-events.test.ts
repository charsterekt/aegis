import path from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  appendSessionEvent,
  readSessionEvents,
  resolveSessionEventsPath,
} from "../../../src/runtime/session-events.js";

const tempRoots: string[] = [];

function createTempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "aegis-session-events-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("session-events", () => {
  it("appends and reads session events in write order", () => {
    const root = createTempRoot();
    appendSessionEvent(root, {
      timestamp: "2026-04-20T12:00:00.000Z",
      sessionId: "session-1",
      issueId: "aegis-1",
      caste: "oracle",
      eventType: "session_started",
      summary: "Oracle session started",
    });
    appendSessionEvent(root, {
      timestamp: "2026-04-20T12:00:01.000Z",
      sessionId: "session-1",
      issueId: "aegis-1",
      caste: "oracle",
      eventType: "assistant_message",
      summary: "Assessment emitted",
    });

    const events = readSessionEvents(root, "session-1");
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.eventType)).toEqual([
      "session_started",
      "assistant_message",
    ]);
  });

  it("returns empty array when events file is missing", () => {
    const root = createTempRoot();
    expect(readSessionEvents(root, "missing-session")).toEqual([]);
  });

  it("ignores malformed jsonl lines", () => {
    const root = createTempRoot();
    const eventsPath = resolveSessionEventsPath(root, "session-1");
    mkdirSync(path.dirname(eventsPath), { recursive: true });
    writeFileSync(
      eventsPath,
      `not-json\n${JSON.stringify({
        timestamp: "2026-04-20T12:00:02.000Z",
        sessionId: "session-1",
        issueId: "aegis-1",
        caste: "oracle",
        eventType: "session_finished",
        summary: "done",
      })}\n`,
      "utf8",
    );

    const events = readSessionEvents(root, "session-1");
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("session_finished");
  });
});
