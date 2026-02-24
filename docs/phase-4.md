# Phase 4 — Persistence Layer

## Status: Complete

---

## Goal

Implement real transcript storage so conversation history survives process restarts.
Replace the noop `StorageAdapter` stub from Phase 3 with a real JSONL implementation.

---

## Prerequisites

- Phase 3 complete and committed
- `StorageAdapter` interface defined in `src/core/types.ts`
- Noop adapter exists in `src/storage/noop-adapter.ts`

---

## Storage Format

### JSONL (JSON Lines)

One JSON object per line. Each line is a `Message`.

```jsonl
{"role":"user","content":"Hello","timestamp":1700000001000}
{"role":"assistant","content":"Hi there!","timestamp":1700000002000}
```

### File Layout

```
.cortex/
└── transcripts/
    └── <agent-name>/
        └── transcript.jsonl
```

The `.cortex/` directory lives in the project root (or a configurable base path — see below).

---

## What to Build

### `src/storage/jsonl-adapter.ts`

Implements `StorageAdapter`:

```ts
export function createJsonlAdapter(baseDir: string): StorageAdapter
```

- `baseDir` is passed explicitly (no hardcoded paths)
- Creates `<baseDir>/transcripts/<agentName>/` directory on first write if it doesn't exist
- `appendMessage` appends one JSON line to `transcript.jsonl`
- `loadHistory` reads the file, parses each line, returns last `N` messages (default: all)

### Design Notes

- Use `fs/promises` for async file operations
- Append with `fs.appendFile` — no need to read-modify-write
- For `loadHistory`: read entire file, split on newlines, parse, slice from end
- Handle empty file gracefully (return `[]`)
- Handle malformed lines: skip and log a warning (do not crash)

---

## `StorageAdapter` Interface (from Phase 3)

```ts
export interface StorageAdapter {
  appendMessage(agentName: string, message: Message): Promise<void>;
  loadHistory(agentName: string, limit?: number): Promise<Message[]>;
}
```

This is already in `src/core/types.ts`. Do not change it without updating CLAUDE.md.

---

## Integration with Runner

Update `src/runtime/runner.ts` to:
1. Accept a real `StorageAdapter` (already does via interface)
2. At run start: call `loadHistory()` to populate context
3. After user message: append user message to transcript
4. After streaming completes: append assistant message to transcript

The runner still knows nothing about JSONL — it only uses the interface.

---

## Error Handling Requirements

| Condition                         | Behavior                                        |
|-----------------------------------|-------------------------------------------------|
| Transcript file does not exist    | Return empty array (not an error)               |
| Transcript directory missing      | Create it automatically                         |
| Malformed line in transcript      | Skip line, log warning, continue                |
| Write failure                     | Throw — this is a real error                    |
| Disk full                         | Let it throw naturally                          |

---

## Configuration

The base directory should be configurable. For now, default to `.cortex` relative to `process.cwd()`.

Expose a simple config interface in `src/core/config.ts`:

```ts
export interface CortexConfig {
  agentsDir: string;      // default: './agents'
  storageDir: string;     // default: './.cortex'
}

export function getDefaultConfig(): CortexConfig
```

This is the **only place** defaults are defined. Both the runner and storage adapter receive paths from here — they never construct paths themselves.

---

## Test Coverage Required

```
tests/storage/jsonl-adapter.test.ts
tests/core/config.test.ts
```

### Test Setup

Use temp directories. Clean up after each test.

```ts
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach } from 'vitest';

let tempDir: string;
beforeEach(() => { tempDir = mkdtempSync(join(tmpdir(), 'cortex-storage-')); });
afterEach(() => { rmSync(tempDir, { recursive: true }); });
```

### Scenarios to Cover

- [ ] Append one message — file created with correct content
- [ ] Append multiple messages — each on its own line
- [ ] Load history — returns messages in chronological order
- [ ] Load history with `limit: 3` — returns only last 3 messages
- [ ] Load history from non-existent file — returns `[]`
- [ ] Load history from empty file — returns `[]`
- [ ] Load history with one malformed line — skips it, returns rest
- [ ] Two agents write to different directories without interference
- [ ] **Integration test**: append messages, restart (new adapter instance), load history — verify persistence

---

## What NOT to Do in This Phase

- Do not add SQLite or any database — JSONL is intentional and sufficient
- Do not compress or rotate transcripts yet
- Do not add search or indexing
- Do not change the `StorageAdapter` interface without updating CLAUDE.md and the runner

---

## Completion Steps

1. Create `src/core/config.ts` with `CortexConfig`
2. Create `src/storage/jsonl-adapter.ts`
3. Update `src/runtime/runner.ts` to use real storage adapter
4. Update `index.ts` to wire up the real adapter (replacing noop)
5. Write all tests
6. **Integration test**: run a full mock conversation and verify transcript on disk
7. Run lint
8. Review: is the adapter truly swappable? Could you swap it for SQLite without changing the runner?
9. Refactor if needed
10. Update CLAUDE.md Phase Status table
11. Commit: `feat: phase 4 - persistence layer`

---

## Previous Phase

[Phase 3 — Claude Runtime Layer](./phase-3.md)

## Next Phase

[Phase 5 — TUI Interface](./phase-5.md)
