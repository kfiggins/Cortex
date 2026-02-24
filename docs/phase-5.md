# Phase 5 — TUI Interface

## Status: Not Started

---

## Goal

Build a stable, keyboard-navigable split-pane terminal UI that renders streaming agent output and allows the user to switch between agents and send messages.

The UI is a **consumer** of the event bus and the agent config system. It does not call the runner directly. It does not touch storage. It only reads state and dispatches user actions.

---

## Prerequisites

- Phase 4 complete and committed
- Event bus working
- Agent configs loading
- Runner streaming via events
- Persistence layer wired

---

## Layout

```
┌─────────────────┬───────────────────────────────────────┐
│  Agents         │  Chat: <agent-name>                   │
│                 │                                       │
│ ► agent-a  ●   │  user: Hello                          │
│   agent-b  ○   │  assistant: Hi there! I can help...   │
│   agent-c       │                                       │
│                 │  [streaming...]                       │
│                 │                                       │
├─────────────────┴───────────────────────────────────────┤
│ > ___                                                   │
└─────────────────────────────────────────────────────────┘
```

- **Left pane**: Agent list with status indicators
- **Right pane**: Chat window for the selected agent
- **Bottom bar**: Input box

### Status Indicators

| Symbol | Meaning      |
|--------|--------------|
| `●`    | Running      |
| `○`    | Idle         |
| `✗`    | Error        |

---

## TUI Library Decision

Decide before building. Document the choice in CLAUDE.md.

| Option  | Pros                                    | Cons                              |
|---------|-----------------------------------------|-----------------------------------|
| **Ink** | React model, composable, TypeScript-first | Requires React knowledge, some limitations |
| **blessed** | Mature, low-level control          | Harder to type, older API style   |
| **terminal-kit** | Simple, good streaming support | Less community, fewer types |

**Recommendation**: Ink — composable components map cleanly to the panel structure.
If you choose differently, document the reason in CLAUDE.md.

---

## UI State (`src/ui/state.ts`)

The UI state is **pure data**. No side effects. No imports from runtime or storage.

```ts
export interface AgentStatus {
  name: string;
  status: 'idle' | 'running' | 'error';
  messages: Message[];
  currentStream: string;  // in-progress streaming text
}

export interface UIState {
  agents: AgentStatus[];
  selectedAgentName: string | null;
  inputValue: string;
}
```

State transitions happen in `src/ui/state-manager.ts` — a set of pure reducer functions.

### State Manager

```ts
export function applyEvent(state: UIState, event: AgentEvent): UIState
export function selectAgent(state: UIState, agentName: string): UIState
export function updateInput(state: UIState, value: string): UIState
export function clearStream(state: UIState, agentName: string): UIState
```

All pure functions. No mutation. This is what you test.

---

## Component Structure (if using Ink)

```
src/ui/
├── state.ts              # UIState types
├── state-manager.ts      # Pure state reducers
├── App.tsx               # Root component, wires event bus to state
├── components/
│   ├── AgentList.tsx     # Left pane
│   ├── ChatWindow.tsx    # Right pane
│   ├── MessageList.tsx   # Scrollable message history
│   ├── StreamChunk.tsx   # In-progress stream rendering
│   └── InputBar.tsx      # Bottom input
```

---

## Keyboard Navigation

| Key          | Action                             |
|--------------|------------------------------------|
| `↑` / `↓`   | Navigate agent list                |
| `Enter`      | Select highlighted agent           |
| `Tab`        | Toggle focus between list / input  |
| `Enter` (input) | Send message                   |
| `Ctrl+C`     | Quit                               |

---

## Event Bus Integration

`App.tsx` (or equivalent root) subscribes to all agent events and applies them to UI state:

```ts
eventBus.on('AgentStarted', (e) => setState(s => applyEvent(s, e)));
eventBus.on('AgentStreaming', (e) => setState(s => applyEvent(s, e)));
eventBus.on('AgentCompleted', (e) => setState(s => applyEvent(s, e)));
eventBus.on('AgentErrored', (e) => setState(s => applyEvent(s, e)));
```

The UI **never imports from `src/runtime/`**. It only reads events.

---

## Sending a Message

When the user submits input:
1. UI clears the input field
2. UI dispatches to a callback provided by `index.ts`
3. `index.ts` calls `runner.run(...)` with the current agent and message
4. Events flow back through the bus to the UI

The UI does not call the runner directly. It invokes a callback. This preserves the layering.

---

## Test Coverage Required

```
tests/ui/state-manager.test.ts
```

Test state logic only. Do NOT test visual rendering.

### Scenarios to Cover

- [ ] `applyEvent` with `AgentStarted` — sets agent status to `running`
- [ ] `applyEvent` with `AgentStreaming` — appends to `currentStream`
- [ ] `applyEvent` with `AgentCompleted` — moves `currentStream` to `messages`, clears stream, sets status to `idle`
- [ ] `applyEvent` with `AgentErrored` — sets status to `error`
- [ ] `selectAgent` — updates `selectedAgentName`
- [ ] `updateInput` — updates `inputValue`
- [ ] Events for non-selected agent update their own status without affecting selected agent's chat view
- [ ] Switching agents while one is streaming — does not interrupt streaming, shows other agent's history

---

## What NOT to Do in This Phase

- Do not import from `src/runtime/` inside any `src/ui/` file
- Do not put business logic inside components
- Do not test visual output
- Do not handle multi-agent concurrency here (that's Phase 6)
- Do not auto-scroll implementation (nice to have, not required)

---

## Completion Steps

1. Choose TUI library, document in CLAUDE.md
2. Install TUI library
3. Create `src/ui/state.ts`
4. Create `src/ui/state-manager.ts` (pure reducers)
5. Write state manager tests first
6. Build UI components
7. Wire event bus to state in `App.tsx`
8. Wire user input callback in `index.ts`
9. Manual test: run the app, switch agents, send a message
10. Verify: switching agents does not interrupt a running one
11. Run lint
12. Review UI state boundaries — is any runtime logic leaking into components?
13. Refactor if needed
14. Update CLAUDE.md Phase Status table
15. Commit: `feat: phase 5 - tui interface`

---

## Previous Phase

[Phase 4 — Persistence Layer](./phase-4.md)

## Next Phase

[Phase 6 — Multi-Agent Concurrency](./phase-6.md)
