# Pitfalls Research

**Domain:** Multi-agent coding orchestrator
**Researched:** 2026-03-31
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Truth-plane drift

**What goes wrong:**
Tracker comments, UI state, and local files disagree about what an issue is doing.

**Why it happens:**
Teams let convenient surfaces become de facto truth instead of preserving one owner per concern.

**How to avoid:**
Keep Beads authoritative for tasks, `.aegis/dispatch-state.json` authoritative for orchestration stage, `.aegis/mnemosyne.jsonl` authoritative for learned knowledge, and Olympus purely derived.

**Warning signs:**
- State is reconstructed from comments after restart
- The UI shows a stage that no durable file can explain
- Agents need prompt text to know what state they are in

**Phase to address:**
Phase 2 - Deterministic Dispatch Core

---

### Pitfall 2: Runtime leakage into orchestration

**What goes wrong:**
Pi-specific behavior gets baked into triage, dispatch, or monitor logic, making future runtime support brittle.

**Why it happens:**
The first runtime works, so the adapter boundary gets treated as optional.

**How to avoid:**
Force the orchestration core to talk only to the minimal runtime contract and keep provider/runtime quirks inside adapters.

**Warning signs:**
- Core modules import Pi packages directly
- Stage transitions depend on Pi-only event names
- Mixed-model support requires touching every core file

**Phase to address:**
Phase 2 - Deterministic Dispatch Core

---

### Pitfall 3: Unsafe merge autonomy

**What goes wrong:**
Titan output lands directly or Janus becomes the default route, hiding integration risk behind agent behavior.

**Why it happens:**
Teams optimize for autonomy theater instead of explicit merge safety.

**How to avoid:**
Keep a deterministic merge queue, define explicit conflict tiers, and only escalate to Janus after mechanical thresholds are exhausted.

**Warning signs:**
- Titan branches merge without queue records
- Janus appears on normal happy-path work
- Failed merges do not emit structured artifacts

**Phase to address:**
Phase 3 - Safe Integration and Messaging

---

### Pitfall 4: Browser state becoming authoritative

**What goes wrong:**
Refreshing Olympus changes what the operator thinks is true because the UI owns state instead of reflecting it.

**Why it happens:**
It is tempting to let a rich frontend cache become the main interaction model.

**How to avoid:**
Treat Olympus as a view over durable backend state delivered by HTTP and SSE, and route all actions back through the orchestrator.

**Warning signs:**
- Refresh loses or mutates stage information
- UI-only filters or queues cannot be reconciled with backend state
- Commands mutate frontend state before backend confirmation

**Phase to address:**
Phase 4 - Olympus Control Room

---

### Pitfall 5: Over-autonomy without proof

**What goes wrong:**
Concurrency, mixed models, or planning agents expand before restart recovery, budget gates, and benchmark scenarios are reliable.

**Why it happens:**
Autonomy is exciting, while eval harnesses and policy gates feel slower.

**How to avoid:**
Front-load eval scenarios, make cost/quota guardrails explicit, and require benchmark evidence before enabling more autonomy.

**Warning signs:**
- New modes ship without scenario coverage
- Budget kills surprise the operator
- Failures are diagnosed anecdotally instead of from result artifacts

**Phase to address:**
Phase 1 - Bootstrap and Benchmark Backbone, then Phase 5 - Extensible Autonomy Layers

---

### Pitfall 6: Windows path and process breakage

**What goes wrong:**
Spawning, quoting, worktree cleanup, or path normalization works on Unix-like systems but breaks on Windows shells.

**Why it happens:**
Many orchestration tools are designed around POSIX assumptions.

**How to avoid:**
Use Windows-safe path handling, validate shell semantics explicitly, and test worktree/process flows on PowerShell, cmd, and Git Bash.

**Warning signs:**
- `.bat` or `.cmd` execution fails inconsistently
- Worktree paths with spaces break
- Restart cleanup behaves differently across shells

