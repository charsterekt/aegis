import { AgoraTrackerClient } from "./agora-tracker.js";
import { BeadsTrackerClient } from "./beads-tracker.js";
import type { AegisIssue } from "./issue-model.js";
import type { TrackerClient } from "./tracker.js";

export type TrackerBackend = "agora" | "beads";
export type DefaultTrackerClient = TrackerClient & {
  getIssue(id: string, root?: string): Promise<AegisIssue>;
};

export function resolveTrackerBackend(value = process.env.AEGIS_TRACKER_BACKEND): TrackerBackend {
  if (!value && process.env.NODE_ENV === "test") {
    return "beads";
  }

  return value === "beads" ? "beads" : "agora";
}

export function createTrackerClient(backend: TrackerBackend = resolveTrackerBackend()): DefaultTrackerClient {
  return backend === "beads"
    ? new BeadsTrackerClient()
    : new AgoraTrackerClient();
}
