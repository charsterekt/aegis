# Mock Seed Guide

How the mock seed works and what it creates.

## Purpose

`npm run mock:seed` creates a deterministic scratchpad workspace under `aegis-mock-run/` for testing Aegis without affecting a real repository. The seeded repo contains only bootstrap files and a minimal Beads issue graph -- no example application source.

## What Gets Created

Running `npm run mock:seed` produces a fresh directory under `aegis-mock-run/aegis-mock-<timestamp>/` containing:

- **`.gitignore`** -- Entries for all Aegis-generated files (`.aegis/`, `.beads/`, `.dolt/`, etc.)
- **`.pi/settings.json`** -- Default Pi SDK provider configuration
- **Beads graph** -- A deterministic `foundation` slice with `contract`, `lane-a`, `lane-b`, and `gate` children
- **`.aegis/config.json`** -- Aegis runtime configuration

No `src/` or `tests/` tree is seeded. The scratchpad is a blank canvas with only the orchestration skeleton.

## Ready Queue After Seeding

Immediately after seeding, `bd ready` returns only `foundation.contract`. After the contract child is processed and closed, both `lane-a` and `lane-b` become ready in parallel. After both lanes close, `gate` becomes ready.

## How It Works

The seeder (`src/mock-run/seed-mock-run.ts`):

1. Creates a timestamped directory under `aegis-mock-run/`
2. Writes baseline files (`.gitignore`, `.pi/settings.json`)
3. Initializes a git repository
4. Initializes Beads with `bd init --server --shared-server --skip-agents`
5. Runs `aegis init` to create the Aegis config
6. Seeds the deterministic Beads issue graph

## Using the Scratchpad

```bash
# Seed the scratchpad
npm run mock:seed

# Navigate to the created repo
cd aegis-mock-run/aegis-mock-<timestamp>/

# Check what's ready
bd ready --json

# Start Aegis
aegis start

# Stop when done
aegis stop
```

The entire `aegis-mock-run/` tree is gitignored, so it is safe to delete at any time.

## Sanity Testing

The scratchpad is the primary workspace for sanity-testing Aegis commands. See the `AGENTS.md` "Mock-Run Sanity Testing" section for the recommended verification checklist.
