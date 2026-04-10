# Aegis Startup and Preflight Design

## Purpose

Make `aegis start` the canonical, reliable entrypoint for arbitrary repositories, with prerequisite validation completed before Olympus opens.

The operator should either land in a truthful, usable browser session or receive a clear terminal diagnosis with explicit fixes. There should be no broken intermediate state where Olympus opens despite missing prerequisites.

## Source of truth

- Product behavior: `SPECv2.md`
- Repo operating rules: `AGENTS.md`
- Codebase map: `plandocs/codebase-structure.md`
- Related redesign specs:
  - `docs/superpowers/specs/2026-04-10-olympus-operator-workflow-design.md`
  - `docs/superpowers/specs/2026-04-10-live-execution-observability-design.md`
  - `docs/superpowers/specs/2026-04-10-mock-seed-operator-docs-design.md`

## Series position

This is spec 1 of 4 in the Olympus operator-console redesign.

Nothing in the later specs matters if startup still drops the operator into an unusable shell, so this spec lands first.

## Goals

- Preserve `aegis start` as the canonical launch command.
- Add repo-local npm aliases as convenience, without replacing the canonical command.
- Run all startup prerequisite checks before printing the server URL or opening the browser.
- Fail clearly and non-interactively when prerequisites are missing.
- Keep the startup path valid for arbitrary repositories, not just seeded scratchpads.
- Keep `aegis init` idempotent and safe for existing repositories.

## Non-goals

- A browser-based setup wizard in MVP.
- Hidden auto-fixes that mutate the repo during `aegis start`.
- Mock-specific startup behavior.
- Chat-based setup assistance through Metis or Prometheus.

## Canonical user-facing contract

### Launch commands

The canonical launch command remains:

- `aegis start`

When a repository has a `package.json`, `aegis init` should also ensure these non-invasive aliases exist unless they already do:

- `aegis:init`
- `aegis:start`
- `aegis:status`
- `aegis:stop`

Rules:

- Do not overwrite an existing user `start` script.
- Do not require npm aliases for the product to work.
- If no `package.json` exists, skip alias installation and report that it was skipped.

### Happy path

When `aegis start` succeeds, it should:

1. Resolve the repository root.
2. Run startup preflight.
3. Reconcile runtime state and dispatch state.
4. Start the HTTP server.
5. Print the Olympus URL and shutdown hint.
6. Open the browser if enabled.
7. Enter conversational idle state until the operator starts the loop from Olympus.

### Failed preflight path

When preflight fails, `aegis start` should:

1. Print a compact ordered checklist of checks.
2. Mark each check as `pass`, `fail`, or `skipped`.
3. For every failed check, print one concrete operator fix.
4. Exit non-zero.
5. Not open the browser.
6. Not print a fake Olympus URL.
7. Not write a misleading running runtime-state record.

## Preflight contract

Startup preflight should validate, in order:

1. Repository root is inside a git worktree.
2. `bd` is installed.
3. Beads is initialized and healthy for this repo.
4. `.aegis/config.json` exists.
5. Config schema validates.
6. The configured runtime adapter exists.
7. Runtime-local prerequisites are present for the chosen adapter.
8. Configured model references are syntactically valid and resolvable by the adapter.
9. Required local runtime state paths are writable.

### Runtime-local prerequisite rule

The MVP requirement is to validate local prerequisites before browser open, not to guarantee a remote provider billing or auth round-trip at startup.

For Pi-backed runs, this means startup should validate what can be known locally:

- runtime selection is `pi`
- local Pi settings or equivalent provider configuration is present
- configured model references resolve through adapter model lookup

If the adapter later supports a cheap health probe, startup may include it, but MVP does not depend on a networked provider handshake.

## Output shape

Startup output should be machine-readable enough for future automation and readable enough for humans.

The terminal output should include:

- overall result: `READY` or `BLOCKED`
- repository root
- ordered preflight checks
- fixes for failed checks
- Olympus URL only on success

Example success shape:

```text
Aegis startup preflight: READY
- git repo: pass
- beads cli: pass
- beads repo: pass
- aegis config: pass
- runtime config: pass
- model refs: pass

Olympus: http://127.0.0.1:3847
Press Ctrl+C or run `aegis stop` to shut down.
```

Example blocked shape:

```text
Aegis startup preflight: BLOCKED
- git repo: pass
- beads cli: pass
- beads repo: fail
  fix: run `bd init` or `bd onboard` in this repository
- aegis config: fail
  fix: run `aegis init`
- runtime config: fail
  fix: create `.pi/settings.json` or configure the selected runtime
```

## `aegis init` behavior changes

`aegis init` remains the single repo-local bootstrap command and stays idempotent.

It should:

- create `.aegis/config.json` if missing
- create runtime state files if missing
- update `.gitignore` if needed
- add repo-local npm aliases when `package.json` exists and the alias names are unused
- never overwrite existing config or existing scripts

It should not:

- silently rewrite user scripts
- install global tools
- open the browser
- seed mock-only behavior

## Interaction with Olympus

This spec intentionally keeps the browser out of the recovery path.

If preflight fails, the operator stays in the terminal and fixes the environment first. Olympus is only opened for valid runs. This keeps the browser truthful and allows later specs to assume that an opened Olympus session always starts from a sane baseline.

## Implementation boundaries

Likely touch points:

- `src/cli/start.ts`
- `src/config/init-project.ts`
- `src/config/load-config.ts`
- `src/index.ts`
- package alias wiring logic for repos with `package.json`
- startup and init tests under `tests/integration/cli/` and `tests/integration/config/`

This spec does not define the Olympus UI itself. It only defines what must be true before the browser may open.

## Manual validation

- Start inside a repo with no Beads initialization and confirm startup blocks with a Beads fix.
- Start inside a repo with no `.aegis/config.json` and confirm startup blocks with `aegis init`.
- Start with invalid model references and confirm startup blocks before browser open.
- Start inside a healthy arbitrary repo and confirm URL print and browser open happen only after all checks pass.
- Run `aegis init` twice and confirm it remains idempotent.
- Run `aegis init` in a repo with an existing `package.json` and confirm only unused `aegis:*` aliases are added.

