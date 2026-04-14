# Phase F Merge Queue Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild deterministic Phase F merge queue behavior with `.aegis/merge-queue.json` as queue truth, `aegis merge next` as operator entrypoint, T1/T2 automatic handling, T3 Janus escalation, and Sentinel strictly post-merge.

**Architecture:** Add a focused `src/merge/*` boundary for queue state, tier policy, and queue execution. Keep queue processing deterministic by separating queue persistence from merge outcome policy and by routing local/daemon command execution through the same command transport used by phase/caste commands.

**Tech Stack:** TypeScript, Vitest, Node.js CLI, Beads tracker shell integration, atomic JSON persistence under `.aegis/`.

**Cleanup note (2026-04-14):** Temporary recovery names were removed after implementation. Runtime id is now `scripted`, loop reap success advances to `scouted`, triage uses `already_progressed`, `process` returns `nextAction: "merge_next"` instead of phase milestone labels, and merge/labor target branch resolves from `.aegis/config.json -> git.base_branch`.

---

### Task 1: Lock Phase F queue contract in tests

**Files:**
- Create: `tests/unit/merge/merge-state.test.ts`
- Create: `tests/unit/merge/tier-policy.test.ts`
- Create: `tests/unit/merge/merge-next.test.ts`
- Modify: `tests/unit/core/caste-runner.test.ts`
- Modify: `tests/integration/config/init-project.test.ts`

- [ ] **Step 1: Write failing queue-state contract tests**

```ts
it("loads legacy {} as an empty merge queue state", () => {
  writeFileSync(path.join(root, ".aegis", "merge-queue.json"), "{}\n", "utf8");

  expect(loadMergeQueueState(root)).toEqual(emptyMergeQueueState());
});

it("saves schema-backed queue state atomically", () => {
  saveMergeQueueState(root, emptyMergeQueueState());

  expect(readFileSync(path.join(root, ".aegis", "merge-queue.json"), "utf8")).toContain(
    '"schemaVersion": 1',
  );
});
```

- [ ] **Step 2: Write failing tier-policy tests**

```ts
it("keeps T2 automatic before janus threshold", () => {
  expect(classifyMergeTier({
    outcome: "stale_branch",
    attempts: 1,
    janusRetryThreshold: 2,
    janusEnabled: true,
    janusInvocations: 0,
    maxJanusInvocations: 1,
  })).toMatchObject({ tier: "T2", action: "requeue" });
});

it("escalates to Janus at T3 once retry threshold is reached", () => {
  expect(classifyMergeTier({
    outcome: "conflict",
    attempts: 2,
    janusRetryThreshold: 2,
    janusEnabled: true,
    janusInvocations: 0,
    maxJanusInvocations: 1,
  })).toMatchObject({ tier: "T3", action: "janus" });
});
```

- [ ] **Step 3: Write failing merge-next flow tests**

```ts
it("merges queued work, runs Sentinel after merge, and marks dispatch complete", async () => {
  await expect(runMergeNext(root, deps)).resolves.toMatchObject({
    action: "merge_next",
    issueId: "aegis-123",
    tier: "T1",
    stage: "complete",
    status: "merged",
  });
});

it("requeues T2 work without invoking Janus", async () => {
  await expect(runMergeNext(root, deps)).resolves.toMatchObject({
    tier: "T2",
    stage: "queued_for_merge",
    status: "requeued",
  });
});

it("dispatches Janus on T3 and requeues when Janus says requeue", async () => {
  await expect(runMergeNext(root, deps)).resolves.toMatchObject({
    tier: "T3",
    stage: "queued_for_merge",
    status: "janus_requeued",
  });
});
```

- [ ] **Step 4: Write failing process-boundary and init contract tests**

```ts
it("queues implemented work when process reaches the Phase F boundary", async () => {
  await expect(runCasteCommand(input)).resolves.toMatchObject({
    action: "process",
    issueId: "aegis-123",
    stage: "queued_for_merge",
  });
});

it("seeds merge-queue.json with schema-backed empty queue state", () => {
  initProject(tempRepo);

  expect(readFileSync(path.join(tempRepo, ".aegis", "merge-queue.json"), "utf8")).toContain(
    '"schemaVersion": 1',
  );
});
```

- [ ] **Step 5: Run tests to verify RED**

Run: `npm test -- tests/unit/merge/merge-state.test.ts tests/unit/merge/tier-policy.test.ts tests/unit/merge/merge-next.test.ts tests/unit/core/caste-runner.test.ts tests/integration/config/init-project.test.ts`
Expected: FAIL with missing merge modules, old `process` Phase F defer behavior, and old `{}` queue seed.

### Task 2: Add merge state, policy, and queue execution

**Files:**
- Create: `src/merge/merge-state.ts`
- Create: `src/merge/tier-policy.ts`
- Create: `src/merge/merge-next.ts`
- Modify: `src/core/caste-runner.ts`
- Modify: `src/config/init-project.ts`

- [ ] **Step 1: Implement schema-backed queue persistence**

```ts
export interface MergeQueueState {
  schemaVersion: 1;
  items: MergeQueueItem[];
}

export function emptyMergeQueueState(): MergeQueueState {
  return { schemaVersion: 1, items: [] };
}
```

