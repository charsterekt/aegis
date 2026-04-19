import { describe, expect, it } from "vitest";

import { DEFAULT_AEGIS_CONFIG } from "../../../src/config/defaults.js";
import type { DispatchRecord, DispatchState } from "../../../src/core/dispatch-state.js";
import { triageReadyWork } from "../../../src/core/triage.js";

function createRecord(overrides: Partial<DispatchRecord>): DispatchRecord {
  return {
    issueId: "ISSUE",
    stage: "pending",
    runningAgent: null,
    oracleAssessmentRef: null,
    titanHandoffRef: null,
    titanClarificationRef: null,
    sentinelVerdictRef: null,
    janusArtifactRef: null,
    failureTranscriptRef: null,
    fileScope: null,
    failureCount: 0,
    consecutiveFailures: 0,
    failureWindowStartMs: null,
    cooldownUntil: null,
    sessionProvenanceId: "daemon-1",
    updatedAt: "2026-04-19T12:00:00.000Z",
    ...overrides,
  };
}

function createState(records: DispatchState["records"]): DispatchState {
  return {
    schemaVersion: 1,
    records,
  };
}

describe("parallel lane scheduling", () => {
  it("dispatches two independent scouted lanes to titan when capacity allows", () => {
    const result = triageReadyWork({
      readyIssues: [
        { id: "foundation.lane_a", title: "[foundation] Lane A" },
        { id: "foundation.lane_b", title: "[foundation] Lane B" },
      ],
      dispatchState: createState({
        "foundation.lane_a": createRecord({
          issueId: "foundation.lane_a",
          stage: "scouted",
          oracleAssessmentRef: ".aegis/oracle/foundation.lane_a.json",
        }),
        "foundation.lane_b": createRecord({
          issueId: "foundation.lane_b",
          stage: "scouted",
          oracleAssessmentRef: ".aegis/oracle/foundation.lane_b.json",
        }),
      }),
      config: {
        ...DEFAULT_AEGIS_CONFIG,
        concurrency: {
          ...DEFAULT_AEGIS_CONFIG.concurrency,
          max_agents: 4,
          max_titans: 2,
        },
      },
      now: "2026-04-19T12:00:00.000Z",
    });

    expect(result.dispatchable).toEqual([
      {
        issueId: "foundation.lane_a",
        title: "[foundation] Lane A",
        caste: "titan",
        stage: "implementing",
      },
      {
        issueId: "foundation.lane_b",
        title: "[foundation] Lane B",
        caste: "titan",
        stage: "implementing",
      },
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("keeps gate out of dispatch until tracker marks prerequisites done", () => {
    const config = {
      ...DEFAULT_AEGIS_CONFIG,
      concurrency: {
        ...DEFAULT_AEGIS_CONFIG.concurrency,
        max_agents: 4,
        max_titans: 2,
      },
    };

    const blockedGate = triageReadyWork({
      readyIssues: [
        { id: "foundation.lane_a", title: "[foundation] Lane A" },
        { id: "foundation.lane_b", title: "[foundation] Lane B" },
      ],
      dispatchState: createState({
        "foundation.lane_a": createRecord({
          issueId: "foundation.lane_a",
          stage: "scouted",
        }),
        "foundation.lane_b": createRecord({
          issueId: "foundation.lane_b",
          stage: "scouted",
        }),
        "foundation.gate": createRecord({
          issueId: "foundation.gate",
          stage: "pending",
        }),
      }),
      config,
      now: "2026-04-19T12:00:00.000Z",
    });

    expect(blockedGate.dispatchable.some((item) => item.issueId === "foundation.gate")).toBe(false);

    const unblockedGate = triageReadyWork({
      readyIssues: [{ id: "foundation.gate", title: "[foundation] Gate" }],
      dispatchState: blockedGate.dispatchable.reduce<DispatchState>((state, item) => ({
        schemaVersion: state.schemaVersion,
        records: {
          ...state.records,
          [item.issueId]: createRecord({
            issueId: item.issueId,
            stage: "implemented",
          }),
        },
      }), createState({
        "foundation.gate": createRecord({
          issueId: "foundation.gate",
          stage: "pending",
        }),
      })),
      config,
      now: "2026-04-19T12:05:00.000Z",
    });

    expect(unblockedGate.dispatchable).toEqual([
      {
        issueId: "foundation.gate",
        title: "[foundation] Gate",
        caste: "oracle",
        stage: "scouting",
      },
    ]);
  });
});
