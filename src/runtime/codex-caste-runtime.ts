import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

import type {
  CasteName,
  CasteRunInput,
  CasteRuntime,
  CasteSessionResult,
} from "./caste-runtime.js";
import type { AegisThinkingLevel } from "../config/schema.js";
import { createCasteConfig, type CasteConfigRecord } from "../config/caste-config.js";

interface CodexModelConfig {
  reference: string;
  provider: string;
  modelId: string;
  thinkingLevel: AegisThinkingLevel;
}

interface CodexRunRequest {
  cwd: string;
  modelId: string;
  thinkingLevel: AegisThinkingLevel;
  prompt: string;
  outputPath: string;
  timeoutMs: number;
}

interface CodexRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface CodexCasteRuntimeOptions {
  sessionTimeoutMs?: number;
  runner?: (request: CodexRunRequest) => Promise<CodexRunResult>;
}

const DEFAULT_CODEX_SESSION_TIMEOUT_MS = 1_800_000;

function parseModelReference(reference: string, thinkingLevel: AegisThinkingLevel): CodexModelConfig {
  const separator = reference.indexOf(":");
  if (separator === -1) {
    return {
      reference,
      provider: "openai-codex",
      modelId: reference,
      thinkingLevel,
    };
  }

  return {
    reference,
    provider: reference.slice(0, separator),
    modelId: reference.slice(separator + 1),
    thinkingLevel,
  };
}

function defaultModelConfigs() {
  return createCasteConfig(() => ({
    reference: "openai-codex:gpt-5.4-mini",
    provider: "openai-codex",
    modelId: "gpt-5.4-mini",
    thinkingLevel: "medium" as const,
  }));
}

function quotePowerShellString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function resolveCodexSandboxMode(platform: NodeJS.Platform) {
  return platform === "win32" ? "danger-full-access" : "workspace-write";
}

function normalizeProcessPath(candidate: string, platform: NodeJS.Platform) {
  const normalized = path.resolve(candidate).replace(/\\/g, "/");
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function commandLineReferencesWorkspace(
  commandLine: string,
  workingDirectory: string,
  platform: NodeJS.Platform = process.platform,
) {
  const normalizedCommand = commandLine.replace(/\\/g, "/");
  const comparableCommand = platform === "win32"
    ? normalizedCommand.toLowerCase()
    : normalizedCommand;
  const workspace = normalizeProcessPath(workingDirectory, platform);
  return comparableCommand.includes(`${workspace}/`) || comparableCommand.includes(workspace);
}

export function buildTerminateWorkspaceProcessesScript(workingDirectory: string) {
  const workspace = normalizeProcessPath(workingDirectory, "win32");
  const rawWorkspace = path.resolve(workingDirectory);
  return [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `$workspace = ${JSON.stringify(workspace)}`,
    `$rawWorkspace = ${JSON.stringify(rawWorkspace)}`,
    "$current = $PID",
    "Get-CimInstance Win32_Process | Where-Object {",
    "  $_.ProcessId -ne $current -and $_.CommandLine -and (",
    "    $_.CommandLine.ToLowerInvariant().Contains($rawWorkspace.ToLowerInvariant()) -or",
    "    $_.CommandLine.Replace('\\','/').ToLowerInvariant().Contains($workspace)",
    "  )",
    "} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
  ].join("\n");
}

function terminateProcessTree(pid: number) {
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.on("error", () => undefined);
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // Ignore missing process group.
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Ignore missing process.
  }
}

function terminateWorkspaceProcesses(
  workingDirectory: string,
  platform: NodeJS.Platform = process.platform,
) {
  if (platform === "win32") {
    spawnSync("powershell.exe", ["-NoProfile", "-Command", buildTerminateWorkspaceProcessesScript(workingDirectory)], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  const ps = spawnSync("ps", ["-eo", "pid=,command="], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (ps.status !== 0) {
    return;
  }
  for (const line of ps.stdout.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) {
      continue;
    }
    const pid = Number(match[1]);
    const commandLine = match[2] ?? "";
    if (pid > 0 && pid !== process.pid && commandLineReferencesWorkspace(commandLine, workingDirectory, platform)) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Ignore missing process.
      }
    }
  }
}