- [ ] **Step 2: Implement deterministic tier policy**

```ts
if (outcome === "merged") return { tier: "T1", action: "merge" };
if (attempts < janusRetryThreshold) return { tier: "T2", action: "requeue" };
if (janusEnabled && janusInvocations < maxJanusInvocations) {
  return { tier: "T3", action: "janus" };
}
return { tier: "T3", action: "fail" };
```

- [ ] **Step 3: Implement queue execution with post-merge Sentinel**

```ts
const mergeAttempt = await executor.execute(root, queueItem);
const policy = classifyMergeTier(...);

if (policy.action === "merge") {
  // dispatch -> merged
  // run Sentinel via runCasteCommand(..., "review", ...)
}
```

- [ ] **Step 4: Replace old `process` Phase F defer with enqueue behavior**

```ts
if (input.action === "process" && record.stage === "implemented") {
  const queued = enqueueImplementedIssue(...);
  return {
    action: "process",
    issueId: input.issueId,
    stage: "queued_for_merge",
    queueItemId: queued.queueItemId,
  };
}
```

- [ ] **Step 5: Re-run targeted tests until GREEN**

Run: `npm test -- tests/unit/merge/merge-state.test.ts tests/unit/merge/tier-policy.test.ts tests/unit/merge/merge-next.test.ts tests/unit/core/caste-runner.test.ts tests/integration/config/init-project.test.ts`
Expected: PASS

### Task 3: Wire CLI and daemon/local routing for `aegis merge next`

**Files:**
- Create: `src/cli/merge-command.ts`
- Modify: `src/index.ts`
- Modify: `src/cli/runtime-command.ts`
- Modify: `src/cli/start.ts`
- Create: `tests/unit/cli/merge-command.test.ts`
- Modify: `tests/unit/cli/runtime-command.test.ts`
- Create: `tests/integration/cli/merge-commands.test.ts`

- [ ] **Step 1: Write failing routing tests**

```ts
it("runs merge next locally when daemon is not active", async () => {
  await expect(runDirectMergeCommand("repo", "next", deps)).resolves.toEqual({
    action: "merge_next",
    source: "local",
  });
});

it("routes merge next through daemon when runtime ownership is active", async () => {
  await expect(runDirectMergeCommand("repo", "next", deps)).resolves.toEqual({
    action: "merge_next",
    source: "daemon",
  });
});
```

- [ ] **Step 2: Add merge request/response transport**

```ts
export interface MergeRuntimeCommandRequest {
  request_id: string;
  command_kind: "merge";
  action: "next";
  target_pid: number;
  requested_at: string;
}
```

- [ ] **Step 3: Wire CLI parsing and daemon handling**

```ts
if (command === "merge" && argv[1] === "next") {
  const result = await runDirectMergeCommand(root, "next");
  console.log(formatMergeCommandResult(result));
}
```

- [ ] **Step 4: Re-run routing tests**

Run: `npm test -- tests/unit/cli/merge-command.test.ts tests/unit/cli/runtime-command.test.ts tests/integration/cli/merge-commands.test.ts`
Expected: PASS

### Task 4: Update docs and mock-run proof surface

**Files:**
- Modify: `docs/superpowers/specs/2026-04-13-aegis-emergency-mvp-triage-design.md`
- Modify: `tests/unit/bootstrap/project-skeleton.test.ts`

- [ ] **Step 1: Mark Phase F progress accurately in spec/tests**

```md
- `aegis merge next`
- schema-backed `.aegis/merge-queue.json`
- T1/T2 automatic queue handling
- T3 Janus escalation
- Sentinel runs strictly after merge
```

- [ ] **Step 2: Re-run doc/bootstrap assertions**

Run: `npm test -- tests/unit/bootstrap/project-skeleton.test.ts`
Expected: PASS

### Task 5: Verify end to end

**Files:**
- No new files; verification only

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run TypeScript build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Run lint/typecheck**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Run seeded mock-run proof for merge-next**

Run: `npm run mock:seed`
Expected: mock repo seeded

Run: `npm run mock:run -- node ../dist/index.js start`
Expected: daemon running

Run: `npm run mock:run -- node ../dist/index.js scout <issue-id>`
Expected: issue reaches `scouted`

Run: `npm run mock:run -- node ../dist/index.js implement <issue-id>`
Expected: issue reaches `implemented`

Run: `npm run mock:run -- node ../dist/index.js process <issue-id>`
Expected: issue reaches `queued_for_merge`

Run: `npm run mock:run -- node ../dist/index.js merge next`
Expected: queue advances one item and merged issue reaches post-merge Sentinel stage/result

- [ ] **Step 5: Record exact verification outcomes before claiming completion**

```bash
git status --short
npm test
npm run build
npm run lint
```

## Self-Review

- Phase F stays scoped to merge queue persistence, merge execution policy, CLI routing, and post-merge Sentinel. It does not reopen restart/requeue families, project-specific merge verification, or broader tracker workflow changes.
- Queue policy is deterministic and inspectable: state lives in `.aegis/merge-queue.json`, Janus enters only through explicit T3 policy, and Sentinel remains post-merge.
- Tests cover queue state, tier policy, merge-next execution, routing, and docs/bootstrap drift without depending on brittle live conflict simulation.
