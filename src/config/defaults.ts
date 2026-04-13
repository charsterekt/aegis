import type { AegisConfig } from "./schema.js";

export const DEFAULT_AEGIS_CONFIG: AegisConfig = {
  runtime: "pi",
  models: {
    oracle: "pi:default",
    titan: "pi:default",
    sentinel: "pi:default",
    janus: "pi:default",
  },
  concurrency: {
    max_agents: 3,
    max_oracles: 1,
    max_titans: 1,
    max_sentinels: 1,
    max_janus: 1,
  },
  thresholds: {
    poll_interval_seconds: 5,
    stuck_warning_seconds: 90,
    stuck_kill_seconds: 150,
    allow_complex_auto_dispatch: false,
    scope_overlap_threshold: 0,
    janus_retry_threshold: 2,
  },
  janus: {
    enabled: true,
    max_invocations_per_issue: 1,
  },
  labor: {
    base_path: ".aegis/labors",
  },
};