export function buildCodexExecArgs(
  request: CodexRunRequest,
  platform: NodeJS.Platform = process.platform,
): string[] {
  return [
    "-C",
    request.cwd,
    "-s",
    resolveCodexSandboxMode(platform),
    "-a",
    "never",
    "-m",
    request.modelId,
    "-c",
    `model_reasoning_effort="${request.thinkingLevel}"`,
    "exec",
    "--json",
    "--output-last-message",
    request.outputPath,
    "-",
  ];
}

export function buildCodexSpawnInvocation(
  codexArgs: string[],
  platform: NodeJS.Platform = process.platform,
) {
  if (platform === "win32") {
    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `& 'codex.cmd' ${codexArgs.map(quotePowerShellString).join(" ")}; exit $LASTEXITCODE`,
      ],
    };
  }

  return {
    command: "codex",
    args: codexArgs,
  };
}

function runCodexExec(request: CodexRunRequest): Promise<CodexRunResult> {
  return new Promise((resolve) => {
    const invocation = buildCodexSpawnInvocation(buildCodexExecArgs(request));
    const child = spawn(invocation.command, invocation.args, {
      cwd: request.cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const cleanup = () => {
      terminateWorkspaceProcesses(request.cwd);
    };
    const timeout = setTimeout(() => {
      if (typeof child.pid === "number") {
        terminateProcessTree(child.pid);
      } else {
        child.kill("SIGKILL");
      }
      cleanup();
    }, request.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      cleanup();
      resolve({
        exitCode: 1,
        stdout,
        stderr: `${stderr}${stderr.length > 0 ? "\n" : ""}${error.message}`,
      });
    });
    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      cleanup();
      resolve({ exitCode, stdout, stderr });
    });
    child.stdin.end(request.prompt);
  });
}

export class CodexCasteRuntime implements CasteRuntime {
  private readonly modelConfigs: CasteConfigRecord<CodexModelConfig>;
  private readonly sessionTimeoutMs: number;
  private readonly runner: (request: CodexRunRequest) => Promise<CodexRunResult>;

  constructor(
    modelConfigs: Partial<CasteConfigRecord<CodexModelConfig>> = {},
    options: CodexCasteRuntimeOptions = {},
  ) {
    this.modelConfigs = {
      ...defaultModelConfigs(),
      ...modelConfigs,
    };
    this.sessionTimeoutMs = options.sessionTimeoutMs ?? DEFAULT_CODEX_SESSION_TIMEOUT_MS;
    this.runner = options.runner ?? runCodexExec;
  }

  async run(input: CasteRunInput): Promise<CasteSessionResult> {
    const sessionId = randomUUID();
    const startedAt = new Date().toISOString();
    const modelConfig = this.modelConfigs[input.caste];
    const outputDirectory = path.join(tmpdir(), "aegis-codex-runtime");
    mkdirSync(outputDirectory, { recursive: true });
    const outputPath = path.join(outputDirectory, `${sessionId}.txt`);
    writeFileSync(outputPath, "", "utf8");

    const result = await this.runner({
      cwd: input.workingDirectory,
      modelId: modelConfig.modelId,
      thinkingLevel: modelConfig.thinkingLevel,
      prompt: input.prompt,
      outputPath,
      timeoutMs: this.sessionTimeoutMs,
    });
    const finishedAt = new Date().toISOString();
    const outputText = readFileSync(outputPath, "utf8").trim();
    rmSync(outputPath, { force: true });
    const error = result.exitCode === 0
      ? undefined
      : [result.stderr.trim(), result.stdout.trim()].filter((chunk) => chunk.length > 0).join("\n");

    return {
      sessionId,
      caste: input.caste,
      modelRef: modelConfig.reference,
      provider: modelConfig.provider,
      modelId: modelConfig.modelId,
      thinkingLevel: modelConfig.thinkingLevel,
      status: result.exitCode === 0 ? "succeeded" : "failed",
      outputText,
      toolsUsed: ["codex exec"],
      messageLog: [
        {
          role: "user",
          content: input.prompt,
        },
        {
          role: "assistant",
          content: outputText,
        },
      ],
      startedAt,
      finishedAt,
      ...(error ? { error } : {}),
    };
  }
}

export function createCodexModelConfigs(
  models: CasteConfigRecord<string>,
  thinking: CasteConfigRecord<AegisThinkingLevel>,
) {
  return createCasteConfig((caste: CasteName) => parseModelReference(models[caste], thinking[caste]));
}
