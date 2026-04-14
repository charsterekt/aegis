# Aegis Emergency Triage Discovery Log

Date: 2026-04-13
Status: Complete
Purpose: Capture the emergency triage context, every clarifying question asked, the user's answer, and the working decisions that will shape the later triage plan.

## Context snapshot

- User reports severe architectural and behavioral drift after hundreds of commits.
- Current direction is not incremental fixing. The goal is to audit, strip the system to minimum viable orchestration, and re-establish correct wiring end to end.
- Olympus is no longer considered part of the emergency MVP.
- Emergency MVP must work end to end in the terminal so AI agents can inspect execution using logs, processes, artifacts, and direct commands.
- Mock-run repo flow must be part of the proof surface.
- Rich error handling and strict phase/caste enforcement are required.
- Cost tracking, budget limits, SSE, and other non-essential visibility layers are considered fluff for this triage effort and are candidates for removal.

## Early repo findings

- `SPECv2.md` is still present at the repo root and remains the canonical product document.
- `AGENTS.md` still references `plandocs/2026-04-03-aegis-mvp-tracker.md` and `plandocs/codebase-structure.md`.
- Those referenced files were deleted on `main` in commit `0569be9 chore: remove stale docs`.
- This is already concrete process drift between the repository instructions and the live tree.
- Current startup and observability wiring still runs through HTTP server and live event bus infrastructure.
- Current ready work in Beads is still focused on Olympus session visibility and Pi tool-calling reliability, which supports the user's claim that effort has been orbiting symptoms rather than proving the core path.

## Questions and answers

### Q1

Question:
What is the exact minimum acceptance path that must work before the strip-down is considered successful?

Options presented:
- `bd ready` issue -> Oracle -> Titan -> merge queue -> Sentinel -> issue closed, all observable from CLI/logs only.
- Same path but stopping at `merged`.
- Oracle -> Titan only.
- Different target.

User answer:
Option 1, with additional requirements:
- dispatch loop phases must log clearly: `poll`, `dispatch`, `monitor`, `reap`
- each agent caste must pull its weight
- mock repo flow must work and display seeded Beads slice parallelism
- remove cost tracking, budget limits, and related economics features
- replace them with rich error handling and strict enforcement between phases and castes
- Janus should work for the minimal path too
- delete all Olympus work
- strip tests down to preflight, error handling, core caste behavior, and dispatch loop behavior
- remove random tests and tests that depend on local `bd` installation in ways that are ignored on CI
- anything not immediately exposed by Pi SDK and future SDKs is not needed for MVP
- MVP must be the full orchestrator loop with all castes and merge queue working, with observable phase-level execution and strict handoff enforcement
- remove SSE and similar infrastructure for now

Working decision:
The emergency MVP target is a terminal-first, fully working orchestration loop, not a UI-bearing MVP.

### Q2

Question:
For the stripped MVP, should Aegis be a long-running terminal daemon or a pure command-driven CLI?

Options presented:
- Long-running daemon
- Pure command CLI
- Hybrid: keep `start`, but make loop phases directly invokable too

User answer:
Option 3. The goal is the long-running process from option 1, but option 3 observability is required.

Working decision:
Keep `start/status/stop` as the primary operating surface, and also expose phase-level direct commands so QA agents can isolate failures without the server layer.

### Q3

Question:
What should the runtime-to-caste handoff contract be for the stripped MVP?

Options presented:
- Strict final JSON only
- Tool-first with JSON fallback
- Tool-required only

User answer:
"2 or 3 whatever is easier"

Working decision:
Standardize on tool-first with strict JSON fallback.
Reason:
- lower implementation risk
- matches current model reality better
- keeps structured handoff enforcement
- avoids making MVP depend on perfect tool-call reliability

### Q4

Question:
How hard does Janus need to be baked into the acceptance proof?

Options presented:
- same acceptance run must include a deterministic Janus scenario
- separate acceptance run
- supported but not gate-blocking

User answer:
Option 1.

Working decision:
Acceptance proof must include at least one deterministic Janus path in the seeded mock repo flow, not just the clean happy path.

### Q5

Question:
In the emergency MVP, what exactly should Oracle still be allowed to do?

Options presented:
- assessment only
- limited orchestration
- full planner behavior

