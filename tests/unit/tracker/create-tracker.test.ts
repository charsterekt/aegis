import { describe, expect, it } from "vitest";

import { AgoraTrackerClient } from "../../../src/tracker/agora-tracker.js";
import { createTrackerClient, resolveTrackerBackend } from "../../../src/tracker/create-tracker.js";

describe("createTrackerClient", () => {
  it("always resolves the Agora tracker backend", () => {
    expect(resolveTrackerBackend()).toBe("agora");
  });

  it("creates an Agora tracker client", () => {
    expect(createTrackerClient()).toBeInstanceOf(AgoraTrackerClient);
  });
});
