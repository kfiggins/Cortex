# Phase 1 — Agent Configuration System

## Status: Complete

---

## Goal

Load agent definitions from disk. This is the foundation of everything — agents are the core unit of the system. Every subsequent phase depends on a stable, validated agent config.

Do not rush through validation. Garbage in = garbage runtime behavior.

---

## Prerequisites

- Phase 0 complete and committed

---

## Agent File Structure

Each agent lives in its own directory under `agents/`:

```
agents/
└── <agent-name>/
    ├── agent.yaml    # Required — metadata and config
    ├── brain.md      # Required — system prompt / persona
    └── memory.md     # Auto-created if missing — evolving context
```

### `agent.yaml` Schema

```yaml
name: string           # Must match directory name
description: string    # Human-readable purpose
model: string          # Claude model to use (e.g. claude-sonnet-4-6)
tools: []              # Reserved for V2 — leave empty for now
```

---

## What to Build

### `src/agents/loader.ts`

Responsible for:
1. Reading the `agents/` directory
2. For each subdirectory: loading and validating `agent.yaml`
3. Loading `brain.md` contents
4. Loading or creating `memory.md`
5. Returning a validated `AgentConfig[]`

### `src/agents/validator.ts`

Responsible for:
- Validating the parsed YAML against the expected schema
- Throwing a descriptive error on invalid config
- No external schema library needed — keep it simple with manual checks

### `src/core/types.ts`

Define the `AgentConfig` interface here (single source of truth):

```ts
export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  brain: string;    // file contents
  memory: string;   // file contents (empty string if auto-created)
  tools: string[];  // reserved, always []
}
```

---

## Public API

```ts
// src/agents/loader.ts
export async function getAllAgents(agentsDir: string): Promise<AgentConfig[]>
```

- Takes an explicit path (no hardcoded paths, no global state)
- Returns array of validated, fully-loaded agent configs
- Throws on unrecoverable errors (e.g. missing `brain.md`)
- Auto-creates `memory.md` silently if missing

---

## Error Handling Requirements

| Condition                    | Behavior                                        |
|------------------------------|-------------------------------------------------|
| `agent.yaml` missing         | Skip the directory, log a warning               |
| `agent.yaml` malformed YAML  | Throw with agent name in message                |
| `agent.yaml` invalid schema  | Throw with field name and agent name            |
| `brain.md` missing           | Throw — this is a hard requirement              |
| `memory.md` missing          | Create empty file, continue                     |
| `agents/` dir missing        | Throw with helpful message                      |

---

## Dependencies to Add

```
js-yaml         # YAML parsing
```

No schema validation library (zod, etc.) yet — manual validation keeps dependencies lean.
Revisit in a later phase if validation grows complex.

---

## Test Coverage Required

```
tests/agents/loader.test.ts
tests/agents/validator.test.ts
```

### Scenarios to Cover

- [ ] Valid agent loads correctly (all fields present)
- [ ] Agent with missing `memory.md` — file is auto-created, agent loads
- [ ] Agent with missing `brain.md` — throws with clear error
- [ ] Agent with malformed YAML — throws with clear error
- [ ] Agent with missing required field in YAML — throws with field name
- [ ] `agents/` directory with multiple valid agents — all load
- [ ] Empty `agents/` directory — returns empty array, no error
- [ ] `agents/` directory does not exist — throws

### Test Setup Pattern

Use a temp directory per test. Do not rely on the real `agents/` directory for tests.

```ts
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function createTempAgentsDir(): string {
  return mkdtempSync(join(tmpdir(), 'cortex-test-'));
}
```

---

## What NOT to Do in This Phase

- Do not load agents on module import (keep it a function call)
- Do not hardcode the agents directory path anywhere in `src/`
- Do not start building the event bus or runtime
- Do not add memory auto-update logic (that's Phase 7)
- Do not use `any` — validate and narrow types properly

---

## Completion Steps

1. Add `js-yaml` dependency
2. Create `src/core/types.ts` with `AgentConfig`
3. Create `src/agents/validator.ts`
4. Create `src/agents/loader.ts`
5. Write all tests, verify they pass
6. Run lint, fix issues
7. Review: are the abstractions clean? Is `loader.ts` doing too much?
8. Refactor if needed
9. Update CLAUDE.md Phase Status table
10. Commit: `feat: phase 1 - agent configuration system`

---

## Previous Phase

[Phase 0 — Project Foundation](./phase-0.md)

## Next Phase

[Phase 2 — Event Bus Core](./phase-2.md)
