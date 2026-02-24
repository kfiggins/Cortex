# Phase 7 — Memory Evolution Hooks

## Status: Not Started

---

## Goal

Make memory a first-class concept that persists across runs and can be manually edited, with a clear hook point for future automated memory updates.

This phase is deliberately conservative: we build the infrastructure for memory evolution without automating it. Automation comes in V2 once the pattern is validated.

---

## Prerequisites

- Phase 6 complete and committed
- `AgentConfig.memory` being injected into prompts (Phase 3)
- `memory.md` auto-created on first load (Phase 1)
- `StorageAdapter` working (Phase 4)

---

## What "Memory" Is

`memory.md` is a freeform markdown file per agent that gets injected into the system prompt on every run. Unlike `brain.md` (which is static persona/instructions), `memory.md` is designed to evolve.

Examples of memory content:
- Preferences the user has stated
- Context from previous conversations
- Facts the agent has "learned"
- Notes the agent wants to reference

For now, the **user** edits this file manually. In V2, the agent will suggest updates.

---

## What to Build

### Ensure Memory Loads Fresh Every Run

The runner must reload `memory.md` from disk at the start of every `run()` call — not once at startup.

If memory is loaded once at startup (as it might be from Phase 1's `getAllAgents()`), the runner will use stale memory after the user edits the file.

Fix: the runner or a memory loader reads the file fresh before assembling the prompt.

```ts
// src/runtime/memory-loader.ts
export async function loadMemory(agentDir: string): Promise<string>
export async function saveMemory(agentDir: string, content: string): Promise<void>
```

### Memory Edit Command

Add a keyboard shortcut or CLI command to open `memory.md` in the user's `$EDITOR`.

```
Ctrl+M  →  open current agent's memory.md in $EDITOR
           suspend TUI, wait for editor to close, resume
```

Implementation:
```ts
// src/ui/editor.ts
export async function openInEditor(filePath: string): Promise<void>
```

Uses `$EDITOR` env var, falls back to `vi`. Suspends the TUI process while editor is open.

### Memory Hook Point

Add a designated, clearly-commented hook in the runner where future automation will plug in:

```ts
// After AgentCompleted:
// MEMORY HOOK: In V2, the system will analyze the conversation
// and suggest updates to memory.md here.
// For now, this is a no-op.
await onMemoryHook?.({
  agentName: input.agentConfig.name,
  conversation: [...history, assistantMessage],
});
```

The `onMemoryHook` is an optional callback on the runner input or factory. Leaving it as `undefined` = no-op.

---

## Memory Injection Format

In the system prompt, memory is injected clearly:

```
You are <agent-name>.

<brain.md>

---
## Memory

The following is context from previous sessions:

<memory.md>

---
```

If `memory.md` is empty, omit the memory section entirely (don't inject empty noise).

---

## Test Coverage Required

```
tests/runtime/memory-loader.test.ts
tests/runtime/runner-memory.test.ts
```

### Scenarios to Cover

- [ ] `loadMemory()` returns file contents when file exists
- [ ] `loadMemory()` returns empty string when file does not exist
- [ ] `saveMemory()` writes content to file
- [ ] `saveMemory()` creates file if it doesn't exist
- [ ] Runner reloads memory fresh on each `run()` call (simulate editing file between runs)
- [ ] Empty memory → memory section omitted from system prompt
- [ ] Non-empty memory → memory section present in system prompt with correct content
- [ ] Memory hook callback is invoked after `AgentCompleted` (when provided)
- [ ] Memory hook receiving `undefined` → no error, no-op

---

## What NOT to Do in This Phase

- Do not automate memory updates
- Do not implement any LLM call to analyze and update memory
- Do not store memory in JSONL or any database — keep it as `memory.md`
- Do not merge transcript history into memory automatically
- Do not change the `brain.md` file — it is read-only

---

## Completion Steps

1. Create `src/runtime/memory-loader.ts`
2. Update runner to call `loadMemory()` fresh at the start of each `run()`
3. Update `buildSystemPrompt()` to omit memory section when memory is empty
4. Add memory hook callback to runner (no-op by default)
5. Create `src/ui/editor.ts` for `$EDITOR` integration
6. Wire `Ctrl+M` in the TUI to open current agent's memory
7. Write all tests
8. Manual test: edit `memory.md` while app is running, send a message — verify new memory is used
9. Run lint
10. Review: is memory clearly separated from brain? From transcript? It should be.
11. Refactor if needed
12. Update CLAUDE.md Phase Status table to mark all phases complete
13. Final audit: re-read all V2 guardrails in CLAUDE.md — are any accidentally implemented? Remove them.
14. Commit: `feat: phase 7 - memory evolution hooks`

---

## Definition of Done (Full Project)

When this phase is complete, the following must all be true:

- [ ] Multiple agents load from `agents/` directory
- [ ] You can switch between agents in the TUI
- [ ] Each agent has persistent memory injected into every prompt
- [ ] Each agent streams Claude output independently in the TUI
- [ ] All agents have independent, non-contaminating transcripts
- [ ] All phases have passing tests
- [ ] `npm run lint` passes
- [ ] `tsc --noEmit` passes
- [ ] CLAUDE.md Phase Status table shows all phases complete
- [ ] Codebase is clean: no TODO comments, no dead code, no `any` types

---

## Previous Phase

[Phase 6 — Multi-Agent Concurrency](./phase-6.md)

---

## What's Next (V2 Scope — Do Not Start)

These are the features designed around, not implemented:
- Pipeline engine (agent output → next agent input)
- Automatic memory updates via LLM analysis
- Tool execution framework
- Agent orchestration rules
- Autonomous mode (agents run without user prompting)
- Artifact browser
