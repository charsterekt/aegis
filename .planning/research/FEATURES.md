# Feature Research

**Domain:** Multi-agent coding orchestrator
**Researched:** 2026-03-31
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Deterministic dispatch state | Orchestrators are not credible if restart or refresh loses work position | HIGH | Must be persisted outside tracker comments |
| Tracker-backed task lifecycle | Operators expect tasks, blockers, and generated follow-up work to stay visible in one tracker | HIGH | Beads stays authoritative for task truth |
| Runtime-backed agent execution | The system must actually scout, implement, and review issues | HIGH | Pi is the launch runtime |
| Git-isolated implementation workspaces | Multi-agent coding requires safe branch/worktree isolation | HIGH | Labor lifecycle is core, not optional |
| Mechanical merge queue | Safe integration is central to the value proposition | HIGH | Merge outcomes must become explicit artifacts |
| Browser control room | A swarm controller without visibility is not operable | MEDIUM | Olympus is primary, terminal is secondary |
| Budget and failure guardrails | Users expect autonomy limits, cooldowns, and stuck handling before they trust automation | HIGH | Must work even when exact dollar metering is unavailable |
| Eval harness and release gates | The product explicitly promises "evaluate before scale" | HIGH | Needs named scenarios and machine-readable artifacts |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Explicit truth-plane separation | Makes the system legible and debuggable by a single developer | HIGH | Beads, dispatch state, Mnemosyne, and Olympus stay distinct |
| Post-merge Sentinel by default | Reviews what actually landed and keeps merge flow mechanical | MEDIUM | Strong architectural differentiator |
| Janus as escalation-only integration caste | Preserves deterministic happy path while still handling ugly merges | HIGH | Must remain the minority path |
| Sparse Beads-native messaging | Keeps coordination visible without turning the system into chatware | MEDIUM | Good fit for artifact-first coordination |
| Scope-overlap protection before Titan dispatch | Prevents avoidable merge collisions mechanically | HIGH | Important concurrency differentiator |
| Optional Metis and Prometheus layers | Adds steering and planning without making LLM control mandatory | HIGH | Must stay bounded by explicit modes |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Distributed message bus inside Aegis | Sounds scalable and "enterprise" | Creates a second control substrate and obscures truth ownership | Keep Beads messages sparse and typed |
| LLM-driven merge decisions on the happy path | Feels more autonomous | Hides risk and makes integration behavior unpredictable | Keep the merge queue mechanical and escalate only when thresholds are met |
| Terminal-only operator control | Quick to prototype | Blocks the browser-first promise and reduces observability | Build Olympus early and keep CLI as a companion |
| WebSocket-first live state | Feels more "real-time" | Adds protocol and reconnect complexity without clear MVP value | Start with SSE |

## Feature Dependencies

```text
[Browser control room]
    `--requires--> [HTTP server + SSE]
                       `--requires--> [Deterministic dispatch state]

[Mechanical merge queue]
    `--requires--> [Git worktree labors]
                       `--requires--> [Runtime-backed Titan execution]

[Post-merge Sentinel]
    `--requires--> [Mechanical merge queue]

[Mixed-model pipelines]
    `--requires--> [Runtime adapter contract]
                       `--requires--> [Deterministic dispatch core]

[Prometheus planning]
    `--enhances--> [Tracker-backed task lifecycle]

[Distributed message bus]
    `--conflicts--> [Single source of truth per concern]
```

### Dependency Notes

- **Browser control room requires HTTP/SSE and durable state:** the UI can only be non-authoritative if the backend already owns explicit state.
- **Mechanical merge requires labors:** safe integration assumes isolated working directories and preserved candidate branches.
- **Post-merge Sentinel requires the queue:** review placement only works if candidates land through one controlled path.
- **Mixed-model swarms require the adapter boundary first:** otherwise provider logic leaks into the orchestrator core.

## MVP Definition

### Launch With (v1)

- [ ] Deterministic dispatch, monitoring, restart recovery, and direct commands - core trust contract
- [ ] Pi-backed Oracle/Titan/Sentinel execution in isolated labors - minimum end-to-end worker flow
- [ ] Merge queue with explicit outcomes and Janus escalation thresholds - integration safety
- [ ] Olympus status surface with live SSE updates and control actions - operator visibility
- [ ] Budget, cooldown, stuck-detection, and policy guardrails - safe autonomy
- [ ] Eval harness with named scenarios and release thresholds - proof before scale

### Add After Validation (v1.x)

- [ ] Rich Olympus panels for budget charts, event timeline, Mnemosyne, and eval history - once the core loop is trustworthy
- [ ] Beads-native messaging polish and event-ingest freshness improvements - once baseline polling is correct

### Future Consideration (v2+)

- [ ] Alternate per-issue pipelines such as pre-merge review for special categories - useful, but not the launch default
- [ ] Semantic Mnemosyne retrieval - only when keyword retrieval genuinely stops being enough
- [ ] First-run browser wizard - nice operator UX, but not required to prove the architecture

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Deterministic dispatch state | HIGH | HIGH | P1 |
| Pi-backed agent execution | HIGH | HIGH | P1 |
| Git worktree labors | HIGH | HIGH | P1 |
| Merge queue + Janus thresholds | HIGH | HIGH | P1 |
| Olympus live control room | HIGH | MEDIUM | P1 |
| Budget and cooldown guardrails | HIGH | MEDIUM | P1 |
| Eval harness | HIGH | HIGH | P1 |
| Sparse Beads-native messaging | MEDIUM | MEDIUM | P2 |
| Rich Olympus analytics panels | MEDIUM | MEDIUM | P2 |
| Mixed-model swarms | MEDIUM | HIGH | P2 |
| Prometheus planning layer | MEDIUM | HIGH | P2 |
| Semantic Mnemosyne retrieval | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have after the core loop is trustworthy
- P3: Future consideration

## Competitor Feature Analysis

| Capability | Thin tracker-backed orchestrators | Chat-native swarm wrappers | Our Approach |
|------------|-----------------------------------|----------------------------|--------------|
| Task truth | Often partial or externalized | Frequently mixed into chat state | Beads remains authoritative |
| Orchestration truth | Sometimes implicit | Often inferred from conversation | Local dispatch state is explicit |
| Merge safety | Varies widely | Often manual or ad hoc | Mandatory deterministic merge queue |
| Operator visibility | Usually terminal-heavy | Often chat-log heavy | Browser-first Olympus control room |
| Autonomy limits | Mixed | Often vague | Budget, cooldown, and eval guardrails are product features |

## Sources

- `SPECv2.md` - canonical feature set, non-goals, and phased implementation plan
- `package.json` - current runtime baseline
- https://github.com/andygeiss/beads - tracker capabilities and message-friendly issue model
- https://shittycodingagent.ai/ - Pi runtime modes and extension philosophy
- https://git-scm.com/docs/git-worktree - worktree model for safe isolation
- https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html - subprocess orchestration behavior

---
*Feature research for: multi-agent coding orchestrator*
*Researched: 2026-03-31*
