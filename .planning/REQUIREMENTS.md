# Requirements: Aegis

**Defined:** 2026-03-27
**Core Value:** The dispatch loop stays deterministic and understandable — no magic, no hidden state. If the orchestrator crashes, it recovers fully from persistent dispatch state plus the issue tracker.

## v1 Requirements

### Dispatch Store

- [x] **STORE-01**: Orchestrator maintains a persistent `DispatchRecord` state machine in `.aegis/dispatch-state.json`
- [x] **STORE-02**: State file is written atomically (write to `.tmp`, rename over target) on every transition
- [x] **STORE-03**: `dispatch-store.ts` is the only module that reads or writes `dispatch-state.json`
- [x] **STORE-04**: `DispatchRecord` has typed `stage` field: `pending | scouting | scouted | implementing | implemented | reviewing | complete | failed`
- [x] **STORE-05**: `DispatchRecord` stores `oracle_assessment`, `sentinel_verdict`, `failure_count`, `last_failure_at`, `current_agent_id`, timestamps

### Triage

- [ ] **TRIAGE-01**: Triage reads `DispatchRecord.stage` from dispatch store to determine dispatch action — no issue tracker comment parsing
- [ ] **TRIAGE-02**: `SCOUTED:` and `REVIEWED:` comment prefix logic fully removed from triage path
- [ ] **TRIAGE-03**: Triage rules match spec: `pending` → Oracle, `scouted+ready` → Titan, `implemented` → Sentinel, active stages → skip, `complete`/`failed` → skip

### Conversational Mode

- [ ] **MODE-01**: Orchestrator starts idle by default — no polling, no automatic dispatch on startup
- [ ] **MODE-02**: `auto on` command activates the POLL → TRIAGE → DISPATCH → MONITOR → REAP loop
- [ ] **MODE-03**: `auto off` / `pause` command stops the polling loop and returns to idle
- [ ] **MODE-04**: `scout <issue-id>` command dispatches an Oracle for the specified issue
- [ ] **MODE-05**: `implement <issue-id>` command dispatches a Titan for the specified issue (bypasses Oracle if unscouted)
- [ ] **MODE-06**: `review <issue-id>` command dispatches a Sentinel for the specified issue
- [ ] **MODE-07**: `process <issue-id>` command runs the full Oracle → Titan → Sentinel cycle for one issue
- [ ] **MODE-08**: `status` command reports current agent state and queue to the caller

### Structured Outputs

- [ ] **OUTPUT-01**: Orchestrator parses Oracle's final message for a valid `OracleAssessment` JSON object (`files_affected`, `estimated_complexity`, `decompose`, `sub_issues?`, `blockers?`, `ready`)
- [ ] **OUTPUT-02**: On Oracle success, dispatch state transitions to `stage=scouted` with assessment stored; on failure (no valid JSON or budget exceeded) transitions to `stage=failed`
- [ ] **OUTPUT-03**: If Oracle assessment has `decompose=true`, orchestrator auto-creates sub-issues from `sub_issues[]` and links them as dependencies
- [ ] **OUTPUT-04**: If Oracle assessment has `estimated_complexity=complex`, orchestrator emits `orchestrator.complex_issue` event and (in conversational mode) awaits confirmation before dispatching Titan
- [ ] **OUTPUT-05**: Orchestrator parses Sentinel's final message for a verdict JSON object (`verdict: "pass" | "fail"`, `summary`, `issues?`)
- [ ] **OUTPUT-06**: Sentinel `pass` transitions dispatch state to `stage=complete`; Sentinel `fail` transitions to `stage=failed` with `sentinel_verdict=fail` and files fix issues
- [ ] **OUTPUT-07**: Sentinel producing no valid verdict is treated as a Sentinel failure; issue is re-queued for another review

### Crash Recovery

- [ ] **CRASH-01**: On startup, orchestrator loads `dispatch-state.json` and identifies records with stage `scouting`, `implementing`, or `reviewing` that have no currently running agent
- [ ] **CRASH-02**: Interrupted in-flight records are transitioned to `stage=failed` and their issues are reopened in the tracker
- [ ] **CRASH-03**: Records with `stage=implemented` survive the crash and are picked up by triage for Sentinel dispatch on next tick

### Config v2

- [x] **CONFIG-01**: Config schema includes `version: 2` field; `aegis init` writes v2 config
- [x] **CONFIG-02**: Config includes `runtime` field (default: `"pi"`) identifying which adapter to use
- [x] **CONFIG-03**: Oracle budgets updated to 10 turns / 80k tokens (from previous 8 turns)
- [x] **CONFIG-04**: `aegis init` appends `dispatch-state.json` to `.gitignore` (runtime state — not committed)

### Olympus Dashboard

