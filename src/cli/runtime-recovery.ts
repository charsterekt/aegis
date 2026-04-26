import {
  loadDispatchState,
  reconcileDispatchState,
  saveDispatchState,
} from "../core/dispatch-state.js";
import {
  isProcessRunning,
  readRuntimeState,
  writeRuntimeState,
  type RuntimeStateRecord,
} from "./runtime-state.js";

export interface RuntimeRecoveryOptions {
  isProcessRunning?: (pid: number) => boolean;
  now?: string;
  recoveryProvenanceId?: string;
  stopReason?: string;
}

export interface RuntimeRecoveryResult {
  recovered: boolean;
  runtimeState: RuntimeStateRecord | null;
}

export function recoverStaleRuntimeState(
  root = process.cwd(),
  options: RuntimeRecoveryOptions = {},
): RuntimeRecoveryResult {
  const recoveredRuntime = readRuntimeState(root);
  if (!recoveredRuntime || recoveredRuntime.server_state === "stopped") {
    return {
      recovered: false,
      runtimeState: recoveredRuntime,
    };
  }

  const processRunning = options.isProcessRunning ?? isProcessRunning;
  if (processRunning(recoveredRuntime.pid)) {
    return {
      recovered: false,
      runtimeState: recoveredRuntime,
    };
  }

  const timestamp = options.now ?? new Date().toISOString();
  const stoppedRuntime: RuntimeStateRecord = {
    ...recoveredRuntime,
    server_state: "stopped",
    stopped_at: timestamp,
    last_stop_reason: options.stopReason ?? "stale_pid",
  };
  writeRuntimeState(stoppedRuntime, root);

  const recoveryProvenanceId =
    options.recoveryProvenanceId ?? `stale-runtime-${recoveredRuntime.pid}`;
  const dispatchState = loadDispatchState(root);
  saveDispatchState(
    root,
    reconcileDispatchState(dispatchState, recoveryProvenanceId, timestamp),
  );

  return {
    recovered: true,
    runtimeState: stoppedRuntime,
  };
}
