import type { Model } from "@mariozechner/pi-ai";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";

import { CASTE_CONFIG_KEYS, type CasteConfigKey } from "../config/caste-config.js";
import type { AegisConfig } from "../config/schema.js";
import type { StartupPreflightProbeResult } from "../cli/startup-preflight.js";

type AuthStorageLike = Pick<AuthStorage, "hasAuth" | "list">;
type ModelRegistryLike = Pick<ModelRegistry, "find" | "getAvailable">;

export interface PiModelConfigDeps {
  authStorage: AuthStorageLike;
  modelRegistry: ModelRegistryLike;
}

export interface ResolvedConfiguredCasteModel {
  caste: CasteConfigKey;
  reference: string;
  provider: string;
  modelId: string;
  thinkingLevel: AegisConfig["thinking"][CasteConfigKey];
  model: Model<any>;
}

function createDeps(): PiModelConfigDeps {
  const authStorage = AuthStorage.create();
  return {
    authStorage,
    modelRegistry: ModelRegistry.create(authStorage),
  };
}

function parseModelReference(caste: CasteConfigKey, reference: string) {
  const separatorIndex = reference.indexOf(":");

  if (separatorIndex <= 0 || separatorIndex === reference.length - 1) {
    throw new Error(
      `Invalid configured model for "${caste}": expected "<provider>:<model-id>" but got "${reference}"`,
    );
  }

  return {
    provider: reference.slice(0, separatorIndex),
    modelId: reference.slice(separatorIndex + 1),
  };
}

function listAuthenticatedProviders(
  authStorage: AuthStorageLike,
) {
  return [...new Set(authStorage.list())].sort();
}

export function resolveConfiguredCasteModel(
  config: AegisConfig,
  caste: CasteConfigKey,
  deps?: PiModelConfigDeps,
): ResolvedConfiguredCasteModel {
  const resolvedDeps = deps ?? createDeps();
  const reference = config.models[caste];
  const { provider, modelId } = parseModelReference(caste, reference);
  const availableModels = resolvedDeps.modelRegistry.getAvailable();
  const authenticatedProviders = listAuthenticatedProviders(resolvedDeps.authStorage);

  if (!resolvedDeps.authStorage.hasAuth(provider)) {
    const providers = authenticatedProviders.join(", ") || "none";
    throw new Error(
      `Configured provider "${provider}" for "${caste}" is not authenticated. Authenticated providers: ${providers}`,
    );
  }

  const registeredModel = resolvedDeps.modelRegistry.find(provider, modelId);
  if (!registeredModel) {
    throw new Error(
      `Configured model "${reference}" for "${caste}" was not found for provider "${provider}".`,
    );
  }

  const availableModel = availableModels.find((model) =>
    model.provider === provider && model.id === modelId);

  if (!availableModel) {
    throw new Error(
      `Configured model "${reference}" for "${caste}" is not available from authenticated provider "${provider}".`,
    );
  }

  return {
    caste,
    reference,
    provider,
    modelId,
    thinkingLevel: config.thinking[caste],
    model: availableModel,
  };
}

export function verifyConfiguredPiModels(
  config: AegisConfig,
  deps?: PiModelConfigDeps,
): StartupPreflightProbeResult {
  if (config.runtime !== "pi") {
    return {
      ok: true,
      detail: `Runtime "${config.runtime}" does not require Pi model validation.`,
    };
  }

  const resolvedDeps = deps ?? createDeps();

  try {
    for (const caste of CASTE_CONFIG_KEYS) {
      resolveConfiguredCasteModel(config, caste, resolvedDeps);
    }

    return {
      ok: true,
      detail: "Configured model refs are valid for authenticated providers.",
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      fix: "authenticate the configured provider or update `.aegis/config.json` to an available provider:model pair",
    };
  }
}
