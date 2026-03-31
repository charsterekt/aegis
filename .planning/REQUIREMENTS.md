# Requirements: Aegis

**Defined:** 2026-03-31
**Core Value:** A human can safely supervise multi-agent software work without losing determinism, truth boundaries, or recovery visibility.

## v1 Requirements

### Bootstrap

- [ ] **BOOT-01**: Operator can run `aegis init` in a new repository and create the required `.aegis` files plus an Olympus launch path
- [ ] **BOOT-02**: Operator receives clear prerequisite errors when required tools or environment conditions are missing
- [ ] **BOOT-03**: Operator can configure runtime, budgets, thresholds, and Olympus settings through repo-local files

### Dispatch

- [ ] **DISP-01**: Aegis can read ready work from Beads without inferring orchestration state from informal comments
- [ ] **DISP-02**: Operator can run deterministic direct commands for `scout`, `implement`, `review`, `process`, `pause`, and `resume`
- [ ] **DISP-03**: Operator can enable auto mode so only newly ready issues are dispatched under configured concurrency limits
- [ ] **DISP-04**: Operator can restart Aegis and recover active or incomplete work from durable dispatch state

### Runtime

- [ ] **AGNT-01**: Aegis can spawn Oracle, Titan, Sentinel, and Janus sessions through a runtime adapter contract with Pi as the first adapter
- [ ] **AGNT-02**: Operator can rely on enforced stuck detection, retry limits, cooldowns, and per-caste budgets without LLM judgment
- [ ] **AGNT-03**: Titan can create a clarification artifact instead of guessing when requirements are ambiguous

### Labor and Merge

- [ ] **LABR-01**: Titan executes in an isolated git worktree labor tied to its assigned issue
- [ ] **LABR-02**: Successful Titan output enters a deterministic merge queue instead of merging directly to the target branch
- [ ] **LABR-03**: Merge failures create explicit rework, conflict, or escalation artifacts, with Janus used only after configured thresholds
- [ ] **LABR-04**: Sentinel reviews merged code by default and can create corrective follow-up work on failure

### Messaging and Knowledge

- [ ] **MSG-01**: Aegis can create sparse, typed Beads message issues for system signaling and selective coordination
- [ ] **MSG-02**: Operator can rely on `.aegis/mnemosyne.jsonl` for learned project conventions without mixing in telemetry or crash bookkeeping
- [ ] **MSG-03**: Mnemosyne applies pruning limits and prompt budgets so retrieval stays useful as project history grows

### Dashboard

- [ ] **DASH-01**: Operator can view live swarm status, active agents, queue depth, uptime, and spend or quota state in Olympus
- [ ] **DASH-02**: Operator can run direct commands and kill active agents from Olympus without dropping to the terminal
- [ ] **DASH-03**: Olympus receives live updates over SSE and remains non-authoritative after refresh or reconnect
- [ ] **DASH-04**: Operator can inspect issue-board, timeline, budget, Mnemosyne, and eval views as the dashboard matures

### Safety and Economics

- [ ] **SAFE-01**: Operator can see and enforce budget guardrails across exact-cost, quota, credit, or stats-only metering modes
- [ ] **SAFE-02**: Aegis suppresses unsafe autonomous dispatch or Janus escalation when policy or metering state is insufficient

### Evaluation

- [ ] **EVAL-01**: Operator can run named benchmark scenarios and receive machine-readable result artifacts under `.aegis/evals/`
- [ ] **EVAL-02**: Aegis can prove release readiness against completion, restart, artifact, and human-intervention thresholds

### Extensibility

- [ ] **EXTN-01**: Operator can define alternate stage pipelines without rewriting the deterministic dispatch core
- [ ] **EXTN-02**: Operator can assign different models or runtimes per caste through configuration
- [ ] **EXTN-03**: Operator can use optional Metis and Prometheus modes without bypassing direct commands or user confirmation rules

## v2 Requirements

### Future Extensions

- **PIPE-04**: Operator can apply alternate per-issue review pipelines such as pre-merge review for special categories
- **MEM-04**: Mnemosyne can use embedding-backed semantic retrieval when keyword matching stops being effective
- **ONBD-01**: Operator can complete first-run repository setup through an Olympus wizard instead of CLI-first setup

## Out of Scope

| Feature | Reason |
|---------|--------|
| Distributed internal message bus | Conflicts with the thin-orchestrator and single-truth-plane design |
| Second durable task database | Beads already owns task truth |
| Terminal-only or tmux-dependent control plane | Olympus is the primary operator surface |
| Agent-to-agent chatter as the main control loop | Coordination should stay artifact-first and tracker-visible |
| Default LLM-driven merge decisions on the happy path | Merge safety must remain mechanical by default |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BOOT-01 | Phase 1 | Pending |
| BOOT-02 | Phase 1 | Pending |
| BOOT-03 | Phase 1 | Pending |
| EVAL-01 | Phase 1 | Pending |
| DISP-01 | Phase 2 | Pending |
| DISP-02 | Phase 2 | Pending |
| DISP-03 | Phase 2 | Pending |
| DISP-04 | Phase 2 | Pending |
| AGNT-01 | Phase 2 | Pending |
| AGNT-02 | Phase 2 | Pending |
| AGNT-03 | Phase 2 | Pending |
| LABR-01 | Phase 2 | Pending |
| MSG-02 | Phase 2 | Pending |
| MSG-03 | Phase 2 | Pending |
| LABR-02 | Phase 3 | Pending |
| LABR-03 | Phase 3 | Pending |
| LABR-04 | Phase 3 | Pending |
| MSG-01 | Phase 3 | Pending |
| SAFE-01 | Phase 3 | Pending |
| SAFE-02 | Phase 3 | Pending |
| DASH-01 | Phase 4 | Pending |
| DASH-02 | Phase 4 | Pending |
| DASH-03 | Phase 4 | Pending |
| DASH-04 | Phase 4 | Pending |
| EVAL-02 | Phase 5 | Pending |
| EXTN-01 | Phase 5 | Pending |
| EXTN-02 | Phase 5 | Pending |
| EXTN-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after initial definition*
