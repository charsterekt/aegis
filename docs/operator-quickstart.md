# Operator Quickstart

A concise guide to getting Aegis up and running for the first time.

## Prerequisites

- Node.js (LTS recommended)
- git
- Beads CLI (`bd`) installed and on PATH
- A configured runtime provider (Pi SDK in MVP)

## First Launch in an Arbitrary Repo

1. Initialize the Beads issue tracker:
   ```bash
   bd init
   # or
   bd onboard
   ```

2. Initialize Aegis in the repo:
   ```bash
   aegis init
   ```

3. Start the Aegis loop:
   ```bash
   aegis start
   ```

4. If the preflight checks pass, the Olympus dashboard opens in your browser and shows the Aegis Loop shell.

## What Happens Next

- Olympus connects to the Aegis server via SSE and displays the current loop state.
- The ready queue (`bd ready`) drives what work is available.
- Use the Steer panel in Olympus to send commands (`status`, `pause`, `resume`, `focus <issue-id>`, `kill <agent-id>`).
- The loop polls for ready issues, dispatches work to agents, monitors progress, and reaps completed sessions.

## Stopping Aegis

```bash
aegis stop
```

## Mock Sandbox

For experimentation without affecting a real repo, use `npm run mock:seed` from the Aegis root to create a disposable scratchpad workspace. See [Mock Seed Guide](./mock-seed-guide.md) for details.
