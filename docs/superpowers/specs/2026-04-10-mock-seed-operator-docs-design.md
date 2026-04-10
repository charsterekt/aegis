# Mock Seed and Operator Docs Design

## Purpose

Remove mock-specific product assumptions from the operator experience while keeping a deterministic scratchpad workflow for repeatable runs.

The seeded mock repo should look like an arbitrary repository from Aegis' perspective. The only deterministic part should be the seeded issue graph and the minimal bootstrap needed to make the repo operable.

## Source of truth

- Product behavior: `SPECv2.md`
- Repo operating rules: `AGENTS.md`
- Existing mock seed design to revise: `docs/superpowers/specs/2026-04-09-aegis-mock-run-seeder-design.md`
- Startup dependency: `docs/superpowers/specs/2026-04-10-aegis-startup-preflight-design.md`
- Workflow dependency: `docs/superpowers/specs/2026-04-10-olympus-operator-workflow-design.md`
- Observability dependency: `docs/superpowers/specs/2026-04-10-live-execution-observability-design.md`

## Series position

This is spec 4 of 4 in the Olympus operator-console redesign.

It makes the seeded scratchpad consistent with the real product model and fills the operator-documentation gap.

## Goals

- Keep `npm run mock:seed` as a deterministic scratchpad generator.
- Remove seeded sample application source from the mock repo.
- Ensure Aegis treats the mock repo the same way it treats any arbitrary repo.
- Document the operator flow so a user does not need to read source code to launch or understand Aegis.
- Add an explicit steer command reference outside the source tree.

## Non-goals

- Mock-only UI behavior.
- Mock-only backend behavior.
- A separate mock runtime mode.
- Preserving the old todo-app baseline.

## Mock repo contract

The seeded repo is a disposable scratchpad, not a handcrafted example app.

### Allowed seeded content

The seed should include only the minimum repo bootstrap required for the repo to be operable:

- `git init` output
- Beads initialization output
- `.aegis/` bootstrap created by `aegis init`
- runtime configuration needed for the selected adapter, such as `.pi/settings.json`
- `.gitignore` entries required to keep operational artifacts out of git
- the deterministic Beads issue graph

### Disallowed seeded content

The seed should no longer create:

- example source trees
- example tests
- example app commands
- domain-specific scaffolding like the old todo app baseline

The first real project files should be created because the seeded issues ask for them, not because the seeder preloads them.

## Deterministic issue graph

The seeded issue graph should remain deterministic across runs.

That means:

- same logical issue structure each seed
- same dependency chain each seed
- same initial ready queue each seed

This determinism exists for the operator and for regression runs. It should not introduce any mock-specific execution path inside Aegis.

## Scratchpad philosophy

The operator should be able to think about the seeded repo this way:

- it is just another repo
- it starts with predictable work
- Aegis is not allowed to special-case it

This keeps the seeded environment honest. The product should succeed there for the same reasons it succeeds on arbitrary repositories.

## Operator documentation gap

The current product has a major operator-docs problem:

- no clear launch story
- no clear Olympus tour
- no clear command reference
- too much implied knowledge from source and prior sessions

This spec closes that gap.

## Required docs deliverables

### 1. Operator quickstart

Add a top-level operator-facing document that explains:

- prerequisites
- install shape
- `bd init` / `bd onboard`
- `aegis init`
- `aegis start`
- what success and failure look like
- how Olympus is expected to behave once open

This should target arbitrary repositories first.

### 2. Olympus operator guide

Add a focused guide that explains the browser shell:

- header and loop status
- phase table
- merge queue section
- active session panes
- completed tray
- sidebar queue and graph
- intervention controls
- error and result surface

### 3. Deterministic steer reference

Add a concise command reference for the deterministic steer actions exposed in MVP.

This reference should exist both:

- in docs
- in Olympus itself

The docs copy should be authoritative for operator onboarding.

### 4. Mock seed guide

Document `npm run mock:seed` explicitly as:

- a disposable scratchpad repo generator
- a deterministic Beads graph generator
- not a mock-specific product mode

It should explain what the command creates, what it intentionally does not create, and why.

## Documentation tone and contract

The operator docs should assume no source familiarity.

They should be:

- direct
- procedural
- explicit about failure modes
- explicit about what MVP does not include yet

They should not:

- bury launch steps inside development docs
- assume the user knows the internal slice plan
- describe Olympus as a debug shell

## Interaction with the redesign

This spec intentionally depends on the earlier three specs.

The docs must describe the actual launched product:

- preflight before browser open
- Olympus as first-class operator console
- real loop and agent observability
- deterministic steer as secondary control surface

## Implementation boundaries

Likely touch points:

- `src/mock-run/seed-mock-run.ts`
- mock manifest helpers under `src/mock-run/`
- `.gitignore` and seed output shape
- new or revised operator docs under repo root or `docs/`
- existing mock-run documentation and execution workflow docs

The older mock-seeder design doc should be treated as superseded where it conflicts with this scratchpad-first approach.

## Manual validation

- Seed the mock repo twice and confirm the Beads graph shape and initial ready queue match exactly.
- Confirm the seeded repo contains no example app source tree.
- Confirm Aegis can start against the seeded repo without any mock-only code path.
- Follow the operator docs from scratch in an arbitrary repo and confirm they are sufficient without source inspection.
- Confirm the steer reference in docs matches the steer reference surfaced in Olympus.

