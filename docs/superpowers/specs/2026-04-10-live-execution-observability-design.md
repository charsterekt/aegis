# Aegis Live Execution and Observability Design

## Purpose

Wire Olympus to the real orchestration and runtime signals so the browser becomes the source of visibility for what Aegis is doing.

This spec defines the data contracts and event flows required to power the approved operator console shell.

## Source of truth

- Product behavior: `SPECv2.md`
- Repo operating rules: `AGENTS.md`
- Workflow shell dependency: `docs/superpowers/specs/2026-04-10-olympus-operator-workflow-design.md`
- Startup dependency: `docs/superpowers/specs/2026-04-10-aegis-startup-preflight-design.md`

## Series position

This is spec 3 of 4 in the Olympus operator-console redesign.

It turns the UI shell into a truthful live surface.

## Goals

- Replace stub dashboard state with real derived state.
- Feed the loop phase table from structured live events.
- Feed active agent terminal panes from live session events.
- Feed merge queue and Janus panes from real merge-worker events.
- Keep browser refresh safe through snapshot plus SSE replay.
- Keep completed-session continuity without cluttering the active view.

## Non-goals

- Full historical analytics.
- Provider-specific raw logs beyond what the normalized runtime and orchestrator expose.
- A websocket rewrite; SSE remains the transport.
- A durable database for operator logs in MVP.

## Visibility model

Olympus is derived state. It is not a truth plane.

The browser view should be assembled from:

- Beads ready queue and issue graph
- `.aegis/dispatch-state.json`
- `.aegis/merge-queue.json`
- live runtime session events
- live orchestration events
- recent command results

## Initial hydration contract

The first render after page load must be based on an expanded snapshot rather than placeholder zeros.

`GET /api/state` should return enough data to render the full operator shell without waiting for the first SSE event.

The snapshot must include at least:

- lifecycle status
- loop mode
- paused state
- uptime
- active agent count
- queue depth
- spend or quota summary
- ready queue summary
- issue graph summary
- loop phase logs
- merge queue state
- active sessions
- recent completed sessions
- selected command catalog or steer reference data
- current config summary needed by the UI

## SSE contract

SSE remains the live transport. The event stream should be expanded to support the approved UI.

### Required event families

1. **Loop phase logs**

Used by the `Poll`, `Dispatch`, `Monitor`, and `Reap` columns.

Suggested shape:

```json
{
  "type": "loop.phase_log",
  "payload": {
    "phase": "poll",
    "line": "3 dispatchable, 1 suppressed by overlap",
    "level": "info",
    "issueId": null,
    "agentId": null
  }
}
```

2. **Agent session lifecycle**

Used to create, update, and retire agent terminal panes.

Suggested event family:

- `agent.session_started`
- `agent.session_log`
- `agent.session_stats`
- `agent.session_ended`

3. **Merge queue logs**

Used by the dedicated merge queue section.

Suggested event family:

- `merge.queue_state`
- `merge.queue_log`
- `merge.outcome`

4. **Janus session lifecycle**

Used to open and close the merge-section Janus popup pane.

Suggested event family:

- `janus.session_started`
- `janus.session_log`
- `janus.session_ended`

5. **Command results**

Used by the single result and error surface.

The existing `control.command` event should be retained or normalized so the UI can render:

- accepted
- completed
- declined
- failed

6. **Issue stage transitions**

Used to keep selected issue detail and queue/graph state coherent.

Suggested event:

- `issue.stage_changed`

## Loop phase table design

The loop table should not be built from a generic mixed timeline.

Instead:

- loop events are tagged with a phase
- the server maintains a short in-memory ring buffer per phase
- the snapshot returns the current buffers
- SSE appends to the correct phase column in real time

Recommended default retention:

- 50 recent lines per phase in snapshot
- replay sufficient to cover normal refresh and reconnect behavior

## Agent terminal pane design

Active agent panes are terminal-like, but they should be driven by structured normalized events rather than arbitrary provider output.

Each pane should be backed by:

- session id
- issue id
- caste
- current stage
- model
- recent terminal lines
- compact usage stats
- lifecycle state

Terminal lines may be synthesized from:

- runtime `message`
- `tool_use`
- `stats_update`
- `budget_warning`
- orchestration stage transitions
- fatal runtime errors

This gives the operator a truthful sense of movement without leaking provider-specific noise directly into the UI contract.

## Completed sessions tray

When a session ends:

- remove it from the active grid
- convert it into a compact recent-completion item
- retain terminal summary and outcome metadata briefly

Recommended tray item fields:

- session id
- caste
- issue id
- outcome
- closed timestamp
- expandable last few lines

The same tray behavior applies to:

- Oracle
- Titan
- Sentinel
- Janus

## Merge queue and Janus visibility

The merge queue section needs two distinct kinds of visibility:

1. **queue status visibility**
   - queue length
   - current item
   - next item
   - queue outcomes

2. **merge execution visibility**
   - current gate command
   - merge result
   - Janus escalation state

When Janus is invoked, the merge queue section should open a popup terminal pane anchored to that section. This keeps Janus visually tied to integration resolution rather than making it look like another ordinary active agent.

When Janus completes, its popup collapses into the completed-sessions tray.

## Real counts and summaries

The current Olympus stubs for:

- `activeAgents`
- `queueDepth`
- `agents`
- merge activity
- loop activity

must be replaced with real derived values.

Derivation rules:

- `activeAgents` comes from currently live session handles known to the runtime/orchestrator layer
- `queueDepth` comes from the Beads ready queue plus whatever scoped suppression logic defines as dispatchable vs suppressed
- active agent cards and panes come from live session registry, not placeholder arrays
- merge queue state comes from `.aegis/merge-queue.json`, not guesswork

## Refresh and reconnect behavior

Browser refresh must be safe and legible.

Rules:

- initial snapshot reconstructs the current view
- SSE replay fills short gaps
- reconnect does not duplicate panes or duplicate completed-session tray items
- closed sessions should not reappear as active after refresh

## Error visibility

Operator-visible failures should be normalized into clear UI states:

- session failed
- command declined
- merge failed
- Janus failed
- runtime unavailable

Every such state should have:

- human-readable reason
- related issue or session id
- next-step hint where appropriate

## Implementation boundaries

Likely touch points:

- `src/events/event-bus.ts`
- `src/server/http-server.ts`
- `src/server/routes.ts`
- runtime session observation paths in `src/runtime/` and orchestration code
- merge queue and Janus publishers under `src/merge/`
- Olympus SSE client and state types under `olympus/src/lib/` and `olympus/src/types/`

This spec intentionally requires more live event structure than the current MVP shell, because the approved operator console cannot be powered by stub state.

## Manual validation

- Start Aegis, open Olympus, and confirm queue depth and active agent count are real.
- Enable the loop and confirm phase table columns receive only phase-appropriate log lines.
- Confirm active sessions spawn terminal panes in real time.
- Confirm finished sessions leave the active grid and enter the recent-completions tray.
- Confirm merge queue updates in real time and Janus opens as a merge-section popup terminal when needed.
- Refresh the browser mid-run and confirm the console reconstructs correctly.
- Confirm command declines and runtime failures appear in the single result and error surface with actionable text.

