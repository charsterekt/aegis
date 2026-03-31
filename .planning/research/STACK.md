# Stack Research

**Domain:** Multi-agent coding orchestrator with local persistence and browser control surface
**Researched:** 2026-03-31
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS+ | Orchestrator runtime, process control, filesystem access, HTTP/SSE | Matches the current repo baseline and gives stable Windows process APIs plus straightforward local server support |
| TypeScript | 5.9.x | Strongly typed contracts for dispatch state, adapters, prompts, and UI/server boundaries | The spec depends on crisp interfaces and deterministic data structures; the repo already targets 5.9.3 |
| Pi runtime packages | 0.57.1 baseline, track upstream 0.64.x intentionally | First agent runtime for Oracle, Titan, Sentinel, and Janus sessions | Pi is already the launch runtime in the PRD and the current package baseline is present in `package.json` |
| Git worktree | Git 2.4+ | Labor isolation and merge-candidate workspaces | Official Git support for linked worktrees is the cleanest mechanical isolation model for this product |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@mariozechner/pi-agent-core` | 0.57.1 | Runtime session primitives | Use for the runtime adapter boundary and lifecycle management |
| `@mariozechner/pi-ai` | 0.57.1 | Provider/model integration under Pi | Use when wiring model selection, stats, and auth-plan-aware metering |
| `@mariozechner/pi-coding-agent` | 0.57.1 | Coding-agent behaviors on top of Pi | Use for the first Oracle/Titan/Sentinel implementation path |
| React + Vite | Current stable pair at implementation time | Olympus browser UI | Use when building the separate operator dashboard shell and SSE-driven control room |
| Vitest | 4.x | Unit, integration, and scenario regression tests | Use for dispatch logic, queue gates, restart recovery, and eval harness support |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsc` | Type-checking and production build | Keep contracts for config, dispatch state, and agent artifacts explicit |
| `tsx` | Fast local execution during development | Good fit for bootstrapping CLI/server slices before full packaging |
| `git worktree` | Branch-isolated labor management | Build labor lifecycle around explicit add/list/remove/repair operations |
| npm scripts | Consistent local entrypoints | Keep bootstrap, Olympus build, test, and eval commands in version control |

## Installation

```bash
# Core runtime baseline
npm install @mariozechner/pi-agent-core @mariozechner/pi-ai @mariozechner/pi-coding-agent

# Olympus UI
npm install react react-dom

# Dev dependencies
npm install -D typescript tsx vitest vite @types/node
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Pi-first adapter | Direct provider SDK integration in the orchestrator | Only if Pi cannot expose a required runtime capability cleanly |
| SSE for Olympus live state | WebSockets | Use WebSockets only if the UI later needs heavy bidirectional streaming beyond commands plus server push |
| Git worktree labors | In-place branches or ad hoc temp clones | Only for trivial experiments; the production design should stay worktree-based |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Runtime-specific logic in core dispatch modules | Locks the orchestrator to one provider/runtime and breaks the adapter promise | Keep all runtime quirks behind adapter modules |
| Direct-to-main Titan integration | Hides merge risk and bypasses explicit queue outcomes | Use the deterministic merge queue |
| WebSocket-heavy dashboard architecture by default | Adds unnecessary protocol and reconnect complexity for a read-mostly operator UI | Start with SSE and layer commands over HTTP |
| A second task database | Creates truth-plane drift with Beads | Keep task truth in Beads only |

## Stack Patterns by Variant

**If Pi remains the only runtime in the near term:**
- Keep the runtime contract minimal
- Optimize for deterministic orchestration and good Pi telemetry capture

**If mixed-model swarms become active:**
- Use provider-prefixed model IDs in config
- Select adapters mechanically from config instead of prompt logic

**If Olympus stays read-mostly during MVP:**
- Use SSE plus explicit command endpoints
- Avoid adding bidirectional transport complexity before it is needed

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Node.js `>=22.5.0` | TypeScript 5.9.x | Matches the current repository engine declaration |
| `@mariozechner/pi-agent-core@0.57.1` | `@mariozechner/pi-ai@0.57.1` | Keep Pi package versions aligned |
| `@mariozechner/pi-agent-core@0.57.1` | `@mariozechner/pi-coding-agent@0.57.1` | Upgrade as a set, not independently |
| React/Vite current stable pair | Node 22 LTS+ | Use the stable pair current at implementation time for Olympus |

## Sources

- `SPECv2.md` - canonical architecture, workflows, and implementation ordering
- `package.json` - current repo runtime and dependency baseline
- https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html - Windows process behavior and subprocess lifecycle
- https://git-scm.com/docs/git-worktree - linked worktree behavior and commands
- https://shittycodingagent.ai/ - Pi runtime model, modes, and package philosophy
- https://github.com/andygeiss/beads - Beads tracker capabilities and CLI-oriented workflow
- https://react.dev/learn/add-react-to-an-existing-project - current React guidance for existing projects
- https://vite.dev/guide/ - Vite baseline for a modern dashboard shell

---
*Stack research for: multi-agent coding orchestrator*
*Researched: 2026-03-31*
