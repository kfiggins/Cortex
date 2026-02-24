# Phase 3 — Claude Runtime Layer

## Status: Complete

---

## Goal

Build the abstraction that launches a Claude process, injects context, streams output via the event bus, and persists the transcript.

This is the most structurally important phase. A poorly designed runner creates concurrency bugs in Phase 6, UI coupling in Phase 5, and untestable code everywhere.

---

## Prerequisites

- Phase 2 complete and committed
- Review `AgentConfig` interface in `src/core/types.ts`
- Review event definitions in `src/core/events.ts`

---

## What to Build

### `src/runtime/runner.ts`

The `ClaudeRunner` interface and its implementation.

```ts
// src/core/types.ts (additions)
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface RunnerInput {
  agentConfig: AgentConfig;
  userMessage: string;
  history: Message[];
}

// src/runtime/runner.ts
export interface ClaudeRunner {
  run(input: RunnerInput): Promise<void>;
}
```

### `src/runtime/prompt-builder.ts`

Responsible for assembling the full prompt from components:
- `brain.md` content (system prompt)
- `memory.md` content (injected into system context)
- Recent conversation history
- Current user message

Keep prompt assembly **separate from the runner**. This makes it testable independently and swappable later.

```ts
export function buildSystemPrompt(brain: string, memory: string): string
export function buildMessages(history: Message[], userMessage: string): Message[]
```

### `src/runtime/claude-process.ts`

Low-level: spawns the Claude CLI subprocess and streams output.

This is the only file in the project that touches `child_process` or the Claude SDK directly. All other code goes through the runner interface.

Requirements:
- Spawn Claude with assembled prompt
- Read stdout line-by-line or chunk-by-chunk
- Emit `AgentStreaming` events per chunk
- Emit `AgentCompleted` when stream ends
- Emit `AgentErrored` on process error or non-zero exit
- Emit `AgentStarted` before spawning

---

## Claude Integration Approach

Use the **Claude CLI** (`claude` command) via subprocess for now. This avoids SDK versioning complexity and is easier to mock in tests.

```
claude --model <model> --system <system-prompt> "<user-message>"
```

Or use the Anthropic SDK if the CLI approach is too limiting — decide and document in CLAUDE.md.

**Do NOT overbuild tool support.** The `tools` field in `agent.yaml` is reserved but unused.

---

## Dependency Injection Pattern

The runner must receive the event bus — it does NOT create one internally.

```ts
export function createClaudeRunner(eventBus: EventBus): ClaudeRunner
```

This is how you avoid global state and keep tests clean.

---

## Prompt Assembly Design

```
[System Prompt]
You are <agent-name>.

<brain.md contents>

---
[Memory]
<memory.md contents>

---
[Conversation so far is passed as message history]
```

The prompt builder owns this format. Document it. Don't let it leak into the runner.

---

## Transcript Persistence

At the end of a successful run, the runner appends to the transcript via the `StorageAdapter` interface (defined in Phase 4, but stub it now).

```ts
export interface StorageAdapter {
  appendMessage(agentName: string, message: Message): Promise<void>;
  loadHistory(agentName: string, limit?: number): Promise<Message[]>;
}
```

Create a **stub/noop implementation** in this phase so the runner can accept it without Phase 4 being done.

---

## Error Handling Requirements

| Condition                      | Behavior                                        |
|--------------------------------|-------------------------------------------------|
| Claude process fails to start  | Emit `AgentErrored`, do not throw               |
| Claude exits with error code   | Emit `AgentErrored` with stderr content         |
| Stream read error              | Emit `AgentErrored`                             |
| Timeout (future)               | Reserved — do not implement yet                 |

The runner **never throws** — it always communicates via events. This keeps the concurrency model simple.

---

## Test Coverage Required

```
tests/runtime/runner.test.ts
tests/runtime/prompt-builder.test.ts
```

### Mock the Claude Process

Do NOT call real Claude in tests. Create a mock that simulates:
- Successful streaming (emit 3+ chunks then complete)
- Process error
- Non-zero exit

```ts
// tests/helpers/mock-claude-process.ts
export function createMockClaudeProcess(chunks: string[], exitCode = 0) { ... }
```

### Scenarios to Cover

- [ ] `run()` emits `AgentStarted`
- [ ] `run()` emits multiple `AgentStreaming` events in order
- [ ] `run()` emits `AgentCompleted` with full assembled response
- [ ] `run()` emits `AgentErrored` on process failure
- [ ] `buildSystemPrompt()` includes brain and memory content
- [ ] `buildMessages()` includes history and new user message in correct order
- [ ] Transcript is appended via storage adapter after completion
- [ ] Two runner instances emit events with correct `agentName` (no cross-contamination)

---

## What NOT to Do in This Phase

- Do not build the TUI
- Do not implement real file storage (use noop stub)
- Do not add tool execution
- Do not add retry logic
- Do not hardcode model names — read from `AgentConfig.model`

---

## Completion Steps

1. Add `Message` and `RunnerInput` types to `src/core/types.ts`
2. Add `StorageAdapter` interface to `src/core/types.ts`
3. Create noop `StorageAdapter` in `src/storage/noop-adapter.ts`
4. Create `src/runtime/prompt-builder.ts`
5. Create `src/runtime/claude-process.ts`
6. Create `src/runtime/runner.ts`
7. Write tests with mock Claude process
8. Run lint
9. Review: does the runner know about UI? Storage internals? It shouldn't.
10. Review: can two runners run simultaneously without shared state? They should be able to.
11. Refactor if needed
12. Update CLAUDE.md Phase Status table
13. Commit: `feat: phase 3 - claude runtime layer`

---

## Previous Phase

[Phase 2 — Event Bus Core](./phase-2.md)

## Next Phase

[Phase 4 — Persistence Layer](./phase-4.md)
