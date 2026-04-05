/**
 * Fresh-ready auto-loop contract for S07.
 *
 * Auto mode may only process work that became ready after auto was enabled.
 * Lane B will own the actual polling/dispatch loop; this module provides the
 * time-based gate used to keep that loop deterministic.
 */

export interface AutoLoopState {
  enabledAt: string | null;
}

export interface ReadyIssueObservation {
  id: string;
  readyAt: string;
}

export function createAutoLoopState(): AutoLoopState {
  return {
    enabledAt: null,
  };
}

export function enableAutoLoop(enabledAt: string): AutoLoopState {
  return {
    enabledAt,
  };
}

export function disableAutoLoop(): AutoLoopState {
  return {
    enabledAt: null,
  };
}

export function isNewReadyIssue(
  issue: ReadyIssueObservation,
  state: AutoLoopState,
): boolean {
  if (state.enabledAt === null) {
    return false;
  }

  return Date.parse(issue.readyAt) > Date.parse(state.enabledAt);
}
