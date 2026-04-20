import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { CasteName } from "./caste-runtime.js";

export type SessionEventType =
  | "session_started"
  | "tool_start"
  | "assistant_message"
  | "session_finished"
  | "session_failed";

export interface SessionEventRecord {
  timestamp: string;
  sessionId: string;
  issueId: string;
  caste: CasteName;
  eventType: SessionEventType;
  summary: string;
  detail?: string;
}

function resolveSessionEventsDirectory(root: string) {
  return path.join(path.resolve(root), ".aegis", "logs", "sessions");
}

export function resolveSessionEventsPath(root: string, sessionId: string) {
  return path.join(resolveSessionEventsDirectory(root), `${sessionId}.events.jsonl`);
}

export function appendSessionEvent(root: string, event: SessionEventRecord) {
  const resolvedRoot = path.resolve(root);
  if (!existsSync(resolvedRoot)) {
    return;
  }

  const eventsPath = resolveSessionEventsPath(root, event.sessionId);
  mkdirSync(path.dirname(eventsPath), { recursive: true });
  appendFileSync(eventsPath, `${JSON.stringify(event)}\n`, "utf8");
}

export function readSessionEvents(root: string, sessionId: string): SessionEventRecord[] {
  const eventsPath = resolveSessionEventsPath(root, sessionId);
  if (!existsSync(eventsPath)) {
    return [];
  }

  return readFileSync(eventsPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as Partial<SessionEventRecord> | null;
        if (
          !parsed
          || typeof parsed !== "object"
          || typeof parsed.timestamp !== "string"
          || typeof parsed.sessionId !== "string"
          || typeof parsed.issueId !== "string"
          || typeof parsed.caste !== "string"
          || typeof parsed.eventType !== "string"
          || typeof parsed.summary !== "string"
        ) {
          return [];
        }

        return [{
          timestamp: parsed.timestamp,
          sessionId: parsed.sessionId,
          issueId: parsed.issueId,
          caste: parsed.caste as CasteName,
          eventType: parsed.eventType as SessionEventType,
          summary: parsed.summary,
          detail: typeof parsed.detail === "string" ? parsed.detail : undefined,
        }];
      } catch {
        return [];
      }
    });
}

