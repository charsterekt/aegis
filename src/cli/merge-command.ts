import { runMergeNext } from "../merge/merge-next.js";
import { isProcessRunning, readRuntimeState, type RuntimeStateRecord } from "./runtime-state.js";
import {
  requestMergeCommandFromDaemon,
  type RuntimeMergeAction,
} from "./runtime-command.js";

export interface RunDirectMergeCommandOptions {
  readRuntimeState?: (root?: string) => RuntimeStateRecord | null;
  isProcessRunning?: (pid: number) => boolean;
  runLocal?: (root: string, action: RuntimeMergeAction) => Promise<unknown>;
  routeToDaemon?: (root: string, action: RuntimeMergeAction, targetPid: number) => Promise<unknown>;
}

function isDaemonOwned(
  runtimeState: RuntimeStateRecord | null,
  processRunning: (pid: number) => boolean,
) {
  return runtimeState !== null
    && runtimeState.server_state === "running"
    && processRunning(runtimeState.pid);
}

export async function runDirectMergeCommand(
  root: string,
  action: RuntimeMergeAction,
  options: RunDirectMergeCommandOptions = {},
) {
  const readRuntime = options.readRuntimeState ?? readRuntimeState;
  const processRunning = options.isProcessRunning ?? isProcessRunning;
  const runLocal = options.runLocal ?? ((candidateRoot: string, candidateAction: RuntimeMergeAction) =>
    candidateAction === "next" ? runMergeNext(candidateRoot) : Promise.resolve(null));
  const routeToDaemon = options.routeToDaemon ?? requestMergeCommandFromDaemon;
  const runtimeState = readRuntime(root);

  if (runtimeState && isDaemonOwned(runtimeState, processRunning)) {
    return routeToDaemon(root, action, runtimeState.pid);
  }

  return runLocal(root, action);
}

export function formatMergeCommandResult(result: unknown) {
  return JSON.stringify(result);
}
