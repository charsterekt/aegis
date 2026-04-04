/**
 * S05 contract seed — stats normalisation types and function signatures.
 *
 * Defines the metering and auth types from SPECv2 §8.2.2, the
 * NormalizedBudgetStatus shape, and the two public function stubs that
 * Lane B (aegis-fjm.6.3) will implement.
 *
 * Lane B contract:
 *   - normalizeStats()   maps raw AgentStats + metering context to a
 *                        NormalizedBudgetStatus suitable for budget gates.
 *   - isWithinBudget()   compares a NormalizedBudgetStatus against the
 *                        operator-configured BudgetLimit hard limits.
 *
 * Canonical rules: SPECv2 §8.2.2.
 *   - Never display fabricated dollar precision when only credits/quota/proxy
 *     usage is available.
 *   - With "unknown" metering the system must default to conservative
 *     (human-confirmation) behaviour.
 */

import type { AgentStats } from "./agent-runtime.js";
import type { BudgetLimit } from "../config/schema.js";

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

/**
 * What level of billing/usage detail the runtime exposes.
 * Canonical values: SPECv2 §8.2.2.
 */
export type MeteringCapability =
  | "exact_usd"
  | "credits"
  | "quota"
  | "stats_only"
  | "unknown";

/**
 * How the user is authenticated with the runtime provider.
 * Canonical values: SPECv2 §8.2.2.
 */
export type AuthMode =
  | "api_key"
  | "subscription"
  | "workspace_subscription"
  | "local"
  | "unknown";

// ---------------------------------------------------------------------------
// UsageObservation
// ---------------------------------------------------------------------------

/**
 * A structured snapshot of all usage signals available from the runtime at a
 * given moment.  Adapters fill in only the fields that their provider exposes;
 * absent fields must be omitted (not set to null or 0).
 *
 * Canonical shape: SPECv2 §8.2.2.
 */
export interface UsageObservation {
  provider: string;
  auth_mode: AuthMode;
  metering: MeteringCapability;

  /** Available only with exact_usd metering. */
  exact_cost_usd?: number;

  /** Available only with credits metering. */
  credits_used?: number;
  credits_remaining?: number;

  /** Available only with quota metering. */
  quota_used_pct?: number;
  quota_remaining_pct?: number;
  reset_at?: string;

  /** Always available from session-local stats. */
  input_tokens?: number;
  output_tokens?: number;
  session_turns?: number;
  wall_time_sec?: number;

  /** Context-window saturation, if the runtime exposes it. */
  active_context_pct?: number;

  /**
   * How confident the observation is.
   * - "exact"     — comes directly from a billing API
   * - "estimated" — computed by the adapter using known pricing
   * - "proxy"     — inferred from coarse signals (quota %, credit buckets)
   */
  confidence: "exact" | "estimated" | "proxy";

  /** Where the data originated. */
  source:
    | "billing_api"
    | "runtime_status"
    | "session_stats"
    | "adapter_estimate";
}

// ---------------------------------------------------------------------------
// NormalizedBudgetStatus
// ---------------------------------------------------------------------------

/**
 * The normalised view of budget consumption that the monitor uses for budget
 * gates.  It abstracts over all metering modes so the monitor never needs to
 * inspect raw adapter outputs.
 *
 * Exactly one of { exact_cost_usd, credits_used, quota_used_pct, tokens } is
 * expected to be the "primary" signal, depending on metering mode.  The
 * others may be populated as supplemental context.
 */
export interface NormalizedBudgetStatus {
  /** Source metering mode — preserved so callers can adjust display logic. */
  metering: MeteringCapability;

  /** Auth mode — preserved for Janus auto-escalation rules. */
  auth_mode: AuthMode;

  /**
   * How reliable the budget numbers are.
   * "exact"     → safe for hard-stop gates
   * "estimated" → safe for soft-warning gates
   * "proxy"     → display only; not used for automated hard stops
   */
  confidence: "exact" | "estimated" | "proxy";

  // -- Cost signals --------------------------------------------------------

  /** Dollar cost for this session; only set with exact_usd metering. */
  exact_cost_usd?: number;

  // -- Credit signals ------------------------------------------------------

  credits_used?: number;
  credits_remaining?: number;

  // -- Quota signals -------------------------------------------------------

  quota_used_pct?: number;
  quota_remaining_pct?: number;

  // -- Token/turn signals (always available) --------------------------------

  /** Sum of input + output tokens. */
  total_tokens: number;
  session_turns: number;
  wall_time_sec: number;

  // -- Context-window saturation -------------------------------------------

  active_context_pct?: number;

  /**
   * Whether any signal suggests the session is dangerously close to a limit.
   * Set by the adapter or normaliser when a BudgetWarning threshold is crossed.
   */
  budget_warning: boolean;
}

// ---------------------------------------------------------------------------
// Function signatures — Lane B implements these stubs
// ---------------------------------------------------------------------------

/**
 * Normalise raw session stats and an optional usage observation into a
 * NormalizedBudgetStatus that the monitor can act on.
 *
 * Rules:
 *   - exact_usd metering → populate exact_cost_usd, confidence = "exact"
 *   - credits metering   → populate credits_used/remaining, confidence = "proxy"
 *   - quota metering     → populate quota_used_pct/remaining_pct, confidence = "proxy"
 *   - stats_only         → populate tokens/turns only, confidence = "estimated"
 *   - unknown            → return conservative defaults, budget_warning = true
 *
 * @param raw        Live session stats from AgentHandle.getStats()
 * @param authMode   How the user is authenticated with this runtime
 * @param metering   What level of billing detail is available
 * @param obs        Optional richer usage observation from the adapter
 */
export function normalizeStats(
  raw: AgentStats,
  authMode: AuthMode,
  metering: MeteringCapability,
  obs?: UsageObservation
): NormalizedBudgetStatus {
  void raw;
  void authMode;
  void metering;
  void obs;
  throw new Error("normalizeStats: not implemented — Lane B (aegis-fjm.6.3)");
}

/**
 * Determine whether a session is still within its configured hard limits.
 *
 * Checks turn count and token count from NormalizedBudgetStatus against the
 * BudgetLimit.  For metering modes that expose cost or credits, those signals
 * are checked against the economics config thresholds (passed separately by the
 * monitor).
 *
 * Returns false (over budget) if any limit is exceeded, or if metering is
 * "unknown" and budget_warning is set.
 *
 * @param status  Normalised status from normalizeStats()
 * @param limits  Hard limits from AegisConfig.budgets[caste]
 */
export function isWithinBudget(
  status: NormalizedBudgetStatus,
  limits: BudgetLimit
): boolean {
  void status;
  void limits;
  throw new Error("isWithinBudget: not implemented — Lane B (aegis-fjm.6.3)");
}
