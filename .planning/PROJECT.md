# Aegis

## What This Is

Aegis is a lightweight, runtime-agnostic multi-agent swarm orchestrator. It coordinates AI coding agents (Oracle, Titan, Sentinel castes) through a pluggable adapter layer and an external issue tracker (Beads). The orchestrator is a thin, readable coordination layer — not a framework — that any single developer can understand and modify.

## Core Value

The dispatch loop stays deterministic and understandable — no magic, no hidden state, no framework coupling. If the orchestrator crashes, it recovers fully from persistent dispatch state plus the issue tracker.

## Requirements

### Validated

- ✓ POLL → TRIAGE → DISPATCH → MONITOR → REAP loop — existing
- ✓ Three agent castes (Oracle/Titan/Sentinel) with Pi runtime adapter — existing
- ✓ Git worktree isolation for Titan agents (`labors.ts`) — existing
- ✓ Mnemosyne learnings store with domain filtering and token budgeting — existing
- ✓ Lethe pruning (recency-based, conventions get 2x longevity) — existing
- ✓ HTTP/SSE server with `/api/steer` and `/api/learning` endpoints — existing
- ✓ Beads issue tracker integration — existing
- ✓ Config loading and validation — existing
- ✓ CLI (`init`, `start`, `status`, `stop`) — existing
- ✓ Per-caste concurrency enforcement — existing
- ✓ Stuck detection and budget enforcement (`monitor.ts`) — existing
- ✓ Dispatch failure backoff (3 failures in 10 min → skip issue) — existing
- ✓ `dispatch-store.ts` — persistent `DispatchRecord` state machine (Validated in Phase 01: dispatch-store)
- ✓ Config v2 — `version: 2`, flat `runtime` string, v1→v2 migration, updated Oracle budgets (Validated in Phase 01: dispatch-store)

### Active

**Dispatch-Store Pivot (architectural — do first):**
- [ ] Updated triage — drive dispatch from `DispatchRecord` stages, not `SCOUTED:`/`REVIEWED:` comment parsing
- [ ] Conversational mode — idle by default; `auto on`/`auto off`; direct commands (`scout`, `implement`, `review`, `process`)
- [ ] Oracle Assessment parsing — structured JSON output stored in dispatch state
- [ ] Sentinel verdict parsing — structured JSON verdict stored in dispatch state
- [ ] Crash recovery — on startup, recover interrupted `scouting`/`implementing`/`reviewing` records

**Olympus Dashboard MVP (build after pivot):**
- [ ] React SPA scaffold (Vite + Tailwind) with SSE connection
- [ ] Agent cards — caste badge, issue title, turn counter, token count, cost, kill button
- [ ] Top bar — orchestrator status, global stats (agents, cost, uptime, queue depth), auto mode toggle
- [ ] Command bar — direct command input (pattern-matched, no LLM), response area
- [ ] First-run setup wizard — API keys, model assignment, concurrency slider, prereq checks

### Out of Scope

- Metis (natural language interpreter) — post-MVP per SPEC §3.2
- Prometheus (strategic planner) — post-MVP per SPEC §3.3
- xterm.js agent output streams — post-MVP dashboard feature
- Kanban issue board — post-MVP dashboard feature
- Cost/perf charts (Recharts) — post-MVP dashboard feature
- RAG-based Mnemosyne retrieval — post-MVP (needed at >200 records)
- Multi-runtime swarms (ClaudeCode, Ollama adapters) — post-MVP
- Inter-agent messaging — not scoped; will assess if implementation reveals a need

## Context

Brownfield project — Layer 1 is fully implemented using the first-generation design (comment-based state: `SCOUTED:`/`REVIEWED:` prefixes drive triage). The SPEC has been revised (by Opus) to a cleaner architecture: a persistent `dispatch-state.json` owned by `dispatch-store.ts` replaces comment parsing entirely.

The codebase map lives in `.planning/codebase/`. Key findings:
- `src/triage.ts` is a pure function and will be straightforward to update once dispatch-store exists
- `src/aegis.ts` is the large orchestrator class — the dispatch-store migration touches it significantly
- `olympus/src/` is scaffolded but completely empty; React/Vite build is configured

Spec is trusted as written. Additive changes are welcome during implementation if discoveries warrant them.

## Constraints

- **Tech stack**: TypeScript + Node.js ≥ 22.5.0, Vitest for tests, Pi SDK for agent runtime
- **Windows-first**: All paths and shell operations must work on Git Bash / Windows
- **No LLM in dispatch loop**: Layer 1 is and must remain fully deterministic
- **Backwards compatibility**: Config v2 migration must be handled — existing `.aegis/config.json` files use v1 format

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| dispatch-store pivot before Olympus | Dashboard should display correct data model, not comment-parsed state | ✓ Dispatch store complete; triage pivot in Phase 02 |
| Spec trusted as-is | Designed by Opus with full context; additive changes welcome during implementation | ✓ Phase 01 confirmed spec accuracy |
| Inter-agent messaging not scoped | No clear need established yet; will surface if implementation requires it | — Pending |
| Comment-based triage (old design) | Original approach — simple but fragile and ephemeral | ⚠️ Pivot underway — Phase 02 replaces with store-based triage |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase:** Move completed requirements to Validated. Add decisions to Key Decisions. Update "What This Is" if it drifts.

**After MVP milestone:** Review Core Value, audit Out of Scope, update Context with real usage observations.

---
*Last updated: 2026-03-27 after Phase 01 (dispatch-store) completion*
