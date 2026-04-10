# Olympus Operator Workflow Design

## Purpose

Redesign Olympus as the first-class operator console for Aegis.

The browser should stop behaving like a thin wrapper around manual terminal-era actions and instead become the authoritative interactive surface for starting, watching, and steering the deterministic orchestration loop.

## Source of truth

- Product behavior: `SPECv2.md`
- Repo operating rules: `AGENTS.md`
- Startup dependency: `docs/superpowers/specs/2026-04-10-aegis-startup-preflight-design.md`
- Observability dependency: `docs/superpowers/specs/2026-04-10-live-execution-observability-design.md`
- Mock/docs dependency: `docs/superpowers/specs/2026-04-10-mock-seed-operator-docs-design.md`

## Series position

This is spec 2 of 4 in the Olympus operator-console redesign.

It defines the operator-facing product shell and the intended workflow through that shell.

## Goals

- Make Olympus the primary control interface for Aegis.
- Replace the current manual `Start Run` UX with loop-oriented control.
- Keep the ready queue and Beads dependency graph visible.
- Keep steer commands available, documented, and secondary.
- Make intervention obvious without requiring source knowledge.
- Preserve a clean scan path for the operator during active execution.

## Non-goals

- Metis chat mode.
- Prometheus planning mode.
- A setup wizard.
- Historical analytics dashboards.
- Deep visual polish beyond what is required for clarity and usability.

## Canonical control model

Olympus MVP should expose one real control loop, not several competing metaphors.

### Primary states

The operator should see one of these high-level UI states:

- `blocked` — startup preflight failed and Olympus was not opened
- `idle` — Olympus is open, preflight passed, loop is not running
- `running` — auto loop is actively polling and processing work
- `paused` — loop is temporarily suspended
- `stopping` — loop is being stopped cleanly

### Primary controls

The primary control is loop control, not issue-by-issue hand driving.

The main loop area or global header should expose:

- `Start` when idle
- `Pause` and `Stop` when running
- `Resume` and `Stop` when paused

There should be no separate MVP control that competes with this model, such as a distinct `Auto` toggle plus a separate `Start Run` button. In MVP, starting the loop is the meaningful action. The current `auto_on` / `auto_off` concept becomes the implementation detail behind this UI.

## Information architecture

The approved section order is:

1. **Aegis loop area**
2. **Merge queue**
3. **Active agent sessions**
4. **Completed sessions tray**

The right sidebar remains visible but lighter than the main execution lane.

### Aegis loop area

This section is the top-most operational surface and contains the primary controls.

It should show:

- running state
- current mode
- compact explanation of what the loop is doing
- `Start` / `Pause` / `Resume` / `Stop` controls
- a phase table for deterministic loop phases

### Phase table

The main loop surface should be rendered as a structured table rather than a single mixed timeline.

The default MVP columns are:

- `Poll`
- `Dispatch`
- `Monitor`
- `Reap`

Each column contains only the recent log lines for that phase. This keeps the operator from mentally parsing one interleaved stream.

### Merge queue section

This sits directly below the loop area and is first-class, not buried in logs.

It should show:

- queue length
- next item
- current queue activity
- live merge log lines
- Janus escalation visibility

Janus escalations should open as popup terminal panes anchored to this section. When they complete, they collapse into the same completed-sessions tray used by other sessions.

### Active agent sessions

This is its own section below merge queue.

Each active session gets a terminal-like pane with:

- session identity
- caste
- issue id
- stage
- live SSE-fed lines
- compact usage stats

These panes are the main execution surface for live work.

### Completed sessions tray

Finished sessions do not stay in the active grid indefinitely.

The approved behavior is:

- move finished panes out of the active grid
- collapse them into a recent-completions tray
- keep them briefly available for continuity and post-mortem visibility

### Sidebar

The sidebar remains present but subordinate.

It should contain:

- ready queue summary
- Beads issue graph or dependency view
- selected issue detail
- intervention controls
- steer command reference

The sidebar should support the main execution lane, not compete with it visually.

## Queue and graph visibility

Olympus must detect Beads work and make the queue legible.

The MVP shell should expose:

- current ready queue
- suppressed work, when relevant
- dependency graph or dependency tree view
- selected issue context

This goes beyond the old written Olympus MVP scope in `SPECv2.md`, but it is required for Olympus to be usable as the first-class operator surface.

## Steer command model

The current free-form command bar is the wrong primary interaction model for MVP.

In the redesign:

- the control is framed as `Steer`
- it remains deterministic, not conversational
- a visible reference is always present
- results and failures are shown in clear operator language

### MVP steer behavior

The steer surface is secondary to the loop controls.

It exists for:

- status checks
- pause and resume
- focus or narrow attention to a specific issue
- kill a specific agent
- trigger other deterministic expert actions that are actually wired

It does not pretend to be chat. If Metis is absent, the UI must say so explicitly rather than accepting free text and failing obscurely.

## Error and result handling

Olympus should have a single clear result surface for operator actions.

Rules:

- no duplicate success banners
- no silent declines
- no buried backend text
- every failure should state what happened and what the operator can do next

Examples:

- `Loop paused. No new work will be dispatched until you resume.`
- `Kill declined: agent titan-22 already completed and moved to Recent Sessions.`
- `Focus failed: issue foundation.contract is not in the active or ready set.`

## Interaction rules

- The operator should not have to type `scout`, `implement`, or `review` to make normal progress.
- The normal path is: preflight passes, Olympus opens, operator starts the loop, Aegis processes the queue.
- Manual issue-stage commands are expert interventions, not the MVP happy path.

## Implementation boundaries

Likely touch points:

- `olympus/src/App.tsx`
- `olympus/src/components/top-bar.tsx`
- `olympus/src/components/start-run-dialog.tsx` or its replacement
- `olympus/src/components/command-bar.tsx` or its replacement
- new Olympus sections for loop phases, merge queue, active sessions, and recent completions
- relevant tests in `olympus/src/components/__tests__/`

This spec defines the shell and interaction model. The live data and event contracts are defined in the observability spec.

## Manual validation

- Open Olympus after a healthy startup and confirm the loop shell is the first thing the operator sees.
- Confirm there is one primary loop control model and no conflicting `Start Run` vs `Auto` UX.
- Confirm the phase table, merge queue, active sessions, and completed tray appear in the approved order.
- Confirm steer reference is always visible.
- Confirm the queue and issue graph remain visible during active execution.
- Confirm Janus appears as a merge-section popup terminal and collapses when complete.

