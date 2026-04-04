/**
 * Scenario runner scaffold — S02 contract seed.
 *
 * This file defines the public interface for running an eval scenario.
 * The implementation is intentionally left as a "not implemented" stub so
 * that lane A can fill it in without merge conflicts.
 *
 * DO NOT add implementation logic here — this is contract-only.
 */

import type { EvalRunResult, EvalScenario } from "./result-schema.js";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RunScenarioOptions {
  /** The scenario definition to run. */
  scenario: EvalScenario;
  /**
   * Absolute path to the project root (repository) the scenario should run
   * against.  Lane A will clone or set up the fixture repo here.
   */
  projectRoot: string;
  /**
   * Absolute path to the Aegis binary or entry point to invoke.
   * Defaults to the current process when undefined.
   */
  aegisBin?: string;
  /**
   * Whether to capture verbose output from the Aegis process.
   * Defaults to false.
   */
  verbose?: boolean;
  /**
   * Maximum wall-clock milliseconds before the runner forcibly terminates the
   * scenario.  Defaults to 30 minutes (1_800_000 ms).
   */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Stub — lane A will implement this
// ---------------------------------------------------------------------------

/**
 * Run a single eval scenario and return the canonical result artifact.
 *
 * @throws {Error} "Not implemented" until lane A fills in the body.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function runScenario(_options: RunScenarioOptions): Promise<EvalRunResult> {
  throw new Error("Not implemented: runScenario — lane A will implement this");
}