User answer:
Option 3.

Working decision:
Oracle remains a real planning/scouting caste in the emergency MVP.
It is still allowed to decompose work, create child issues, and reshape the issue graph dynamically during runs.

### Q6

Question:
Which persisted state planes survive the strip-down exactly as first-class MVP concerns?

Options presented:
- keep only dispatch state and merge queue
- keep dispatch state, merge queue, and Mnemosyne in a reduced form
- keep all current `.aegis/*` persistence surfaces

User answer:
Option 1 sounds good.

Working decision:
The emergency MVP persistence model keeps only:
- `.aegis/dispatch-state.json`
- `.aegis/merge-queue.json`

Mnemosyne is out of scope for the emergency MVP and should not remain as a first-class persistence concern.

### Q7

Question:
What should happen to the HTTP server layer in the emergency MVP?

Options presented:
- remove it entirely
- keep a tiny local control server only for `status/stop` and process ownership
- keep the current server skeleton, but strip UI/SSE/dashboard behavior and use it only as an internal transport

User answer:
Option 3, because it seems easier and gives a better path upward to the eventual interface.

Working decision:
Keep the server skeleton only as a thin internal/control surface.
Constraints:
- no Olympus UI
- no SSE/dashboard state transport
- no browser-first assumptions
- it must not remain the orchestration spine
- terminal logs, durable artifacts, and direct commands remain the primary observability surface

### Q8

Question:
What logging model should be the canonical observability surface for the emergency MVP?

Options presented:
- human-readable terminal logs only
- terminal logs plus durable structured phase logs under `.aegis/logs/`
- structured logs only

User answer:
Option 2 sounds good.

Working decision:
Canonical observability for the emergency MVP is:
- live human-readable terminal logs
- durable structured logs under `.aegis/logs/`
- persisted state/artifacts for dispatch and merge behavior

Terminal output is the live surface.
Structured logs are the durable QA/debug surface.

### Q9

Question:
What exact direct command surface should survive for phase-by-phase debugging in the emergency MVP?

Options presented:
- keep only high-level commands
- add loop-phase commands plus caste and queue commands
- expose nearly every internal step as a command

User answer:
"whichever option offers the best future debugging route for automated hands off qa"

Working decision:
Standardize on the middle path:
- loop-phase commands for `poll`, `dispatch`, `monitor`, `reap`
- caste commands for `scout`, `implement`, `review`, `process`
- merge-queue level commands such as `merge next`

Reason:
- enough precision for automated handoff QA and operator debugging
- avoids a sprawling CLI that mirrors every internal helper
- keeps a clear mapping between observable system phases and explicit commands

### Q10

Question:
What should the automated test strategy be for the emergency MVP?

Options presented:
- CI uses only deterministic tests with fake seams; live `bd` and live runtime acceptance stays outside CI
- CI includes a small number of real `bd` tests
- CI runs seeded mock repo flows end to end with real installables

User answer:
Option 1.
Additional direction:
- never simulate installables in CI tests
- mock runs are for the user and QA agents

Working decision:
Emergency MVP test strategy:
- CI runs deterministic tests only
- CI uses fake seams for tracker/runtime/process boundaries
- no dependency on local `bd` installation in CI
- no live runtime acceptance in CI
- seeded mock-run flows are reserved for user-level and QA-agent acceptance

### Q11

Question:
For a successful mock-run acceptance, what artifacts must a QA agent be able to inspect afterward without rerunning anything?

Options presented:
- logs plus final state only
- logs plus final state plus caste artifacts
- add full process transcript capture

User answer:
"whichever is the minimum necessary to pinpoint bugs along the full run or confirm behaviour - whatever is verbose enough without causing model drift"

Working decision:
Standardize on logs plus final state plus caste artifacts.

Required acceptance evidence should include:
- `.aegis/logs/`
- `.aegis/dispatch-state.json`
- `.aegis/merge-queue.json`
- final `bd` issue states
- Oracle assessment artifacts
- Titan handoff/clarification artifacts
- Sentinel verdict/fix artifacts
- Janus resolution or manual-decision artifacts when Janus is invoked

Explicitly not required by default:
- full raw prompt/message transcript capture for every session

