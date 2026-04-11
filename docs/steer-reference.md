# Steer Command Reference

The canonical catalog of deterministic steer commands accepted by the Aegis orchestrator. These commands are the operator-facing control surface for the Aegis Loop.

## Commands

### `status`

Show current loop and queue status.

Returns a summary of the Aegis Loop state (idle, running, paused), the current ready queue, and any active agent sessions.

### `pause`

Pause dispatching new work.

Halts the poll-dispatch cycle. Agents with in-progress sessions continue until they complete or are killed. New issues are not dispatched while paused.

### `resume`

Resume the paused loop.

Restarts the poll-dispatch-monitor-reap cycle. Any issues that became ready while paused will be picked up on the next poll.

### `focus <issue-id>`

Pin attention to one ready or active issue.

Directs the orchestrator to prioritize a specific issue over the normal ready queue. The issue must be a valid ready or active Beads issue. This is useful when an operator needs to force immediate work on a particular item.

### `kill <agent-id>`

Abort one live agent session.

Sends a termination signal to the named agent. The agent should clean up and exit gracefully. If the agent does not respond, the reaper will eventually collect the orphaned session.

## Command Format

Commands are sent to the Aegis server via the WebSocket or SSE command channel. The simplest way to send them is through the Steer Panel in the Olympus dashboard.

Commands are lowercase, space-separated, and case-sensitive. Arguments (such as `<issue-id>` or `<agent-id>`) are substituted with actual identifiers.

## Determinism Guarantee

The steer command catalog is defined in a single source of truth (`src/shared/steer-command-reference.ts`) and rendered consistently in both the Olympus UI and these docs. No other commands are accepted in the MVP.
