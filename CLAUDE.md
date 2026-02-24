# Cortex — CLAUDE.md

This file is the source of truth for all agents working on this project.
Read it fully before making any changes. Update it when architectural decisions are made.

---

## Project Overview

Cortex is a terminal-based multi-agent orchestration system that allows multiple Claude processes to run concurrently, each with independent context, memory, and streaming output — all navigable through a split-pane TUI.

---

## Current Phase

> **All phases complete.**

Phase 0 complete. Node 18 in use — `import.meta.dirname` unavailable, use `fileURLToPath`+`dirname` pattern.
Phase 1 complete. `NodeJS.ErrnoException` unavailable in ESLint — use `Error & { code: string }` instead.
Phase 3 complete. `proc.stdout`/`proc.stderr` require cast to `NonNullable<...>` when stdio is `'pipe'`.
Phase 5 complete. TUI library: **Ink** (React-based). `src/ui/` must not import from `src/runtime/`. UI sends messages via `onSendMessage` callback from `index.ts`. State is pure data in `src/ui/state-manager.ts`. TSX support added: `tsconfig.json` `jsx: react-jsx`, `jsxImportSource: react`; `eslint.config.js` extended to `**/*.tsx`.
Phase 6 complete. Concurrency model: one `ClaudeRunner` per agent, sharing event bus + storage (both designed for it). All runner state is instance-local (closure). `RunnerRegistry` (`src/runtime/runner-registry.ts`) wraps the per-agent Map explicitly. No module-level mutable state anywhere in runtime.
Phase 7 complete. Memory reloaded fresh from disk each `run()` via `RunnerHooks.loadMemory`. `onMemoryHook` callback fires after `AgentCompleted` (no-op until V2). `Ctrl+M` opens agent's `memory.md` in `$EDITOR`. `buildSystemPrompt` omits memory section when empty.

---

## Architecture Principles

1. **No global state.** Pass dependencies explicitly.
2. **No direct UI-to-runtime coupling.** UI reads from state/events only.
3. **Event bus is independent.** It knows nothing about agents, UI, or storage.
4. **Storage is swappable.** No runtime code should import storage directly — use an interface.
5. **Runtime must support pipeline chaining.** Design ClaudeRunner to accept piped input/output hooks.
6. **Each layer has one job.** Violating this now creates rewrites later.

---

## Directory Structure

```
Cortex/
├── CLAUDE.md                  # This file
├── docs/
│   ├── phase-0.md
│   ├── phase-1.md
│   ├── phase-2.md
│   ├── phase-3.md
│   ├── phase-4.md
│   ├── phase-5.md
│   ├── phase-6.md
│   └── phase-7.md
├── agents/                    # Agent definitions (runtime data, not src)
│   └── <agent-name>/
│       ├── agent.yaml
│       ├── brain.md
│       └── memory.md
├── src/
│   ├── core/                  # Shared types, interfaces, constants
│   ├── agents/                # Agent config loading + validation
│   ├── runtime/               # ClaudeRunner, process management
│   ├── ui/                    # TUI components and state
│   └── storage/               # JSONL transcript persistence
├── tests/                     # Mirrors src/ structure
├── index.ts                   # CLI entrypoint
├── package.json
├── tsconfig.json
├── .eslintrc
└── .prettierrc
```

---

## Key Interfaces (Do Not Change Without Updating This File)

These are the contracts between layers. Changing them affects multiple phases.

### `AgentConfig`
```ts
interface AgentConfig {
  name: string;
  description: string;
  brain: string;       // contents of brain.md
  memory: string;      // contents of memory.md
}
```

### `AgentEvent`
```ts
type AgentEventType =
  | 'AgentStarted'
  | 'AgentStreaming'
  | 'AgentCompleted'
  | 'AgentErrored';

interface AgentEvent {
  type: AgentEventType;
  agentName: string;
  payload?: unknown;
}
```

### `ClaudeRunner` (interface, not class)
```ts
interface ClaudeRunner {
  run(input: RunnerInput): Promise<void>;
  on(event: AgentEventType, handler: (e: AgentEvent) => void): void;
}

interface RunnerInput {
  agentConfig: AgentConfig;
  userMessage: string;
  history: Message[];
}
```

### `StorageAdapter` (swappable)
```ts
interface StorageAdapter {
  appendMessage(agentName: string, message: Message): Promise<void>;
  loadHistory(agentName: string, limit?: number): Promise<Message[]>;
}
```

---

## V2 Compatibility Guardrails

Do NOT implement these. DO design around them:

| Future Feature         | Design Constraint Today                                  |
|------------------------|----------------------------------------------------------|
| Pipeline engine        | Runner accepts input/output hooks, not hardcoded IO      |
| Agent orchestration    | Agents never call each other directly                    |
| Tool execution         | Reserve `tools` field in agent.yaml (optional, unused)   |
| Autonomous mode        | Keep human-in-loop as a flag, not a structural assumption|
| Artifact passing       | Events carry a `payload` field for future data passing   |

---

## Tech Stack

| Concern        | Choice          |
|----------------|-----------------|
| Language       | TypeScript       |
| Runtime        | Node.js (bun-compatible) |
| Test runner    | Vitest           |
| Linter         | ESLint           |
| Formatter      | Prettier         |
| TUI            | Ink (React-based TUI) — chosen in Phase 5            |
| Storage        | JSONL files      |
| Agent config   | YAML             |

---

## Phase Status

| Phase | Name                        | Status      |
|-------|-----------------------------|-------------|
| 0     | Project Foundation          | Complete    |
| 1     | Agent Configuration System  | Complete    |
| 2     | Event Bus Core              | Complete    |
| 3     | Claude Runtime Layer        | Complete    |
| 4     | Persistence Layer           | Complete    |
| 5     | TUI Interface               | Complete    |
| 6     | Multi-Agent Concurrency     | Complete    |
| 7     | Memory Evolution Hooks      | Complete    |

---

## Phase Completion Checklist

Before marking any phase done:
- [ ] All acceptance criteria met
- [ ] Tests written and passing
- [ ] Abstractions reviewed and clean
- [ ] CLAUDE.md updated if interfaces changed
- [ ] Committed

---

## Non-Goals (Do Not Build)

- Artifact browser
- Tool execution framework
- Web UI
- Windows support
- Plugin/agent marketplace
- Auto-pipelines

---

## Working Conventions

- **One concern per file.** If a file is doing two things, split it.
- **Tests mirror source.** `tests/agents/loader.test.ts` for `src/agents/loader.ts`.
- **No barrel `index.ts` files** in internal layers — import directly.
- **Errors must surface.** Never swallow exceptions silently.
- **No `any`.** Use `unknown` and narrow properly.
- **Update this file** when you make a structural decision that affects other phases.
