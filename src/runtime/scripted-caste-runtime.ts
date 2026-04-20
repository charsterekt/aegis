import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  CasteName,
  CasteRunInput,
  CasteRuntime,
  CasteSessionResult,
} from "./caste-runtime.js";
import type { AegisThinkingLevel } from "../config/schema.js";
import { appendSessionEvent } from "./session-events.js";

type ScriptedResponse = {
  output: string;
  toolsUsed?: string[];
  error?: string;
};

type ScriptedHandlers = Partial<Record<CasteName, (input: CasteRunInput) => ScriptedResponse>>;
type ScriptedModelConfig = {
  reference: string;
  provider: string;
  modelId: string;
  thinkingLevel: AegisThinkingLevel;
};
type ScriptedModelConfigs = Partial<Record<CasteName, ScriptedModelConfig>>;

function isScriptedHandlers(
  value: ScriptedModelConfigs | ScriptedHandlers,
): value is ScriptedHandlers {
  return Object.values(value).every((entry) => entry === undefined || typeof entry === "function");
}

function writeSessionEventSafe(
  root: string,
  event: Parameters<typeof appendSessionEvent>[1],
) {
  try {
    appendSessionEvent(root, event);
  } catch {
    // Session event logging must not block scripted runtime behavior.
  }
}

function writeProjectFile(root: string, relativePath: string, contents: string) {
  const targetPath = path.join(root, relativePath);
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, contents.endsWith("\n") ? contents : `${contents}\n`, "utf8");
}

function materializeMockReactTodoApp(root: string) {
  const packageJson = {
    name: "aegis-mock-run-todo",
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
    },
    devDependencies: {
      "@types/react": "^18.3.8",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.1",
      typescript: "^5.6.3",
      vite: "^5.4.10",
    },
  };

  writeProjectFile(root, "package.json", JSON.stringify(packageJson, null, 2));
  writeProjectFile(root, "index.html", [
    "<!doctype html>",
    "<html lang=\"en\">",
    "  <head>",
    "    <meta charset=\"UTF-8\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
    "    <title>Aegis Todo</title>",
    "  </head>",
    "  <body>",
    "    <div id=\"root\"></div>",
    "    <script type=\"module\" src=\"/src/main.tsx\"></script>",
    "  </body>",
    "</html>",
  ].join("\n"));
  writeProjectFile(root, "tsconfig.json", JSON.stringify({
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: ["vite/client"],
    },
    include: ["src"],
  }, null, 2));
  writeProjectFile(root, "vite.config.ts", [
    "import { defineConfig } from \"vite\";",
    "import react from \"@vitejs/plugin-react\";",
    "",
    "export default defineConfig({",
    "  plugins: [react()],",
    "});",
  ].join("\n"));
  writeProjectFile(root, "src/main.tsx", [
    "import React from \"react\";",
    "import ReactDOM from \"react-dom/client\";",
    "import App from \"./App\";",
    "import \"./styles.css\";",
    "",
    "ReactDOM.createRoot(document.getElementById(\"root\")!).render(",
    "  <React.StrictMode>",
    "    <App />",
    "  </React.StrictMode>,",
    ");",
  ].join("\n"));
  writeProjectFile(root, "src/App.tsx", [
    "import { useMemo, useState } from \"react\";",
    "",
    "type TodoItem = {",
    "  id: string;",
    "  title: string;",
    "  completed: boolean;",
    "};",
    "",
    "const STORAGE_KEY = \"aegis-mock-todos\";",
    "",
    "function readInitialTodos(): TodoItem[] {",
    "  try {",
    "    const raw = window.localStorage.getItem(STORAGE_KEY);",
    "    if (!raw) return [];",
    "    const parsed = JSON.parse(raw) as TodoItem[];",
    "    return Array.isArray(parsed) ? parsed : [];",
    "  } catch {",
    "    return [];",
    "  }",
    "}",
    "",
    "export default function App() {",
    "  const [draft, setDraft] = useState(\"\");",
    "  const [todos, setTodos] = useState<TodoItem[]>(() => readInitialTodos());",
    "",
    "  const pendingCount = useMemo(",
    "    () => todos.filter((todo) => !todo.completed).length,",
    "    [todos],",
    "  );",
    "",
    "  const persist = (nextTodos: TodoItem[]) => {",
    "    setTodos(nextTodos);",
    "    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTodos));",
    "  };",
    "",
    "  const addTodo = () => {",
    "    const title = draft.trim();",
    "    if (!title) return;",
    "    persist([",
    "      ...todos,",
    "      { id: crypto.randomUUID(), title, completed: false },",
    "    ]);",
    "    setDraft(\"\");",
    "  };",
    "",
    "  const toggleTodo = (id: string) => {",
    "    persist(",
    "      todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)),",
    "    );",
    "  };",
    "",
    "  return (",
    "    <main className=\"app\">",
    "      <section className=\"card\">",
    "        <h1>Aegis Todo</h1>",
    "        <p>{pendingCount} pending task(s)</p>",
    "        <div className=\"composer\">",
    "          <input",
    "            value={draft}",
    "            onChange={(event) => setDraft(event.target.value)}",
    "            placeholder=\"Add a todo\"",
    "          />",
    "          <button type=\"button\" onClick={addTodo}>",
    "            Add",
    "          </button>",
    "        </div>",
    "        <ul>",
    "          {todos.map((todo) => (",
    "            <li key={todo.id}>",
    "              <label>",
    "                <input",
    "                  type=\"checkbox\"",
    "                  checked={todo.completed}",
    "                  onChange={() => toggleTodo(todo.id)}",
    "                />",
    "                <span className={todo.completed ? \"done\" : \"\"}>{todo.title}</span>",
    "              </label>",
    "            </li>",
    "          ))}",
    "        </ul>",
    "      </section>",
    "    </main>",
    "  );",
    "}",
  ].join("\n"));
  writeProjectFile(root, "src/styles.css", [
    ":root {",
    "  font-family: \"Segoe UI\", sans-serif;",
    "  color: #121826;",
    "  background: linear-gradient(135deg, #fef9f4, #f2f7ff);",
    "}",
    "",
    "body {",
    "  margin: 0;",
    "}",
    "",
    ".app {",
    "  min-height: 100vh;",
    "  display: grid;",
    "  place-items: center;",
    "  padding: 24px;",
    "}",
    "",
    ".card {",
    "  width: min(560px, 100%);",
    "  background: white;",
    "  border-radius: 16px;",
    "  padding: 24px;",
    "  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);",
    "}",
    "",
    ".composer {",
    "  display: flex;",
    "  gap: 12px;",
    "  margin-bottom: 16px;",
    "}",
    "",
    "input[type=\"text\"], .composer input {",
    "  flex: 1;",
    "  border: 1px solid #d7deea;",
    "  border-radius: 8px;",
    "  padding: 10px 12px;",
    "}",
    "",
    "button {",
    "  border: none;",
    "  border-radius: 8px;",
    "  padding: 10px 14px;",
    "  background: #0d9488;",
    "  color: white;",
    "  font-weight: 600;",
    "  cursor: pointer;",
    "}",
    "",
    "ul {",
    "  list-style: none;",
    "  padding: 0;",
    "  margin: 0;",
    "  display: grid;",
    "  gap: 8px;",
    "}",
    "",
    "li {",
    "  background: #f8fafc;",
    "  border-radius: 8px;",
    "  padding: 10px 12px;",
    "}",
    "",
    ".done {",
    "  text-decoration: line-through;",
    "  color: #64748b;",
    "}",
  ].join("\n"));
  writeProjectFile(root, "README.md", [
    "# Aegis Mock Todo App",
    "",
    "This workspace is generated by Aegis mock-run acceptance flow.",
    "",
    "## Run locally",
    "",
    "```bash",
    "npm install",
    "npm run dev",
    "```",
    "",
    "Then open localhost URL shown by Vite (typically http://localhost:5173).",
  ].join("\n"));
}