Reason:
- enough evidence to pinpoint bugs and confirm full-run behavior
- avoids turning the MVP into a transcript-heavy archive that adds noise and drift

### Q12

Question:
Should raw agent message transcripts be persisted only on failure paths?

Options presented:
- never persist raw transcripts
- persist only on failure or handoff-validation failure
- always persist raw transcripts

User answer:
Option 2.
Additional direction:
- this should expose failures such as auth and rate-limit errors when invoking agents/models
- when a run is complete, especially mock runs, treat these as ephemeral and remove logs except in real projects

Working decision:
Raw agent transcripts are failure-only artifacts.

Retention policy:
- persist transcripts only when a caste run fails, artifact parsing fails, or handoff validation fails
- use them for runtime/provider/model failure diagnosis
- treat them as ephemeral by default
- mock runs should clean them up after successful completion
- real projects may retain them longer according to the eventual project-level policy

### Q13

Question:
For the seeded Beads graph, should Aegis understand the slice structure as a first-class orchestration rule, or just follow generic Beads readiness and dependencies?

Options presented:
- first-class slice semantics
- generic dependency engine only
- hybrid generic dispatch with slice-aware validation/logging

User answer:
Option 2.
Additional direction:
- generic because future trackers may differ
- future Aegis-specific issue systems or GitHub issues may be used
- Beads graphs may differ heavily across projects
- naming conventions are not reliable

Working decision:
Aegis remains tracker-generic at the orchestration layer.

Implications:
- Beads readiness and dependency truth remain the dispatch input
- no slice-specific orchestration semantics should be hardcoded
- no orchestration logic should depend on naming conventions or title formats
- future tracker adapters should be able to preserve the same deterministic orchestration core

### Q14

Question:
How aggressive should the config strip-down be for the emergency MVP?

Options presented:
- hard strip-down
- soft strip-down
- compatibility-first

User answer:
Option 1, hard strip.
Additional direction:
- remove everything that is not strictly necessary for a successful end-to-end run
- build back upward later

Working decision:
Emergency MVP config should be hard-stripped.

Only the minimum necessary configuration should remain, covering areas such as:
- runtime selection
- model references
- concurrency and loop control thresholds
- Janus enablement and minimal Janus behavior controls
- labor path / working-directory basics
- thin server/process-control basics

Economics, UI-facing, eval-heavy, and other non-essential config surfaces should be removed rather than merely ignored.

### Q15

Question:
Once budgets and economics are stripped out, what should `monitor` and `reap` still be responsible for in the emergency MVP?

Options presented:
- minimal lifecycle only
- lifecycle plus enforcement
- collapse them into the dispatch loop

User answer:
"whichever their original purposes were according to the spec. the core dispatch loop needs to stay what it was defined to be, and everything else be built around that"

Working decision:
Preserve `monitor` and `reap` as distinct first-class dispatch-loop phases, aligned to their original spec roles.

Spec-aligned reduced responsibilities:
- `monitor` remains the in-flight deterministic supervisor
- `reap` remains the terminal outcome/artifact verifier and cleanup handoff phase

Emergency MVP interpretation:
- remove economics- and UI-driven responsibilities
- keep liveness/stuck/timeout style supervision in `monitor`
- keep required-artifact verification, failure classification, concurrency reclamation, and cleanup/next-step handoff in `reap`
- do not collapse these concerns into the dispatch loop body

Rationale:
- the dispatch loop structure itself is part of the intended architecture
- strip-down should remove drift and fluff, not erase the core operating model

### Q16

Question:
What should happen to the runtime adapter boundary in the emergency MVP?

Options presented:
- preserve the minimal `AgentRuntime` abstraction and keep Pi as the only real adapter
- collapse to Pi-only internals everywhere
- preserve the abstraction and also keep a tiny deterministic fake adapter for CI seam tests

User answer:
Option 3, but only have the fake if necessary; otherwise go with 1.

Working decision:
Preserve the minimal `AgentRuntime` abstraction.

Implementation bias:
- Pi remains the only real runtime adapter in the emergency MVP
- a tiny deterministic fake adapter is allowed only if it materially improves deterministic CI seam tests
- do not widen the abstraction beyond what the stripped orchestrator loop actually needs

### Q17

Question:
Should the tracker boundary get the same treatment?

