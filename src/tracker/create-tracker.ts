import { AgoraTrackerClient } from "./agora-tracker.js";
import type { AegisIssue } from "./issue-model.js";
import type { TrackerClient } from "./tracker.js";

export type TrackerBackend = "agora";
export type DefaultTrackerClient = TrackerClient & {
  getIssue(id: string, root?: string): Promise<AegisIssue>;
};

export function resolveTrackerBackend(value = process.env.AEGIS_TRACKER_BACKEND): TrackerBackend {
  void value;
  return "agora";
}

export function createTrackerClient(backend: TrackerBackend = resolveTrackerBackend()): DefaultTrackerClient {
  void backend;
  return new AgoraTrackerClient();
}
