# Olympus Operator Guide

A walkthrough of the Olympus dashboard UI for Aegis operators.

## Overview

Olympus is the browser-based dashboard that serves as the primary operator interface for Aegis. It displays the Aegis Loop state, agent activity, the ready queue, and provides a steer panel for sending commands to the orchestrator.

## Dashboard Layout

### Top Bar

Shows the Aegis version, server connection status, and settings access.

### Operator Sidebar (Left Panel)

- **Ready Queue** -- Lists issues from `bd ready` that are available for dispatch.
- **Issue Graph** -- Shows dependency relationships between active issues.
- **Selected Issue** -- Detailed view of a chosen issue including its stage and summary.
- **Steer Panel** -- Input field and reference list for sending deterministic steer commands.

### Main Area

- **Loop Panel** -- Displays the current Aegis Loop state (idle, running, paused) with controls to start, pause, resume, or stop the loop.
- **Merge Queue** -- Shows pending merges awaiting integration.
- **Active Sessions** -- Lists live agent sessions with kill controls.
- **Recent Sessions** -- History of recently completed agent sessions.
- **Agent Grid** -- Visual grid of all known agents with their current status.
- **Command Bar** -- Free-form command input for advanced operations.

## The Aegis Loop

The Aegis Loop follows a deterministic cycle:

1. **Poll** -- Check `bd ready` for unblocked issues.
2. **Dispatch** -- Assign ready issues to available agents.
3. **Monitor** -- Track agent session progress and health.
4. **Reap** -- Collect completed work, update dispatch state, and close finished issues.

Operators can control the loop via the Loop Panel buttons or the Steer Panel commands.

## Steer Commands

The Steer Panel accepts these deterministic MVP commands:

| Command | Description |
|---------|-------------|
| `status` | Show current loop and queue status. |
| `pause` | Pause dispatching new work. |
| `resume` | Resume the paused loop. |
| `focus <issue-id>` | Pin attention to one ready or active issue. |
| `kill <agent-id>` | Abort one live agent session. |

See the [Steer Reference](./steer-reference.md) for detailed descriptions.

## SSE Connection

Olympus connects to the Aegis server at `/api/events` via Server-Sent Events. All displayed state is derived from the SSE stream. The connection indicator in the top bar shows whether the stream is active.

## Key Principles

- **Five Truth Planes**: Beads (task definitions), `dispatch-state.json` (orchestration stage), `mnemosyne.jsonl` (learned knowledge), `merge-queue.json` (merge state), and Olympus UI (live display). Olympus is derived, never authoritative.
- **No mutations**: All state transitions return new objects.
- **Atomic writes**: Dispatch state uses tmp-then-rename for durability.
