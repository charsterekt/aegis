# Aegis

## What This Is

Aegis is a Windows-first, runtime-agnostic multi-agent orchestrator for software work. It uses Beads as task truth, local `.aegis` state as orchestration truth, Pi as the first runtime adapter, and Olympus as the browser control room so a single developer can supervise a small swarm without turning the system into a black box.

## Core Value

A human can safely supervise multi-agent software work without losing determinism, truth boundaries, or recovery visibility.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Deterministic dispatch state drives orchestration independently of tracker comments or agent chat.
- [ ] Beads remains the single source of task truth for work, blockers, messages, and generated follow-up issues.
- [ ] Pi-backed Oracle, Titan, Sentinel, and Janus sessions run behind a runtime adapter layer with explicit budgets and guardrails.
- [ ] Git worktree labors isolate implementation and merge-candidate work safely across Windows and Unix-like environments.
- [ ] Olympus exposes browser-first visibility, commands, queue state, budgets, and interventions over SSE.
- [ ] A deterministic merge queue integrates Titan output before post-merge Sentinel review.
- [ ] Mnemosyne and Lethe retain learned project knowledge without mixing in telemetry or failure bookkeeping.
- [ ] An eval harness and release gates prove reliability before more autonomy or scale is unlocked.

### Out of Scope

- Distributed message-bus behavior - Aegis is a thin orchestrator, not a new coordination substrate.
- A second durable task database beside Beads - task truth already lives in the tracker.
- Terminal-only or tmux-dependent control - Olympus is the primary operator surface.
- Agent-to-agent chatter as the main control loop - artifacts and tracker state come first.
- Default pre-merge LLM review or automatic critical merge decisions - the merge queue stays mechanical and Sentinel remains post-merge by default.

## Context

`SPECv2.md` is the canonical product and implementation document for this project and explicitly supersedes earlier specs. The repository currently contains the PRD, package metadata, and Pi package dependencies, but no production `src/` implementation yet, so initialization is being driven from the spec rather than from an existing codebase map.

The intended architecture is deliberately legible: Beads owns task truth, `.aegis/dispatch-state.json` owns orchestration truth, `.aegis/mnemosyne.jsonl` owns learned project knowledge, and Olympus only reflects live state. The default end-to-end workflow is Beads issue -> Oracle -> Titan in Labor -> Merge Queue -> Sentinel -> Complete, with Janus reserved for merge-boundary escalation only.

The product is explicitly browser-first, deterministic at the core, and economics-aware. Auto mode is opt-in, hooks accelerate freshness but polling remains the correctness baseline, and release readiness is earned through benchmark scenarios and regression gates rather than by adding more autonomy on faith.

## Constraints

- **Tech stack**: Node.js `>=22.5.0` and TypeScript ESM - the current repository already targets this runtime baseline.
- **Runtime**: Pi first - the adapter layer must ship with Pi before additional runtimes are introduced.
- **Tracker**: Beads is authoritative - Aegis must never invent a second task-truth plane.
- **Portability**: Windows-first path, shell, and worktree handling - PowerShell, cmd, and Git Bash all need to work.
- **Control surface**: Olympus is primary - terminal commands remain useful, but the browser is the main operator interface.
- **Reliability**: Polling, persistence, cooldowns, and restart recovery are mandatory - the deterministic core cannot depend on LLM interpretation.
- **Economics**: Budget, quota, and retry guardrails are first-class product behavior - expensive autonomy must become a visible decision point.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Default workflow is Oracle -> Titan -> Merge Queue -> Sentinel | Keep implementation and integration safety explicit while preserving deterministic control flow | - Pending |
| Sentinel reviews merged code by default | Review should judge the code that actually landed, not just a branch snapshot | - Pending |
| Janus is escalation-only | Merge should stay mechanical on the happy path | - Pending |
| Beads-native messages are the default coordination channel | Keep messaging sparse, structured, and attached to task truth | - Pending |
| Polling is the correctness baseline | Hooks may fail; the system still needs to remain correct | - Pending |
| Olympus is the primary operator interface | State, control, and intervention need one visible surface | - Pending |
| Pi is the first runtime adapter | The current repository and launch plan already center Pi packages and Pi semantics | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-31 after initialization*