Options presented:
- preserve a minimal tracker abstraction with Beads as the only real implementation
- collapse to Beads CLI internals everywhere
- preserve the abstraction and allow a tiny fake tracker for deterministic CI seam tests

User answer:
Same as before, option 3 but only if fake is necessary, else 1.

Working decision:
Preserve the minimal tracker abstraction.

Implementation bias:
- Beads remains the only real tracker implementation in the emergency MVP
- a tiny deterministic fake tracker is allowed only if it materially improves deterministic CI seam tests
- avoid abstraction growth beyond what the stripped orchestration loop actually needs

### Q18

Question:
Should explicit recovery commands be part of the emergency MVP command surface?

Options presented:
- yes, include a bounded recovery family
- no, keep MVP forward-only
- minimal recovery only

User answer:
Option 3 unless QA would really benefit from option 1.
Additional direction:
- with the planned logging surface, debugging a failure may often be enough

Working decision:
Bias toward minimal explicit recovery commands only.

Current expectation:
- allow a narrow recovery surface such as `restart <issue>` and `requeue <issue>` only for known recoverable states
- do not add a broad recovery command family by default
- rely on rich logs and deterministic artifacts to make failures debuggable without proliferating recovery verbs

### Q19

Question:
Should the emergency MVP still support auto mode processing the whole ready queue concurrently, or should concurrency be deliberately narrower until the wiring is proven?

Options presented:
- keep bounded concurrency from the start
- prove single-issue correctness first, then widen concurrency later
- keep auto mode but default to concurrency 1

User answer:
Option 1.

Working decision:
Bounded concurrency remains part of the emergency MVP target from the start.

Implications:
- the stripped loop must still support parallel processing of ready work
- the mock-run proof should visibly demonstrate parallelism
- concurrency must remain deterministic and bounded rather than aspirational

### Q20

Question:
How aggressive should the codebase reduction be at the file/module level?

Options presented:
- preserve the main architectural module names and boundaries from the spec, but rewrite internals aggressively
- collapse aggressively into fewer files/modules
- preserve only top-level boundaries and merge/delete the rest

User answer:
Option 1.
Additional direction:
- rewrite aggressively
- still follow good code splitting and good practice
- the codebase must be understandable at a glance
- no spaghetti

Working decision:
Preserve the main architectural module names and core boundaries from the spec:
- `poller`
- `triage`
- `dispatcher`
- `monitor`
- `reaper`
- `runtime`
- `merge`

But aggressively rewrite internals where needed to restore clarity and correctness.

Quality bar:
- understandable at a glance
- clean responsibility boundaries
- no spaghetti recovery patchwork

### Q21

Question:
When Oracle decomposes an issue in the emergency MVP, what should happen to the parent issue immediately?

Options presented:
- parent stays open but becomes blocked on the derived children
- parent closes immediately
- parent stays dispatchable alongside children

User answer:
"whichever is easiest but makes the most logical sense given what we want to achieve"

Working decision:
Parent stays open but becomes blocked on the derived children.

Reason:
- matches the canonical planning lineage
- preserves the parent as the supervising work item
- prevents duplicate execution paths where both parent and children dispatch
- fits the emergency MVP goal of deterministic, inspectable orchestration

### Q22

Question:
For the Janus part of the acceptance proof, what outcome should count as "working"?

Options presented:
- Janus must successfully resolve and requeue at least one conflict
- Janus counts as working if it either requeues safely or emits a correct manual-decision artifact
- acceptance should include both a requeue case and a manual-decision case

User answer:
Option 2.

Working decision:
Janus is considered working in the emergency MVP if it does either of the following correctly:
- resolves a merge-boundary issue safely enough to requeue for a fresh mechanical merge pass
- emits a correct manual-decision artifact when ambiguity or policy conflict means it should not proceed automatically

### Q23

Question:
Should Sentinel remain strictly post-merge in the emergency MVP, or is pre-merge review acceptable if it simplifies recovery?

Options presented:
- keep Sentinel strictly post-merge
- allow pre-merge review during triage
- skip Sentinel on clean-path MVP

User answer:
Option 1.

Working decision:
Sentinel remains strictly post-merge in the emergency MVP.

Reason:
- keeps the merge queue as the integration authority
- stays aligned with the spec
- avoids introducing a second review/integration checkpoint during triage

