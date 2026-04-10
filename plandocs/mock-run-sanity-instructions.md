# Mock-Run Sanity Test Instructions

**Last updated:** 2026-04-10

## Purpose

Quick smoke-test the Aegis CLI, HTTP endpoints, and SSE contracts before gate claims or after server/SSE/config changes.

## Run Instructions

```bash
# 1. Clean and rebuild
npm run build
npm run lint

# 2. Clean previous mock run and reseed
rm -rf aegis-mock-run
npm run mock:seed

# 3. Quick lifecycle test
cd aegis-mock-run

# Verify initial state
node ../dist/index.js init
node ../dist/index.js status                    # → server_state: stopped

# Start server
node ../dist/index.js start --port 43210 --no-browser
node ../dist/index.js status                    # → server_state: running

# 4. Verify contracts (run from a separate terminal or background the server first)
curl http://127.0.0.1:43210/                    # Serves Olympus bundle
curl http://127.0.0.1:43210/api/state           # → { status, spend, agents }
curl --max-time 2 http://127.0.0.1:43210/api/events  # SSE stream with { type, data } envelope

# 5. Stop server
node ../dist/index.js stop
node ../dist/index.js status                    # → server_state: stopped

# 6. Verify no repo dirtying
git status -sb   # Should be clean — all .aegis/ files are gitignored
cd ..
```

## Things to Observe

| Check | Expected |
|-------|----------|
| `npm run build` | Zero TypeScript errors |
| `npm run lint` | Zero lint errors |
| `aegis init` | Creates `.aegis/config.json` idempotently |
| `aegis status` | Works before and after start/stop |
| `GET /` | Serves real Olympus bundle (not fallback shell) |
| `GET /api/state` | Returns `{ status, spend, agents }` shape |
| `GET /api/events` | SSE with `{ type, data }` envelope |
| `git status -sb` (mock repo) | No untracked `.aegis/` files |
| Mock repo `.gitignore` | `.aegis/mock-run-manifest.json` is ignored |
| Manifest `repoRoot` | Relative path `".."`, not absolute |

## Full Test Suite

```bash
npm run test                    # All unit + integration tests
npm run test -- --run tests/integration/mock-run/  # Mock-run specific
```

## Playwright Browser Testing

With Playwright MCP installed, you can launch a browser against the running server:

```bash
node dist/index.js start --port 43210
# Then navigate to http://127.0.0.1:43210 in your browser
# Verify dashboard renders, SSE events stream, state updates
node dist/index.js stop
```
