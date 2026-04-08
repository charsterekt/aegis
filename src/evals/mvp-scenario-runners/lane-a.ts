import type { MvpScenarioId } from "../wire-mvp-scenarios.js";
import type { MvpScenarioRunner } from "./shared.js";

export const laneAScenarioRunners: Partial<Record<MvpScenarioId, MvpScenarioRunner>> = {};