### Q24

Question:
When a caste fails in the emergency MVP, what should be the default policy for the originating issue?

Options presented:
- mark dispatch failed, keep the Beads issue open, and only create follow-up issues when the caste specifically requires it
- always create a new failure issue
- close the original issue and replace it with generated failure work

User answer:
- mark dispatch failure
- leave the Beads issue open
- user asked whether a new agent can just retry the open issue

Working decision:
Default failure policy:
- mark the dispatch record as failed
- keep the originating Beads issue open
- allow the same open issue to be retried when the failure is operational/transient rather than semantic

Generated follow-up issues should be reserved for workflow-significant outcomes such as:
- Oracle decomposition/prerequisite discovery
- Titan clarification work
- Sentinel fix work
- Janus manual-decision or conflict-derived follow-up artifacts/issues when appropriate

### Q25

Question:
Should transient runtime failures be retried automatically by Aegis, or only via explicit command after inspection?

Options presented:
- automatic bounded retry for transient failures
- no automatic retry
- hybrid: retry only for a narrow allowlist of operational failures

User answer:
Hybrid.
Additional direction:
- with rich error logs, Aegis should exit/fail closed on things like rate limits, bad auth, invalid models, and similar systemic setup/provider failures because the rest may also fail
- otherwise retry

Working decision:
Retry policy should be hybrid and failure-class aware.

Desired behavior:
- retry automatically only for a narrow allowlist of transient operational failures
- fail closed on systemic/runtime-configuration/provider failures that are likely to poison the rest of the run
- preserve rich error logs so the failure class is inspectable by the user or QA agent

### Q26

Question:
Should Oracle’s current "complexity gate" survive the emergency MVP?

Options presented:
- yes, keep the gate and require explicit human action for complex work
- no, strip it out
- keep a reduced version

User answer:
Keep it, but with an important correction:
- this behavior is expected in auto mode too
- auto mode is effectively the only mode now
- if the work is complex enough, Oracle should decompose it

Working decision:
Keep Oracle complexity handling, but reinterpret it for the emergency MVP:
- Oracle still assesses complexity
- complex work in auto mode should preferentially decompose into child work rather than flow straight to Titan
- human pause/escalation is still available when Oracle cannot safely decompose or the requirements remain genuinely ambiguous

This is not a simple "human approval gate" anymore; it is primarily an orchestration-shaping gate.

### Q27

Question:
Should the emergency MVP still keep a distinct conversational/idle mode at all?

Options presented:
- no, strip to one real operating mode
- yes, keep idle/conversational as a first-class concept
- hybrid: keep it internally but not as a first-class operator concern

User answer:
"whichever better aligns with the fact we decided that almost every individual phase or behaviour will be able to be run with its own command"

Working decision:
Strip to one real operating posture for the emergency MVP.

Interpretation:
- no distinct conversational/idle mode as a first-class product concept
- the daemon’s normal posture is auto processing
- manual/debug/inspection behavior comes from direct phase and caste commands rather than a separate conversational mode

This keeps the operating model simpler while preserving rich manual control through explicit commands.

### Q28

Question:
When the daemon detects a systemic runtime/provider/configuration failure, what should happen to the rest of the auto loop?

Options presented:
- fail closed globally
- contain it to the issue/session only
- hybrid: fail globally only for clearly global failures

User answer:
For now, fail global.

Working decision:
In the emergency MVP, clearly systemic runtime/provider/configuration failures should stop new dispatches globally.

Reason:
- prevents the orchestrator from compounding known-bad runs
- matches the terminal-first recovery posture
- keeps failure interpretation simple during the strip-down phase

### Q29

Question:
When you say "delete all of Olympus work," should that mean a real repository deletion target?

Options presented:
- remove the `olympus/` workspace and all related UI/SSE/dashboard code and tests
- keep it parked but detached
- keep files for reference only

User answer:
Option 1.
Additional direction:
- nuke it all without a trace so it cannot pollute anything
- the MVP loop is an observable CLI only that an agent can fully query

Working decision:
Olympus is a hard deletion target for the emergency MVP branch.

Removal scope includes:
- `olympus/` workspace
- UI components and UI-specific tests
- SSE/dashboard client code
- browser-first runtime assumptions

