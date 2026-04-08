import type { Fixture } from "../fixture-schema.js";
import type { EvalRunResult, EvalScenario } from "../result-schema.js";

export interface ScenarioExecutionContext {
  scenario: EvalScenario;
  fixture: Fixture;
  projectRoot: string;
  aegisRoot: string;
  aegisVersion: string;
  gitSha: string;
  configFingerprint: string;
  runtime: string;
  modelMapping: Record<string, string>;
  startedAt: Date;
  startedAtIso: string;
}

export type MvpScenarioRunner = (
  context: ScenarioExecutionContext,
) => Promise<EvalRunResult>;
