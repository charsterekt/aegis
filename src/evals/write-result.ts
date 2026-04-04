/**
 * Result persistence scaffold — S02 contract seed.
 *
 * This file defines the public interface for writing and reading eval run
 * artifacts.  The implementation is intentionally left as a "not implemented"
 * stub so that lane A can fill it in without merge conflicts.
 *
 * Output directory rules (SPECv2 §24.5):
 *   - Results live under `<resultsPath>/<scenario_id>/<run_timestamp>.json`
 *   - `resultsPath` defaults to `.aegis/evals` (EVALS_RESULTS_PATH)
 *   - Lane A must create the directory tree if it does not exist
 *   - Files must be valid JSON and human-readable (pretty-printed)
 *
 * DO NOT add implementation logic here — this is contract-only.
 */

import type { EvalRunResult } from "./result-schema.js";
import { EVALS_RESULTS_PATH } from "./result-schema.js";

export { EVALS_RESULTS_PATH };

// ---------------------------------------------------------------------------
// Write stub — lane A will implement this
// ---------------------------------------------------------------------------

/**
 * Write a completed eval run result to the results directory.
 *
 * The artifact is written to:
 *   `<resultsPath>/<scenario_id>/<run_timestamp>.json`
 *
 * where `run_timestamp` is derived from `result.timing.started_at` formatted
 * as a safe filesystem string (e.g. `2026-04-04T18-00-00.000Z`).
 *
 * @param result      The completed eval run result to persist.
 * @param resultsPath Absolute or repo-relative path to the results root.
 *                    Defaults to EVALS_RESULTS_PATH (".aegis/evals").
 * @returns           The absolute path of the file that was written.
 *
 * @throws {Error} "Not implemented" until lane A fills in the body.
 */
export async function writeResult(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _result: EvalRunResult,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _resultsPath: string = EVALS_RESULTS_PATH,
): Promise<string> {
  throw new Error("Not implemented: writeResult — lane A will implement this");
}

// ---------------------------------------------------------------------------
// Read stub — lane A will implement this
// ---------------------------------------------------------------------------

/**
 * Read a previously-written eval run result from disk.
 *
 * @param filePath Absolute path to the result JSON file.
 * @returns        The parsed EvalRunResult.
 *
 * @throws {Error} "Not implemented" until lane A fills in the body.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function readResult(_filePath: string): Promise<EvalRunResult> {
  throw new Error("Not implemented: readResult — lane A will implement this");
}
