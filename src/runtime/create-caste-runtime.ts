import type { CasteRuntime } from "./caste-runtime.js";
import { PiCasteRuntime } from "./pi-caste-runtime.js";
import {
  createDefaultScriptedCasteRuntime,
  createScriptedModelConfigs,
} from "./scripted-caste-runtime.js";
import { loadConfig } from "../config/load-config.js";
import { createCasteConfig } from "../config/caste-config.js";
import { resolveConfiguredCasteModel } from "./pi-model-config.js";

export interface CreateCasteRuntimeOptions {
  createPiRuntime?: () => CasteRuntime;
  createScriptedRuntime?: () => CasteRuntime;
}

export interface CreateCasteRuntimeContext {
  root?: string;
  issueId?: string;
}

export function createCasteRuntime(
  runtime: string,
  options: CreateCasteRuntimeOptions = {},
  context: CreateCasteRuntimeContext = {},
): CasteRuntime {
  const config = context.root ? loadConfig(context.root) : null;
  const createPiRuntime = options.createPiRuntime ?? (() => {
    const modelConfigs = config
      ? createCasteConfig((caste) => resolveConfiguredCasteModel(config, caste))
      : {};
    return new PiCasteRuntime(modelConfigs);
  });
  const createScriptedRuntime = options.createScriptedRuntime
    ?? (() => createDefaultScriptedCasteRuntime(
      config ? createScriptedModelConfigs(config.models, config.thinking) : {},
      context.root,
      context.issueId,
    ));

  if (runtime === "pi") {
    return createPiRuntime();
  }

  return createScriptedRuntime();
}
