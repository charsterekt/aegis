import type { MvpScenarioId } from "../wire-mvp-scenarios.js";
import type { MvpScenarioRunner } from "./shared.js";

export const laneBScenarioRunners: Partial<Record<MvpScenarioId, MvpScenarioRunner>> = {};
