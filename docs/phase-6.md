# Phase 6 — Multi-Agent Concurrency

## Status: Not Started

---

## Goal

Allow multiple Claude processes to run simultaneously, each streaming independently, without cross-contamination or shared state bugs.

If the architecture in Phases 2–5 was clean, this phase should be a small, focused addition. If it requires major rewrites, the earlier phases had hidden coupling.

---

## Prerequisites

- Phase 5 complete and committed
- Each `ClaudeRunner` instance is stateless and independently constructable
- Event bus uses `agentName` to distinguish events
- UI state manager handles per-agent state correctly

---

## The Concurrency Model

Each agent gets its own runner instance. Runner instances share:
- The event bus (by reference — this is fine, it's designed for this)
- The storage adapter (by reference — this is fine, each agent writes to its own file)

Runner instances do NOT share:
- Process handles
- Streaming state
- History buffers
- Any mutable instance variables

```ts
// index.ts (conceptual wiring)
const runners = new Map<string, ClaudeRunner>();

for (const agent of agents) {
  runners.set(agent.name, createClaudeRunner(eventBus, storageAdapter));
}
```

---

## What to Build

### `src/runtime/runner-registry.ts`

A registry that manages runner instances per agent:

```ts
export interface RunnerRegistry {
  getRunner(agentName: string): ClaudeRunner | undefined;
  registerRunner(agentName: string, runner: ClaudeRunner): void;
  getAllRunnerNames(): string[];
}

export function createRunnerRegistry(): RunnerRegistry
```

This is a simple Map wrapper. Its job is to make the registry explicit and testable rather than a loose `Map` floating in `index.ts`.

---

## Concurrency Safety Requirements

### Each runner emits with its own `agentName`

All events carry `agentName`. The event bus routes to all subscribers — they filter by `agentName` if needed. This is already designed in Phase 2.

### No shared streaming buffer

If the runner accumulates chunks for the `AgentCompleted` payload, that buffer must be instance-level (inside the runner closure), not module-level.

### No shared history buffer

Each `run()` call fetches history fresh from storage. No in-memory caching between calls.

### Parallel runs on the same agent

A user should not be able to send a second message to an agent that is already running. The runner should:
1. Check if a run is in progress
2. If yes: either queue or reject (reject for now, queue in V2)

```ts
export interface ClaudeRunner {
  run(input: RunnerInput): Promise<void>;
  isRunning(): boolean;  // add this
}
```

---

## UI Integration

The TUI must handle concurrent running agents correctly:

- Both `●` indicators can be active simultaneously
- Switching to a different agent mid-stream shows that agent's stream without interrupting either
- `AgentStreaming` events for agent-a do not appear in agent-b's chat window

This should already work from Phase 5's state manager if it was implemented correctly. Verify it here.

---

## Test Coverage Required

```
tests/runtime/runner-registry.test.ts
tests/runtime/concurrency.test.ts
```

### Scenarios to Cover

- [ ] Two runners run simultaneously — events are emitted with correct `agentName`
- [ ] Handler subscribed for agent-a does not receive agent-b's events (filter by agentName)
- [ ] Both runners complete successfully — no cross-stream contamination
- [ ] `isRunning()` returns `true` during run, `false` after completion
- [ ] Calling `run()` on a running runner — rejects or queues (document behavior)
- [ ] One runner errors — other runner continues unaffected
- [ ] Registry returns correct runner for each agent name
- [ ] **Stress test**: 3 runners with interleaved mock streaming — verify event ordering per agent

---

## What NOT to Do in This Phase

- Do not add a job queue system (reject concurrent runs on same agent for now)
- Do not add a process pool or worker threads
- Do not add inter-agent communication
- Do not add pipeline chaining between agents (V2)

---

## Completion Steps

1. Audit `ClaudeRunner` for any shared/module-level mutable state — fix it
2. Add `isRunning()` to `ClaudeRunner` interface
3. Create `src/runtime/runner-registry.ts`
4. Update `index.ts` to use registry and create one runner per agent
5. Write concurrency tests (mock runners are fine)
6. Manual test: start a long-running agent, switch to another, start that one too — verify both stream correctly
7. Run lint
8. Review: is any state shared between runners? There shouldn't be.
9. Refactor if needed
10. Update CLAUDE.md Phase Status table
11. Commit: `feat: phase 6 - multi-agent concurrency`

---

## Previous Phase

[Phase 5 — TUI Interface](./phase-5.md)

## Next Phase

[Phase 7 — Memory Evolution Hooks](./phase-7.md)
