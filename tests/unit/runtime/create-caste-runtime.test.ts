import path from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createCasteRuntime } from "../../../src/runtime/create-caste-runtime.js";

const tempRoots: string[] = [];

function createTempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "aegis-create-caste-runtime-"));
  tempRoots.push(root);
  return root;
}

function writeConfig(root: string, overrides: Record<string, unknown> = {}) {
  const configPath = path.join(root, ".aegis", "config.json");
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    `${JSON.stringify({
      runtime: "scripted",
      models: {
        oracle: "openai-codex:gpt-5.4-mini",
        titan: "anthropic:claude-sonnet-4-20250514",
        sentinel: "openai-codex:gpt-5.4-mini",
        janus: "openai-codex:gpt-5.4-mini",
      },
      thinking: {
        oracle: "medium",
        titan: "high",
        sentinel: "medium",
        janus: "medium",
      },
      ...overrides,
    }, null, 2)}\n`,
    "utf8",
  );
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("createCasteRuntime", () => {
  it("uses the scripted runtime for deterministic proof adapters", () => {
    const createPiRuntime = vi.fn();
    const scriptedRuntime = { kind: "scripted", run: vi.fn() };
    const createScriptedRuntime = vi.fn(() => scriptedRuntime);

    const runtime = createCasteRuntime("scripted", {
      createPiRuntime,
      createScriptedRuntime,
    });

    expect(runtime).toBe(scriptedRuntime);
    expect(createScriptedRuntime).toHaveBeenCalledOnce();
    expect(createPiRuntime).not.toHaveBeenCalled();
  });

  it("uses the pi runtime when configured", () => {
    const piRuntime = { kind: "pi", run: vi.fn() };
    const createPiRuntime = vi.fn(() => piRuntime);
    const createScriptedRuntime = vi.fn();

    const runtime = createCasteRuntime("pi", {
      createPiRuntime,
      createScriptedRuntime,
    });

    expect(runtime).toBe(piRuntime);
    expect(createPiRuntime).toHaveBeenCalledOnce();
    expect(createScriptedRuntime).not.toHaveBeenCalled();
  });

  it("threads configured model and thinking metadata into the default scripted runtime", async () => {
    const root = createTempRoot();
    writeConfig(root);

    const runtime = createCasteRuntime("scripted", {}, { root, issueId: "aegis-123" });
    const result = await runtime.run({
      caste: "titan",
      issueId: "aegis-123",
      root,
      workingDirectory: path.join(root, ".aegis", "labors", "labor-aegis-123"),
      prompt: "Implement aegis-123",
    });

    expect(result).toMatchObject({
      caste: "titan",
      modelRef: "anthropic:claude-sonnet-4-20250514",
      provider: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      thinkingLevel: "high",
      messageLog: [
        {
          role: "user",
          content: "Implement aegis-123",
        },
        {
          role: "assistant",
          content: expect.stringContaining("\"outcome\":\"success\""),
        },
      ],
    });
  });
});
