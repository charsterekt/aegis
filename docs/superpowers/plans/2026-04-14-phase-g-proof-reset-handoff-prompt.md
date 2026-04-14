# Phase G Proof Reset Handoff Prompt

Use this prompt for next agent/session.

```text
You are continuing Aegis emergency MVP rewrite on current main.

Read first:
- docs/superpowers/specs/2026-04-13-aegis-emergency-mvp-triage-design.md
- docs/superpowers/specs/2026-04-13-aegis-emergency-triage-discovery.md
- docs/superpowers/specs/2026-04-13-aegis-emergency-deferred-items.md
- docs/superpowers/plans/2026-04-14-phase-f-merge-queue-rebuild.md

Current state:
- Phase D complete.
- Phase E complete.
- Phase F complete.
- Current operator surface includes:
  - aegis init/start/status/stop
  - aegis poll/dispatch/monitor/reap
  - aegis scout/implement/review/process
  - aegis merge next
- Queue truth lives in .aegis/merge-queue.json with atomic persistence.
- Merge targets resolve from .aegis/config.json -> git.base_branch.
- Sentinel remains post-merge only.
- Source of truth says next phase is Phase G: proof reset.

Your job:
- implement Phase G only
- keep scope tight
- do not reopen deferred systems
- do not mix in restart/requeue or other future recovery surfaces unless spec is explicitly reopened

Phase G goals from spec:
- reduce CI to deterministic seam tests
- move end-to-end proof to seeded mock-run acceptance

Likely deliverables:
- review current test suite against seam-only CI contract
- remove or reshape any tests that still depend on brittle installable/local-environment behavior
- tighten mock-run proof instructions and acceptance notes where Phase G needs them
- update docs so proof expectations, CI scope, and handoff notes match reality exactly

Rules:
- no in-place mutation of dispatch or merge state records
- use atomic writes for durable state and artifacts
- keep tracker semantics generic
- preserve clear boundaries: poller, triage, dispatcher, monitor, reaper, runtime, merge, tracker
- prefer deterministic seam tests over brittle git-conflict or installable simulations
- keep names generic, but push toward more self-documenting and readable identifiers; do not encode temporary phase/doc/branch names in shipped code or persisted config
- leave exact naming interpretation to the implementing agent if a cleaner generic name is warranted

Good verification target:
- npm test
- npm run build
- npm run lint
- seeded mock-run proof only where Phase G changes proof expectations or scripts

Bad scope drift:
- UI / SSE / browser work
- economics / budgets / quotas
- Mnemosyne / Lethe
- Beads-native messaging
- eval harness / benchmark corpus
- restart/requeue implementation
- broad architecture cleanup not required for Phase G

Success shape:
- PR diff is only Phase G proof-reset cleanup
- CI surface stays deterministic
- mock-run proof expectations are explicit and reproducible
- docs and handoff state match implementation exactly
```