Replacement posture:
- terminal-first daemon
- queryable CLI/debug commands
- durable logs and structured artifacts

### Q30

Question:
For an agent to "fully query" the observable CLI, what machine-readable output is required?

Options presented:
- every important command supports `--json`
- only a few inspection commands support `--json`
- no command-level JSON is required; machine querying happens through structured logs and `.aegis` files

User answer:
- user noted this had effectively already been covered by the logging/artifact decisions
- less work is preferred
- command JSON is acceptable only if it proves absolutely necessary

Working decision:
Do not require a broad command-level JSON surface for the emergency MVP.

Primary machine-queryable surfaces are:
- durable structured logs under `.aegis/logs/`
- `.aegis/dispatch-state.json`
- `.aegis/merge-queue.json`
- caste artifacts and failure-only transcripts when applicable

Minimal command-level JSON may be added later only if a specific inspection path cannot be served cleanly through the structured artifacts/logs already chosen.

### Q31

Question:
What is the minimum acceptable schema for the durable phase logs under `.aegis/logs/`?

Options presented:
- very small schema
- moderate schema
- rich schema with runtime/model/retry/correlation detail

User answer:
Option 3 if easy, else 2.

Working decision:
Target a rich structured log schema if it can be implemented cheaply and cleanly.
Accept a moderate schema if that materially simplifies the strip-down.

Minimum expected content should include at least:
- timestamp
- phase
- issueId
- caste when applicable
- sessionId when applicable
- stage before/after or equivalent transition context
- action
- outcome
- error class/category when applicable
- artifact references when applicable

Preferred additions if easy:
- runtime/provider/model details
- retry metadata
- queue item identifiers
- correlation ids spanning a full run

### Q32

Question:
What should the labor/worktree cleanup policy be on successful completion in the emergency MVP?

Options presented:
- clean successful labors aggressively
- keep successful labors around until explicit cleanup
- clean them in mock runs but retain them in real projects

User answer:
Option 2 for now.
Additional direction:
- keep them so the agent can inspect
- reuse a cleanup command later for automatic removals if needed

Working decision:
Successful labors/worktrees should be retained by default in the emergency MVP.

Reason:
- preserves inspectability for QA agents and post-run debugging
- defers automatic cleanup until the stripped loop is proven reliable
- leaves room for a later cleanup command or retention policy to become the automation point

### Q33

Question:
Should Beads-native messaging survive in the emergency MVP at all?

Options presented:
- no
- keep a minimal form only for explicit escalation/manual-decision communication
- keep the current message model in simplified form

User answer:
None.

Working decision:
Beads-native messaging is out of scope for the emergency MVP.

Coordination and observability must instead rely on:
- tracker task truth and dependency graph
- dispatch state
- merge queue state
- durable structured logs
- stage/caste artifacts

### Q34

Question:
Should the phase and caste debug commands operate only through the running daemon, or also work standalone against on-disk state when the daemon is not running?

Options presented:
- daemon-only
- standalone too
- hybrid: inspection standalone, mutating commands daemon-only

User answer:
"whatever is simplest for mvp and testability"

Working decision:
Let phase and caste commands work standalone against on-disk state as well.

Reason:
- simplest for deterministic testing
- keeps the daemon thin rather than making it the only execution gateway
- aligns with the requirement that almost every phase/behavior should be runnable directly
- allows the daemon to reuse the same command units internally instead of owning separate logic

### Q35

Question:
If standalone mutating commands remain available, what should happen when the daemon is already running?

Options presented:
- refuse them by default
- allow them directly
- route them through the daemon automatically when it is running

User answer:
Option 3 makes the most sense for ease.
Additional reasoning from the user:
- if commands route through the daemon, the loop can take care of avoiding collisions

Working decision:
Mutating phase/caste commands should route through the daemon automatically when it is running, and operate directly on local state only when the daemon is not running.

Reason:
- preserves a single execution authority when the system is live
- avoids split-brain mutation risks
- keeps standalone execution available for testability and local debugging

### Q36

Question:
Because the emergency direction now materially conflicts with `SPECv2.md` on Olympus, economics, messaging, and operating modes, should the triage plan treat spec rewrite as an explicit first-class task?