export class ScriptedCasteRuntime implements CasteRuntime {
  private readonly modelConfigs: ScriptedModelConfigs;
  private readonly handlers: ScriptedHandlers;

  constructor(
    modelConfigsOrHandlers: ScriptedModelConfigs | ScriptedHandlers = {},
    handlers: ScriptedHandlers = {},
  ) {
    if (isScriptedHandlers(modelConfigsOrHandlers)) {
      this.modelConfigs = {};
      this.handlers = modelConfigsOrHandlers;
      return;
    }

    this.modelConfigs = modelConfigsOrHandlers;
    this.handlers = handlers;
  }

  async run(input: CasteRunInput): Promise<CasteSessionResult> {
    const sessionId = randomUUID();
    const startedAt = new Date().toISOString();
    writeSessionEventSafe(input.root, {
      timestamp: startedAt,
      sessionId,
      issueId: input.issueId,
      caste: input.caste,
      eventType: "session_started",
      summary: "Scripted session started",
    });
    const response = this.handlers[input.caste]?.(input) ?? {
      output: "{}",
      toolsUsed: [],
    };
    const finishedAt = new Date().toISOString();
    const modelConfig = this.modelConfigs[input.caste] ?? {
      reference: "scripted:deterministic",
      provider: "scripted",
      modelId: "deterministic",
      thinkingLevel: "off" as const,
    };

    if (response.output.trim().length > 0) {
      writeSessionEventSafe(input.root, {
        timestamp: finishedAt,
        sessionId,
        issueId: input.issueId,
        caste: input.caste,
        eventType: "assistant_message",
        summary: response.output.slice(0, 160),
      });
    }

    writeSessionEventSafe(input.root, {
      timestamp: finishedAt,
      sessionId,
      issueId: input.issueId,
      caste: input.caste,
      eventType: response.error ? "session_failed" : "session_finished",
      summary: response.error ? "Scripted session failed" : "Scripted session finished",
      detail: response.error,
    });

    return {
      sessionId,
      caste: input.caste,
      modelRef: modelConfig.reference,
      provider: modelConfig.provider,
      modelId: modelConfig.modelId,
      thinkingLevel: modelConfig.thinkingLevel,
      status: response.error ? "failed" : "succeeded",
      outputText: response.output,
      toolsUsed: response.toolsUsed ?? [],
      messageLog: [
        {
          role: "user",
          content: input.prompt,
        },
        {
          role: "assistant",
          content: response.output,
        },
      ],
      startedAt,
      finishedAt,
      ...(response.error ? { error: response.error } : {}),
    };
  }
}

