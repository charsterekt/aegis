import type { Model } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { DEFAULT_AEGIS_CONFIG } from "../../../src/config/defaults.js";
import {
  resolveConfiguredCasteModel,
  verifyConfiguredPiModels,
} from "../../../src/runtime/pi-model-config.js";

function makeModel(provider: string, id: string): Model<any> {
  return { provider, id } as Model<any>;
}

function makeDeps(options: {
  authenticatedProviders?: string[];
  registeredModels?: Model<any>[];
  availableModels?: Model<any>[];
} = {}) {
  const authenticatedProviders = options.authenticatedProviders ?? ["openai-codex"];
  const registeredModels = options.registeredModels ?? [
    makeModel("openai-codex", "gpt-5.4-mini"),
  ];
  const availableModels = options.availableModels ?? registeredModels;

  return {
    authStorage: {
      list: () => authenticatedProviders,
      hasAuth: (provider: string) => authenticatedProviders.includes(provider),
    },
    modelRegistry: {
      find: (provider: string, modelId: string) =>
        registeredModels.find((model) => model.provider === provider && model.id === modelId),
      getAvailable: () => availableModels,
    },
  };
}

function makeConfig() {
  return {
    ...DEFAULT_AEGIS_CONFIG,
    runtime: "pi",
    models: {
      ...DEFAULT_AEGIS_CONFIG.models,
      titan: "openai-codex:gpt-5.4-mini",
      sentinel: "openai-codex:gpt-5.4-mini",
    },
  };
}

describe("resolveConfiguredCasteModel", () => {
  it("returns configured provider model and thinking for a caste", () => {
    const config = makeConfig();

    const resolved = resolveConfiguredCasteModel(config, "titan", makeDeps());

    expect(resolved).toMatchObject({
      caste: "titan",
      reference: "openai-codex:gpt-5.4-mini",
      provider: "openai-codex",
      modelId: "gpt-5.4-mini",
      thinkingLevel: "medium",
    });
  });

  it("fails when configured provider is not authenticated", () => {
    expect(() => resolveConfiguredCasteModel(
      makeConfig(),
      "titan",
      makeDeps({
        authenticatedProviders: ["anthropic"],
        registeredModels: [
          makeModel("openai-codex", "gpt-5.4-mini"),
          makeModel("anthropic", "claude-sonnet-4-5"),
        ],
        availableModels: [
          makeModel("openai-codex", "gpt-5.4-mini"),
          makeModel("anthropic", "claude-sonnet-4-5"),
        ],
      }),
    )).toThrow(
      'Configured provider "openai-codex" for "titan" is not authenticated. Authenticated providers: anthropic',
    );
  });
});

describe("verifyConfiguredPiModels", () => {
  it("returns authenticated provider guidance without listing full model universe", () => {
    const probe = verifyConfiguredPiModels(
      makeConfig(),
      makeDeps({
        authenticatedProviders: ["anthropic"],
        registeredModels: [makeModel("anthropic", "claude-sonnet-4-5")],
        availableModels: [makeModel("anthropic", "claude-sonnet-4-5")],
      }),
    );

    expect(probe.ok).toBe(false);
    expect(probe.detail).toContain('Configured provider "openai-codex"');
    expect(probe.detail).toContain("Authenticated providers: anthropic");
    expect(probe.detail).not.toContain("gemini");
  });
});
