# Project Research Summary

**Project:** Aegis
**Domain:** Multi-agent coding orchestrator
**Researched:** 2026-03-31
**Confidence:** HIGH

## Executive Summary

Aegis is best built as a thin orchestrator with hard truth boundaries, explicit local state, and a browser-first operator surface. The canonical spec already makes the correct structural calls: Beads owns task truth, `.aegis` files own orchestration truth, Pi is the first runtime, Git worktrees isolate execution, and Olympus reflects state rather than owning it.

The recommended implementation approach is to front-load bootstrap plus evaluation scaffolding, then build the deterministic dispatch core before adding safe integration, browser UX, and advanced autonomy layers. The biggest risk is not lack of capability; it is truth drift and autonomy creep. The roadmap therefore needs to prove restart recovery, queue safety, and eval discipline before it expands into mixed models, configurable pipelines, or strategic planning layers.

## Key Findings

### Recommended Stack

The stack should stay close to the current repository baseline: Node.js 22 LTS+, TypeScript 5.9.x, Pi packages for the first runtime adapter, Git worktrees for isolation, and a React/Vite Olympus shell backed by HTTP plus SSE. This gives a stable local orchestrator, straightforward Windows support, and a separate browser surface without hiding truth in the UI.

**Core technologies:**
- Node.js: local orchestrator runtime, process control, and HTTP/SSE server - already declared in the repo
- TypeScript: contract clarity for dispatch, runtime adapters, and queue artifacts - essential for deterministic boundaries
- Pi packages: first runtime substrate - already the launch runtime in the spec and the current dependency baseline
- Git worktree: labor isolation - best match for safe multi-branch execution

### Expected Features

Users will expect deterministic dispatch, tracker-backed task truth, isolated labors, a mechanical merge queue, browser visibility, and explicit guardrails before they trust autonomy. The differentiators are clearer truth-plane separation, post-merge Sentinel review, Janus only on escalation, sparse typed messaging, and scope-overlap prevention.

**Must have (table stakes):**
- Deterministic dispatch state with restart recovery
- Pi-backed Oracle/Titan/Sentinel execution in isolated worktrees
- Merge queue with explicit outcomes and browser-visible state
- Budget, stuck, and cooldown guardrails
- Eval harness with named benchmark scenarios

**Should have (competitive):**
- Post-merge Sentinel review
- Janus escalation path for hard integration cases
- Sparse Beads-native messages
- Scope-overlap protection before Titan dispatch

**Defer (v2+):**
- Alternate per-issue pipelines such as pre-merge review variants
- Semantic Mnemosyne retrieval
- First-run browser wizard

### Architecture Approach

The architecture should separate the deterministic core from the runtime, tracker, and UI edges. `aegis.ts`, triage, dispatcher, monitor, and merge queue sit over explicit state files; runtime adapters talk to Pi and future runtimes; tracker integration talks only to Beads; Olympus consumes durable state through HTTP/SSE; and Mnemosyne remains a knowledge layer, not a telemetry log.

**Major components:**
1. Orchestrator core - selects work, tracks stages, enforces policies
2. Runtime adapter layer - spawns and steers agent sessions
3. Merge and labor layer - isolates work and integrates results safely
4. Olympus dashboard - operator visibility and control
5. Eval harness - evidence for scale and release decisions

### Critical Pitfalls

1. **Truth-plane drift** - keep state ownership explicit and durable
2. **Runtime leakage into the core** - enforce the adapter boundary early
3. **Unsafe merge autonomy** - keep the queue mechanical and Janus exceptional
4. **Browser-authoritative state** - derive Olympus from backend truth only
5. **Autonomy without proof** - require evals and budget gates before expanding scope

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Bootstrap and Benchmark Backbone
**Rationale:** "Evaluate before scale" is a design principle, not cleanup work.
**Delivers:** CLI/bootstrap, config/file layout, Olympus shell, and a first benchmark harness.
**Addresses:** bootstrap, config, and eval requirements.
**Avoids:** over-autonomy without proof and Windows bootstrap failures.

### Phase 2: Deterministic Dispatch Core
**Rationale:** The rest of the product depends on explicit state, runtime contracts, and restart recovery.
**Delivers:** dispatch store, triage, dispatcher, monitor, reaper, Pi adapter, labors, and Mnemosyne basics.
**Uses:** Node.js, TypeScript, Pi packages, Git worktrees.
**Implements:** orchestrator core and runtime boundary.

### Phase 3: Safe Integration and Messaging
**Rationale:** Once Titan can produce candidates, integration safety becomes the next hard boundary.
**Delivers:** merge queue, gate runner, conflict artifacts, Janus escalation, and Beads-native messaging/event ingest.
**Uses:** tracker integration, queue state, and labor preservation.
**Implements:** mechanical integration layer.

### Phase 4: Olympus Control Room
**Rationale:** Browser-first visibility is part of the promise, not postscript UX.
**Delivers:** live swarm view, commands, budget visibility, issue board, and event timeline.

### Phase 5: Extensible Autonomy Layers
**Rationale:** Mixed runtimes, configurable pipelines, Metis, and Prometheus should arrive only after the deterministic core is trustworthy.
**Delivers:** extension-safe stage machinery, model/runtime mapping, advanced steering, and release-ready eval gates.

### Phase Ordering Rationale

- The roadmap front-loads bootstrap and evals because the spec explicitly says to evaluate before scale.
- Dispatch and runtime contracts come before merge and UI because they define the product's core truth boundaries.
- Merge safety comes before richer operator UX because unsafe autonomy is a deeper risk than sparse visibility.
- Advanced autonomy layers are last because they amplify any weakness in the lower layers.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** merge-queue policy edge cases and Janus escalation boundaries
- **Phase 4:** Olympus interaction design and operator workflow ergonomics
- **Phase 5:** mixed-runtime normalization and strategic planning mode boundaries

Phases with standard patterns:
- **Phase 1:** repo bootstrap, local config, and harness scaffolding
- **Phase 2:** explicit state machine plus adapter-boundary implementation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Current repo baseline plus official Node/Git/Pi/React/Vite docs are consistent |
| Features | HIGH | The PRD is explicit about table stakes and non-goals |
| Architecture | HIGH | The spec already defines strong responsibility boundaries |
| Pitfalls | HIGH | Risks are direct consequences of the stated design principles |

**Overall confidence:** HIGH

### Gaps to Address

- Mixed-runtime specifics need validation when non-Pi adapters are introduced.
- Olympus implementation details remain open because the repo does not yet contain the dashboard codebase.
- Beads integration details should be validated against the exact command surface used in implementation.

## Sources

### Primary (HIGH confidence)
- `SPECv2.md` - canonical product and implementation scope
- `package.json` - current repository stack baseline
- https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html - process orchestration and Windows behavior
- https://git-scm.com/docs/git-worktree - linked worktree semantics
- https://shittycodingagent.ai/ - Pi runtime capabilities and modes

### Secondary (MEDIUM confidence)
- https://github.com/andygeiss/beads - tracker capabilities and workflow model
- https://react.dev/learn/add-react-to-an-existing-project - React guidance for the Olympus shell
- https://vite.dev/guide/ - Vite setup for the dashboard build

---
*Research completed: 2026-03-31*
*Ready for roadmap: yes*
