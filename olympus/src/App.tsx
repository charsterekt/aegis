import { useState, useCallback, useEffect } from "react";
import type { JSX } from "react";
import { useSse } from "./lib/use-sse";
import type { SteerResult } from "./lib/use-sse";
import { injectGlobalStyles } from "./theme/global.css";
import { TopBar } from "./components/top-bar";
import { SettingsPanel } from "./components/settings-panel";
import { AgentGrid } from "./components/agent-grid";
import { CommandBar } from "./components/command-bar";
import { LoopPanel } from "./components/loop-panel";
import type { CommandResult } from "./components/command-bar";
import type { DashboardState } from "./types/dashboard-state";
import type { LoopPhaseLogs, LoopState } from "./components/loop-panel";

// Inject global styles on first render
injectGlobalStyles();

/** Auto-dismiss delay for error result cards (ms). */
const ERROR_DISMISS_MS = 5000;

function readCommandStatus(result: SteerResult): string | undefined {
  if (typeof result.status === "string") {
    return result.status;
  }

  const rawStatus = result.raw?.status;
  return typeof rawStatus === "string" ? rawStatus : undefined;
}

function isHandledResult(result: SteerResult): boolean {
  const status = readCommandStatus(result);
  return result.ok && (status === undefined || status === "handled");
}

function resultMessageOrFallback(result: SteerResult, fallback: string): string {
  return result.message?.trim() ? result.message : fallback;
}

function deriveLoopState(state: DashboardState | null): LoopState {
  if (!state?.status.isRunning) {
    return "idle";
  }

  if (state.status.paused) {
    return "paused";
  }

  return "running";
}

const EMPTY_PHASE_LOGS: LoopPhaseLogs = {
  poll: [],
  dispatch: [],
  monitor: [],
  reap: [],
};

export function App(): JSX.Element {
  const { state, isConnected, error, sendCommand } = useSse();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandResults, setCommandResults] = useState<CommandResult[]>([]);

  /** Auto-dismiss the oldest error card after a timeout. */
  useEffect(() => {
    const hasError = commandResults.some((r) => !r.success);
    if (!hasError) return;
    const timer = setTimeout(() => {
      setCommandResults((prev) => prev.filter((r) => r.success));
    }, ERROR_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [commandResults]);

  const recordCommandResult = useCallback((result: CommandResult) => {
    setCommandResults((prev) => [...prev, result]);
  }, []);

  const handleKill = useCallback(
    async (agentId: string) => {
      try {
        const result = await sendCommand("kill", { agentId });
        recordCommandResult({
          command: `kill ${agentId}`,
          success: true,
          result: resultMessageOrFallback(result, `Agent ${agentId} kill signal sent`),
          timestamp: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        recordCommandResult({
          command: `kill ${agentId}`,
          success: false,
          error: msg,
          timestamp: Date.now(),
        });
      }
    },
    [recordCommandResult, sendCommand],
  );

  const handleCommand = useCallback(
    async (command: string, payload?: Record<string, unknown>) => {
      try {
        const result: SteerResult = await sendCommand(command, payload);
        if (!isHandledResult(result)) {
          throw new Error(resultMessageOrFallback(result, `Command "${command}" was not accepted.`));
        }
        recordCommandResult({
          command,
          success: true,
          result: resultMessageOrFallback(result, "OK"),
          timestamp: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        recordCommandResult({
          command,
          success: false,
          error: msg,
          timestamp: Date.now(),
        });
      }
    },
    [recordCommandResult, sendCommand],
  );

  const runLoopCommand = useCallback(
    async (command: string, successFallback: string) => {
      try {
        const result: SteerResult = await sendCommand(command);
        if (!isHandledResult(result)) {
          throw new Error(resultMessageOrFallback(result, successFallback));
        }

        recordCommandResult({
          command,
          success: true,
          result: resultMessageOrFallback(result, successFallback),
          timestamp: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        recordCommandResult({
          command,
          success: false,
          error: msg,
          timestamp: Date.now(),
        });
      }
    },
    [recordCommandResult, sendCommand],
  );

  return (
    <div className="app">
      <TopBar
        state={state}
        isConnected={isConnected}
        onSettingsOpen={() => setSettingsOpen(true)}
      />

      {settingsOpen && (
        <SettingsPanel
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {error && (
        <div data-testid="error-banner" role="alert" className="error-banner">
          {error}
        </div>
      )}

      <main data-testid="app-main" className="app-main">
        <LoopPanel
          loopState={deriveLoopState(state)}
          phaseLogs={EMPTY_PHASE_LOGS}
          onStart={() => runLoopCommand("auto_on", "Aegis loop started")}
          onPause={() => runLoopCommand("pause", "Aegis loop paused")}
          onResume={() => runLoopCommand("resume", "Aegis loop resumed")}
          onStop={() => runLoopCommand("stop", "Aegis loop stopped")}
          disabled={!isConnected}
        />

        <AgentGrid
          agents={state?.agents ?? []}
          onKill={handleKill}
        />

        <CommandBar
          onCommand={handleCommand}
          onKill={handleKill}
          disabled={!isConnected}
        />

        {commandResults.length > 0 && (
          <section data-testid="command-results" aria-label="Command Results">
            {commandResults.map((r, i) => (
              <div key={i} className={`command-result ${r.success ? "success" : "error"}`}>
                <code>{r.command}</code>
                {r.success ? (
                  <span className="success">{r.result}</span>
                ) : (
                  <span className="error">{r.error}</span>
                )}
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