Options presented:
- rewrite the main spec first
- temporarily diverge from the current spec
- keep the long-term spec, but add an emergency MVP override/addendum

User answer:
Option 3 sounds better.

Working decision:
The recovery effort should preserve `SPECv2.md` as the long-term vision, while introducing a new emergency MVP spec/addendum that explicitly overrides conflicting areas for the recovery branch/session.

Purpose:
- avoid pretending the current code still matches the old source of truth
- prevent long-term vision from being lost
- give the strip-down effort a precise temporary contract

### Q37

Question:
For the actual code surgery, which recovery shape should the triage plan optimize for?

Options presented:
- rewrite in place
- build a new minimal core alongside the old code and cut over later
- hybrid rebuilds behind existing boundaries

User answer:
Option 1, with strong emphasis on aggressive deletion/rewrite.
Additional direction:
- do not keep old pollutant code

Working decision:
The emergency recovery plan should assume an aggressive rewrite-in-place strategy.

Constraints:
- preserve the top-level architectural boundaries that still matter
- aggressively delete and replace polluted internals
- do not keep legacy sidecar implementations alive "for safety"
- do not create a parallel old/new execution path that prolongs drift

### Q38

Question:
What should happen to the current eval harness and benchmark corpus in the emergency MVP?

Options presented:
- remove it from MVP entirely for now
- keep only a tiny minimal scenario layer if it directly supports the mock-run proving flow
- preserve the current eval harness structure but de-prioritize it

User answer:
Option 1.
Additional direction:
- nuke it all

Working decision:
The current eval harness and benchmark corpus are deletion targets for the emergency MVP.

Replacement proving posture:
- deterministic CI seam tests
- seeded mock-run acceptance flow for user and QA-agent validation

### Q39

Question:
What should the merge queue actually gate on in the emergency MVP?

Options presented:
- minimal mechanical gate only
- real project verification gates before merge
- hybrid configurable gate

User answer:
The question was confusing, but the user clarified two intended constraints:
- Tier 1 and Tier 2 merge cases should remain automatic and logical
- Tier 3 should escalate to Janus
- the workflow should make sense for a normal project and stay generic enough for Aegis to apply to many projects

Working decision:
Partially resolved.

Confirmed constraints:
- preserve tiered merge handling
- keep the queue project-generic rather than hardcoded to one repository's workflow

Open refinement:
- whether the emergency MVP should execute project verification commands in the merge queue, or initially limit itself to merge mechanics plus artifact enforcement

### Q40

Question:
Before the queue lands a Titan branch, should Aegis run the project's own verification command if one is configured?

Options presented:
- yes
- no
- hybrid optional support

User answer:
Option 2, not for the MVP.

Working decision:
The emergency MVP merge queue should not run project-specific verification commands before merge.

Emergency MVP queue gates should therefore focus on:
- merge mechanics
- required structured artifacts
- deterministic tier handling (`T1` / `T2` automatic, `T3` Janus)

Project-specific verification commands can return later once the stripped orchestration loop is proven stable.

## Discovery checkpoint

The clarifying-question phase is now sufficient to synthesize emergency triage approaches and a proposed recovery design.

## Approach selection

- Recommended approach presented: boundary-first purge and rebuild in place
- Alternatives considered:
  - instrument current system first, then strip
  - stabilize one clean path first, then expand
- User approved the recommended approach:
  - aggressive rewrite in place
  - preserve the meaningful architectural shell
  - delete polluted subsystems instead of carrying them forward

## Additional design requirement

User requested a single future-facing document that remains dead simple and concise and acts as the list for:
- "took this out, comes back later"
- "needs to be added when working"

Working decision:
- the final recovery design should include one dedicated deferred-items list document
- it should be intentionally minimal and maintained as a flat list, not a second planning system

## Active assumptions

- Terminal logging and durable artifacts are the primary observability surface for the emergency MVP.
- Browser UI, SSE, and HTTP state streaming are not required for the recovery milestone.
- Strict structured artifacts matter more than sophisticated runtime-side metering.
- Mock-run should become the main end-to-end proving ground for both clean-flow and Janus-flow acceptance.

## Open questions

- None at discovery stage.
- Remaining refinement should happen in the written emergency MVP triage spec and later addenda, not by reopening the already-resolved core boundary decisions.