**Phase to address:**
Phase 1 - Bootstrap and Benchmark Backbone, reinforced in Phase 2

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Encode orchestration state in comments or prompts | Fast prototype | Breaks restart recovery and observability | Never |
| Skip the eval harness until "after core features" | Faster visible features | No proof for scale/autonomy decisions | Never for this product |
| Let Titan merge directly on a green path | Simpler implementation | Hidden integration risk and no queue artifacts | Never |
| Put Olympus and orchestrator state mutations in the same frontend reducer | Quick UI wiring | UI becomes authoritative and hard to debug | Never |
| Delay Mnemosyne pruning rules | Less early design work | Prompt bloat and noisy retrieval | Only briefly during local prototyping |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Beads | Parse informal comments for state | Use structured tracker operations and explicit issue/message types |
| Pi runtime | Assume one provider or auth mode exposes exact costs | Design for exact-cost, quota, credit, and stats-only modes |
| Git worktree | Remove failed worktrees immediately | Preserve failed candidates until the queue outcome is recorded |
| SSE | Treat reconnecting clients as fully stateful | Rehydrate from current backend state, then continue streaming |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Oversized prompt context | Slow sessions, noisy agent behavior | Enforce Mnemosyne prompt budgets and artifact-first inputs | As issue context grows |
| Polling everything with no eligibility filtering | Constant busy loops and noisy status churn | Filter by ready work and session lineage | Small swarms already feel this |
| Rich UI panels backed by expensive recomputation | Olympus feels laggy or stale | Precompute summaries from durable state changes | Once several agents run concurrently |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Over-broad runtime command execution | Agents can do unsafe local actions | Bind tools and permissions through explicit stage policies |
| Mixing secrets into artifacts or Mnemosyne | Sensitive data persists in repo-local state | Redact sensitive values before writing durable artifacts |
| Browser endpoints mutating state without server validation | UI actions can bypass policy checks | Route all commands through orchestrator-side validation |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Hidden reasons for pauses or cooldowns | Operator loses trust quickly | Surface explicit cause, timer, and next action |
| Queue state without artifact links | Merge failures feel opaque | Link every queue outcome to the created issue/message artifact |
| Budget views that only show exact dollars | Subscription users cannot reason about cost | Show quota, credits, or proxy stats when exact dollars are unavailable |

## "Looks Done But Isn't" Checklist

- [ ] **Dispatch state:** Restart works without reconstructing stages from comments or memory
- [ ] **Merge queue:** Every failure produces a durable artifact, not just console output
- [ ] **Olympus:** Refreshing the browser does not invent or lose state
- [ ] **Mnemosyne:** Learnings store conventions, not telemetry or failure logs
- [ ] **Mixed-model support:** Provider selection comes from config, not prompt branching
- [ ] **Eval harness:** Named scenarios produce comparable artifacts across repeated runs

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Truth-plane drift | HIGH | Reconcile durable files, close ambiguous tracker issues, then lock state ownership rules down |
| Runtime leakage | MEDIUM | Extract an adapter boundary, add contract tests, and remove direct runtime imports from core modules |
| Unsafe merge autonomy | HIGH | Stop auto-merge, preserve candidate state, emit rework artifacts, and restore queue-only integration |
| Browser-authoritative state | MEDIUM | Rebuild UI from backend snapshots and remove frontend-only mutation paths |
| Missing eval proof | HIGH | Freeze autonomy expansion, build the required scenarios, and make release gates blocking |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Truth-plane drift | Phase 2 | Restart and recovery tests prove stages stay explicit |
| Runtime leakage | Phase 2 | Core modules compile and test against interfaces, not Pi imports |
| Unsafe merge autonomy | Phase 3 | All Titan completions enter the queue and emit queue artifacts |
| Browser state becoming authoritative | Phase 4 | Refresh and reconnect tests pass without state corruption |
| Over-autonomy without proof | Phase 1 and Phase 5 | Benchmark suite gates advanced autonomy work |
| Windows path/process breakage | Phase 1 and Phase 2 | Bootstrap and labor flows pass on PowerShell, cmd, and Unix-like shells |

## Sources

- `SPECv2.md` - canonical architecture, non-goals, and release gates
- https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html - Windows process caveats and subprocess lifecycle
- https://git-scm.com/docs/git-worktree - worktree model and cleanup operations
- https://shittycodingagent.ai/ - Pi runtime philosophy and operational modes
- https://github.com/andygeiss/beads - tracker-backed issue and message workflow

---
*Pitfalls research for: multi-agent coding orchestrator*
*Researched: 2026-03-31*
