# Architecture Research

**Domain:** Multi-agent coding orchestrator with tracker-backed truth and browser-first control
**Researched:** 2026-03-31
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
+-------------------------------------------------------------+
|                      Olympus Dashboard                      |
|  status | active agents | commands | queue | budgets | SSE |
+-----------------------------+-------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                    Aegis Orchestrator Core                  |
|  aegis.ts | triage | dispatcher | monitor | merge queue     |
|  reaper   | event ingest | HTTP server | command handlers   |
+-------------------+----------------+------------------------+
                    |                |
                    v                v
        +-------------------+   +---------------------------+
        | Runtime Adapters  |   | Local Durable State       |
        | Pi first, others  |   | .aegis/*.json, jsonl      |
        +---------+---------+   +-------------+-------------+
                  |                           |
                  v                           v
        +-------------------+       +------------------------+
        | Agent Sessions    |       | Mnemosyne / Lethe      |
        | Oracle/Titan/...  |       | learnings + pruning    |
        +---------+---------+       +------------------------+
                  |
                  v
        +-------------------+       +------------------------+
        | Git Worktree      |<----->| Beads                  |
        | Labors + merges   |       | tasks/messages/truth   |
        +-------------------+       +------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `aegis.ts` | Main control loop, mode changes, orchestration wiring | Long-lived coordinator over state, polling, dispatch, and server modules |
| Triage + dispatcher | Select eligible work and launch the correct caste | Deterministic state machine plus policy checks |
| Runtime adapters | Isolate Pi and future runtime-specific behavior | Minimal `spawn/prompt/steer/abort/subscribe/getStats` contract |
| Merge queue | Integrate Titan output safely and emit explicit failure artifacts | Queue worker plus mechanical gates and escalation thresholds |
| Tracker integration | Read ready work and write structured issues/messages | Beads-specific operations behind a tracker boundary |
| Olympus server/UI | Surface live state, controls, and observability | HTTP API + SSE backend with a separate browser client |
| Mnemosyne/Lethe | Persist useful project learnings without telemetry drift | Append-only JSONL plus pruning rules |

## Recommended Project Structure

```text
src/
|-- core/                 # main loop, triage, dispatcher, monitor, reaper
|-- runtime/              # adapter contract and Pi implementation
|-- tracker/              # Beads commands, issue mapping, message delegate
|-- merge/                # queue worker, gates, Janus escalation logic
|-- state/                # dispatch-state, merge-queue, config, persistence
|-- memory/               # Mnemosyne read/write and Lethe pruning
|-- server/               # HTTP routes, SSE, command handlers
|-- prompts/              # caste prompts and artifact schemas
|-- evals/                # scenarios, fixtures, score summaries
`-- index.ts              # CLI/bootstrap entrypoint
olympus/
|-- src/                  # browser app for operator UX
`-- package.json          # separate dashboard build
```

### Structure Rationale

- **`src/core/`**: keeps deterministic orchestration logic grouped and testable.
- **`src/runtime/` and `src/tracker/`**: preserve truth boundaries by isolating external dependencies behind contracts.
- **`src/merge/`**: keeps integration behavior explicit instead of burying it in worker sessions.
- **`src/evals/`**: treats evaluation as product infrastructure, not after-the-fact tooling.
- **`olympus/`**: supports a dedicated browser surface without coupling UI build logic to the CLI runtime.

## Architectural Patterns

### Pattern 1: File-backed explicit state machine

**What:** Dispatch stages, queue state, and learned knowledge live in explicit files under `.aegis/`.
**When to use:** Always for orchestration truth, restart recovery, and operator-visible progress.
**Trade-offs:** More state-shaping work up front, but far less ambiguity later.

**Example:**
```typescript
type DispatchStage =
  | "pending"
  | "scouting"
  | "scouted"
  | "implementing"
  | "implemented"
  | "queued_for_merge"
  | "merging"
  | "resolving_integration"
  | "merged"
  | "reviewing"
  | "complete"
  | "failed";
```

### Pattern 2: Adapter boundary at the edges

**What:** Runtime and tracker specifics stay behind small interfaces.
**When to use:** For Pi, future runtimes, Beads operations, and any mixed-model extension.
**Trade-offs:** Some adapter ceremony, but a much cleaner orchestration core.

**Example:**
```typescript
interface AgentHandle {
  prompt(msg: string): Promise<void>;
  steer(msg: string): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: AgentEvent) => void): () => void;
  getStats(): AgentStats;
}
```

### Pattern 3: Artifact-first coordination

**What:** Important outcomes become tracker issues, queue records, or local state updates before they become chat.
**When to use:** Merge failures, clarifications, generated follow-up work, and escalations.
**Trade-offs:** More structured output contracts, but less hidden context.

## Data Flow

### Request Flow

```text
[Operator command or auto-mode tick]
    v
[aegis.ts]
    v
[triage] -> [dispatcher] -> [runtime adapter] -> [agent session]
    |                                 |
    |                                 v
    |                           [git worktree labor]
    v
[dispatch-state.json] -> [HTTP/SSE] -> [Olympus]
```

### State Management

```text
[Beads ready queue] ---> [triage eligibility]
                           |
                           v
                 [dispatch-state + merge-queue]
                           |
                           v
                   [SSE snapshots to Olympus]
```

### Key Data Flows

1. **Work intake:** Beads ready issue -> triage -> dispatch state -> Oracle/Titan.
2. **Integration flow:** Titan labor result -> merge queue -> main branch -> Sentinel -> follow-up issue or completion.
3. **Operator visibility:** Durable state change -> server event -> Olympus view update.
4. **Knowledge flow:** useful outcome -> Mnemosyne append -> future prompt injection.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Solo operator / early build | Single-process orchestrator, local files, SSE, one dashboard client |
| Small swarm across many issues | Tighten concurrency controls, improve queue metrics, add better event summaries |
| Higher autonomy / mixed runtimes | Expand adapter coverage, strengthen budget normalization, keep truth planes unchanged |

### Scaling Priorities

1. **First bottleneck:** integration safety and merge contention - solve with overlap protection, queue visibility, and explicit escalation.
2. **Second bottleneck:** operator comprehension - solve with Olympus, budgets, event timeline, and eval summaries before adding more autonomy.

## Anti-Patterns

### Anti-Pattern 1: Hidden truth in prompts or comments

**What people do:** Infer orchestration state from agent chat, issue comments, or ad hoc notes.
**Why it's wrong:** Restart recovery and operator visibility both become unreliable.
**Do this instead:** Persist dispatch and queue state explicitly under `.aegis/`.

### Anti-Pattern 2: Runtime leakage into the core

**What people do:** Let Pi-specific session assumptions creep into triage, monitor, or merge logic.
**Why it's wrong:** Mixed-model/runtime expansion becomes a rewrite instead of an extension.
**Do this instead:** Keep the orchestration core dependent only on the adapter contract.

### Anti-Pattern 3: Treating Olympus as authoritative

**What people do:** Let UI state become the de facto truth after a refresh or disconnect.
**Why it's wrong:** The browser stops being a view and starts being a second state plane.
**Do this instead:** Derive UI state from durable server state and SSE snapshots only.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Beads | Structured tracker commands/issues/messages | Never infer orchestration state from informal comments |
| Pi runtime | Adapter-backed session spawning and steering | Pi is launch runtime, future runtimes follow the same contract |
| Git | `worktree`, branch, merge, and cleanup operations | Validate paths carefully on Windows and preserve failed candidates |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| core <-> runtime | typed adapter API | Core never imports runtime-specific modules directly |
| core <-> tracker | typed tracker service | Keeps Beads rules centralized |
| server <-> state | read-only snapshots + explicit commands | Prevents Olympus from becoming authoritative |
| merge <-> Janus | explicit escalation contract | Janus should appear as a visible state transition |

## Sources

- `SPECv2.md` - canonical component list, stage model, and implementation ordering
- `package.json` - current runtime baseline
- https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html - subprocess lifecycle and Windows caveats
- https://git-scm.com/docs/git-worktree - linked worktree model
- https://shittycodingagent.ai/ - Pi runtime capabilities and extension philosophy
- https://react.dev/learn/add-react-to-an-existing-project - React guidance for existing projects
- https://vite.dev/guide/ - frontend shell guidance for Olympus

---
*Architecture research for: multi-agent coding orchestrator*
*Researched: 2026-03-31*
