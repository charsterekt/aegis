import path from "node:path";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import {
  ScriptedCasteRuntime,
  createDefaultScriptedCasteRuntime,
} from "../../../src/runtime/scripted-caste-runtime.js";

const tempRoots: string[] = [];

function createTempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "aegis-scripted-runtime-"));
  tempRoots.push(root);
  return root;
}

function runGit(root: string, args: string[]) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("ScriptedCasteRuntime", () => {
  it("returns deterministic output and tool usage for the requested caste", async () => {
    const runtime = new ScriptedCasteRuntime(
      {
        oracle: {
          reference: "openai-codex:gpt-5.4-mini",
          provider: "openai-codex",
          modelId: "gpt-5.4-mini",
          thinkingLevel: "medium",
        },
      },
      {
        oracle: () => ({
          output: JSON.stringify({
            files_affected: ["src/index.ts"],
            estimated_complexity: "moderate",
            risks: [],
            suggested_checks: [],
            scope_notes: [],
          }),
          toolsUsed: ["read_file"],
        }),
      },
    );

    const result = await runtime.run({
      caste: "oracle",
      issueId: "aegis-123",
      root: "repo",
      workingDirectory: "repo",
      prompt: "prompt",
    });

    expect(result.caste).toBe("oracle");
    expect(result.status).toBe("succeeded");
    expect(result.toolsUsed).toEqual(["read_file"]);
    expect(result.outputText).toContain("\"scope_notes\":[]");
    expect(result).toMatchObject({
      modelRef: "openai-codex:gpt-5.4-mini",
      provider: "openai-codex",
      modelId: "gpt-5.4-mini",
      thinkingLevel: "medium",
      messageLog: [
        {
          role: "user",
          content: "prompt",
        },
        {
          role: "assistant",
          content: expect.stringContaining("\"scope_notes\":[]"),
        },
      ],
    });
  });

  it("can force deterministic sentinel failure for selected issues through env override", async () => {
    const previous = process.env.AEGIS_SCRIPTED_SENTINEL_FAIL_ISSUES;
    process.env.AEGIS_SCRIPTED_SENTINEL_FAIL_ISSUES = "aegis-999";

    try {
      const runtime = createDefaultScriptedCasteRuntime({
        sentinel: {
          reference: "openai-codex:gpt-5.4-mini",
          provider: "openai-codex",
          modelId: "gpt-5.4-mini",
          thinkingLevel: "medium",
        },
      });

      const result = await runtime.run({
        caste: "sentinel",
        issueId: "aegis-999",
        root: "repo",
        workingDirectory: "repo",
        prompt: "review prompt",
      });

      expect(result.status).toBe("succeeded");
      expect(result.outputText).toContain("\"verdict\":\"fail_blocking\"");
      expect(result.outputText).toContain("blockingFindings");
      expect(result.outputText).toContain("review-observability");
    } finally {
      if (previous === undefined) {
        delete process.env.AEGIS_SCRIPTED_SENTINEL_FAIL_ISSUES;
      } else {
        process.env.AEGIS_SCRIPTED_SENTINEL_FAIL_ISSUES = previous;
      }
    }
  });

  it("can force deterministic Janus recommendation through env override", async () => {
    const previous = process.env.AEGIS_SCRIPTED_JANUS_NEXT_ACTION;
    process.env.AEGIS_SCRIPTED_JANUS_NEXT_ACTION = "manual_decision";

    try {
      const runtime = createDefaultScriptedCasteRuntime({
        janus: {
          reference: "openai-codex:gpt-5.4-mini",
          provider: "openai-codex",
          modelId: "gpt-5.4-mini",
          thinkingLevel: "medium",
        },
      });

      const result = await runtime.run({
        caste: "janus",
        issueId: "aegis-janus",
        root: "repo",
        workingDirectory: "repo",
        prompt: "janus prompt",
      });

      expect(result.status).toBe("succeeded");
      expect(result.outputText).toContain("\"proposal_type\":\"create_integration_blocker\"");
    } finally {
      if (previous === undefined) {
        delete process.env.AEGIS_SCRIPTED_JANUS_NEXT_ACTION;
      } else {
        process.env.AEGIS_SCRIPTED_JANUS_NEXT_ACTION = previous;
      }
    }
  });

  it("creates a durable commit for default Titan runs inside git worktrees", async () => {
    const root = createTempRoot();
    writeFileSync(path.join(root, "README.md"), "baseline\n", "utf8");
    runGit(root, ["init"]);
    runGit(root, ["config", "user.email", "test@aegis.local"]);
    runGit(root, ["config", "user.name", "Aegis Test"]);
    runGit(root, ["add", "--all"]);
    runGit(root, ["commit", "-m", "baseline"]);
    runGit(root, ["branch", "-M", "main"]);
    runGit(root, ["checkout", "-b", "aegis/aegis-123"]);
    const baselineHead = runGit(root, ["rev-parse", "HEAD"]).trim();

    const runtime = createDefaultScriptedCasteRuntime();
    const result = await runtime.run({
      caste: "titan",
      issueId: "aegis-123",
      root,
      workingDirectory: root,
      prompt: "implement prompt",
    });

    expect(result.status).toBe("succeeded");
    expect(result.outputText).toContain("aegis-scripted-proof.txt");
    expect(readFileSync(path.join(root, "aegis-scripted-proof.txt"), "utf8")).toContain("aegis-123");
    expect(runGit(root, ["rev-parse", "HEAD"]).trim()).not.toBe(baselineHead);
  });
});