function parseConfiguredModel(
  reference: string,
  thinkingLevel: AegisThinkingLevel,
): ScriptedModelConfig {
  const separatorIndex = reference.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === reference.length - 1) {
    return {
      reference,
      provider: "unknown",
      modelId: "unknown",
      thinkingLevel,
    };
  }

  return {
    reference,
    provider: reference.slice(0, separatorIndex),
    modelId: reference.slice(separatorIndex + 1),
    thinkingLevel,
  };
}

function parseForcedIssueSet(value: string | undefined) {
  if (!value || value.trim().length === 0) {
    return new Set<string>();
  }

  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function parseForcedJanusAction(value: string | undefined): "requeue" | "manual_decision" | "fail" {
  if (value === "manual_decision" || value === "fail" || value === "requeue") {
    return value;
  }

  return "requeue";
}

export function createScriptedModelConfigs(
  configuredModels: Record<CasteName, string>,
  thinkingLevels: Record<CasteName, AegisThinkingLevel>,
): ScriptedModelConfigs {
  return {
    oracle: parseConfiguredModel(configuredModels.oracle, thinkingLevels.oracle),
    titan: parseConfiguredModel(configuredModels.titan, thinkingLevels.titan),
    sentinel: parseConfiguredModel(configuredModels.sentinel, thinkingLevels.sentinel),
    janus: parseConfiguredModel(configuredModels.janus, thinkingLevels.janus),
  };
}

export function createDefaultScriptedCasteRuntime(
  modelConfigs: ScriptedModelConfigs = {},
  root = process.cwd(),
  issueId = "issue",
): CasteRuntime {
  const forcedSentinelFailures = parseForcedIssueSet(process.env.AEGIS_SCRIPTED_SENTINEL_FAIL_ISSUES);
  const forcedJanusAction = parseForcedJanusAction(process.env.AEGIS_SCRIPTED_JANUS_NEXT_ACTION);

  return new ScriptedCasteRuntime(modelConfigs, {
    oracle: () => ({
      output: JSON.stringify({
        files_affected: [],
        estimated_complexity: "moderate",
        decompose: false,
        ready: true,
      }),
      toolsUsed: ["read_file"],
    }),
    titan: () => ({
      output: (() => {
        materializeMockReactTodoApp(root);
        return JSON.stringify({
          outcome: "success",
          summary: "deterministic scripted implementation",
          files_changed: [
            "package.json",
            "README.md",
            "index.html",
            "vite.config.ts",
            "tsconfig.json",
            "src/main.tsx",
            "src/App.tsx",
            "src/styles.css",
          ],
          tests_and_checks_run: [],
          known_risks: [],
          follow_up_work: [],
          learnings_written_to_mnemosyne: [],
        });
      })(),
      toolsUsed: ["write_file"],
    }),
    sentinel: (input) => {
      if (forcedSentinelFailures.has("*") || forcedSentinelFailures.has(input.issueId)) {
        return {
          output: JSON.stringify({
            verdict: "fail",
            reviewSummary: "deterministic scripted review failure",
            issuesFound: [
              "add missing sentinel regression coverage",
            ],
            followUpIssueIds: [],
            riskAreas: ["review-observability"],
          }),
          toolsUsed: ["read_file"],
        };
      }

      return {
        output: JSON.stringify({
          verdict: "pass",
          reviewSummary: "deterministic scripted review",
          issuesFound: [],
          followUpIssueIds: [],
          riskAreas: [],
        }),
        toolsUsed: ["read_file"],
      };
    },
    janus: () => ({
      output: JSON.stringify({
        originatingIssueId: issueId,
        queueItemId: `queue-${issueId}`,
        preservedLaborPath: root,
        conflictSummary: "deterministic scripted resolution",
        resolutionStrategy: "no-op scripted handoff",
        filesTouched: [],
        validationsRun: [],
        residualRisks: [],
        recommendedNextAction: forcedJanusAction,
      }),
      toolsUsed: ["read_file"],
    }),
  });
}