- [ ] **DASH-01**: React 18 SPA built with Vite and Tailwind CSS, served as static assets by the orchestrator's HTTP server
- [ ] **DASH-02**: Dashboard connects to orchestrator via SSE and displays real-time agent state
- [ ] **DASH-03**: Agent card for each active agent showing: agent ID, caste badge (Oracle/Titan/Sentinel), model name, issue ID and title, turn counter (e.g., "7/20"), token count, elapsed time, cost so far
- [ ] **DASH-04**: Agent cards are color-coded by caste (Oracles blue, Titans amber, Sentinels green)
- [ ] **DASH-05**: Kill button on each agent card dispatches `kill <agent-id>` command
- [ ] **DASH-06**: Completed agent cards remain visible for 30 seconds before fading
- [ ] **DASH-07**: Top bar displays orchestrator status (idle/running/auto), active agent count, total cost, uptime, queue depth, and auto mode toggle
- [ ] **DASH-08**: Command bar fixed at bottom: text input, enter to submit, response area displays command result
- [ ] **DASH-09**: Command bar pattern-matches direct commands without LLM: `scout`, `implement`, `review`, `process`, `kill`, `pause`, `resume`, `auto on/off`, `status`, `restart`, `focus`, `add_learning`

### First-Run Setup

- [ ] **SETUP-01**: When no `.aegis/config.json` exists, Olympus shows a first-run setup wizard instead of the dashboard
- [ ] **SETUP-02**: Wizard step 1: API key entry (Anthropic required, others optional)
- [ ] **SETUP-03**: Wizard step 2: model assignment per caste (Oracle, Titan, Sentinel) with defaults pre-filled
- [ ] **SETUP-04**: Wizard step 3: concurrency limit slider (max agents, per-caste limits)
- [ ] **SETUP-05**: Wizard step 4: prerequisite checks — verifies `bd` CLI and `git` are in PATH
- [ ] **SETUP-06**: Wizard completion writes `.aegis/config.json` and transitions to the main dashboard

## v2 Requirements

### Post-MVP Dashboard

- **POSTDASH-01**: Issue board — kanban-style view (Ready → Scouting → Implementing → Reviewing → Done)
- **POSTDASH-02**: Cost and performance panel — line/bar charts for cost over time, cost by caste, token burn rate
- **POSTDASH-03**: xterm.js agent output — click-to-expand full streaming terminal per agent
- **POSTDASH-04**: Event timeline — scrolling SSE event log with filtering
- **POSTDASH-05**: Mnemosyne sidebar — filterable learnings list with add/remove

### Post-MVP Orchestration

- **META-01**: Metis — natural language command interpreter (cheap model routes NL to direct commands)
- **PROM-01**: Prometheus — strategic planner (expensive model decomposes goals into issue sets)
- **RAG-01**: RAG-based Mnemosyne retrieval using local embeddings (needed at >200 records)

### Post-MVP Runtime

- **ADAPT-01**: `ClaudeCodeRuntime` adapter
- **ADAPT-02**: `OllamaRuntime` adapter for local models
- **ADAPT-03**: Mixed-model swarms (cheap local for scouting, cloud for implementation)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Inter-agent messaging | No established need; assess during implementation if required |
| Metis NL interpreter | Post-MVP; direct commands sufficient for MVP |
| Prometheus strategic planner | Post-MVP; manual issue creation is fine for MVP |
| Multi-runtime adapters | Post-MVP; Pi adapter covers current use case |
| xterm.js agent terminal | Post-MVP dashboard feature |
| Kanban issue board | Post-MVP dashboard feature |
| Cost/performance charts | Post-MVP dashboard feature |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONFIG-01 | Phase 1 | Complete |
| CONFIG-02 | Phase 1 | Complete |
| CONFIG-03 | Phase 1 | Complete |
| CONFIG-04 | Phase 1 | Complete |
| STORE-01 | Phase 1 | Complete |
| STORE-02 | Phase 1 | Complete |
| STORE-03 | Phase 1 | Complete |
| STORE-04 | Phase 1 | Complete |
| STORE-05 | Phase 1 | Complete |
| TRIAGE-01 | Phase 2 | Pending |
| TRIAGE-02 | Phase 2 | Pending |
| TRIAGE-03 | Phase 2 | Pending |
| CRASH-01 | Phase 2 | Pending |
| CRASH-02 | Phase 2 | Pending |
| CRASH-03 | Phase 2 | Pending |
| MODE-01 | Phase 3 | Pending |
| MODE-02 | Phase 3 | Pending |
| MODE-03 | Phase 3 | Pending |
| MODE-04 | Phase 3 | Pending |
| MODE-05 | Phase 3 | Pending |
| MODE-06 | Phase 3 | Pending |
| MODE-07 | Phase 3 | Pending |
| MODE-08 | Phase 3 | Pending |
| OUTPUT-01 | Phase 4 | Pending |
| OUTPUT-02 | Phase 4 | Pending |
| OUTPUT-03 | Phase 4 | Pending |
| OUTPUT-04 | Phase 4 | Pending |
| OUTPUT-05 | Phase 4 | Pending |
| OUTPUT-06 | Phase 4 | Pending |
| OUTPUT-07 | Phase 4 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| DASH-04 | Phase 5 | Pending |
| DASH-05 | Phase 5 | Pending |
| DASH-06 | Phase 5 | Pending |
| DASH-07 | Phase 5 | Pending |
| DASH-08 | Phase 5 | Pending |
| DASH-09 | Phase 5 | Pending |
| SETUP-01 | Phase 5 | Pending |
| SETUP-02 | Phase 5 | Pending |
| SETUP-03 | Phase 5 | Pending |
| SETUP-04 | Phase 5 | Pending |
| SETUP-05 | Phase 5 | Pending |
| SETUP-06 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 — traceability populated after roadmap creation*
