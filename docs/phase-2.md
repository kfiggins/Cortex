# Phase 2 — Event Bus Core

## Status: Not Started

---

## Goal

Introduce event-driven architecture as the communication backbone of the system.

The event bus is how the runtime, UI, and storage will coordinate — without any of them importing each other. Get this right and everything else composes cleanly. Get it wrong and you end up with spaghetti coupling.

---

## Prerequisites

- Phase 1 complete and committed

---

## Why an Event Bus

Without an event bus:
- Runtime calls UI directly → tight coupling
- Adding storage means touching runtime code
- Testing requires wiring up real UI

With an event bus:
- Runtime emits events, knows nothing about consumers
- UI subscribes, knows nothing about runtime internals
- Storage subscribes independently
- Each layer is testable in isolation

---

## What to Build

### `src/core/events.ts`

The canonical event type definitions. **This file is the contract between all layers.**

```ts
export type AgentEventType =
  | 'AgentStarted'
  | 'AgentStreaming'
  | 'AgentCompleted'
  | 'AgentErrored';

export interface AgentStartedEvent {
  type: 'AgentStarted';
  agentName: string;
}

export interface AgentStreamingEvent {
  type: 'AgentStreaming';
  agentName: string;
  payload: { chunk: string };
}

export interface AgentCompletedEvent {
  type: 'AgentCompleted';
  agentName: string;
  payload: { fullResponse: string };
}

export interface AgentErroredEvent {
  type: 'AgentErrored';
  agentName: string;
  payload: { error: Error };
}

export type AgentEvent =
  | AgentStartedEvent
  | AgentStreamingEvent
  | AgentCompletedEvent
  | AgentErroredEvent;
```

### `src/core/event-bus.ts`

A lightweight, typed event emitter. Do NOT extend Node's `EventEmitter` — build a thin wrapper so we control the interface.

```ts
export interface EventBus {
  emit(event: AgentEvent): void;
  on<T extends AgentEvent>(
    type: T['type'],
    handler: (event: T) => void
  ): () => void;  // returns unsubscribe function
  off(type: AgentEventType, handler: Function): void;
}

export function createEventBus(): EventBus { ... }
```

Requirements:
- `on()` returns an unsubscribe function (prevents memory leaks)
- Multiple handlers per event type supported
- Synchronous dispatch (no async handlers in the bus itself)
- No wildcards yet (keep it simple)

---

## Design Notes

### Why return an unsubscribe function from `on()`

When the TUI switches agents, old event handlers must be cleaned up. Returning an unsubscribe function makes this explicit at the call site.

### Why synchronous dispatch

Async dispatch adds complexity without benefit at this stage. Handlers that need async behavior own that internally.

### `payload` field convention

All events carry a `payload` field (or nothing). This keeps the pattern consistent and leaves room for V2 pipeline features where payloads are passed between agents.

---

## What This Phase Does NOT Include

- No Claude integration
- No UI
- No storage
- No agent lifecycle management
- No wildcard subscriptions

---

## Test Coverage Required

```
tests/core/event-bus.test.ts
```

### Scenarios to Cover

- [ ] Emit an event, handler receives it with correct type and payload
- [ ] Multiple handlers on the same event type — all called
- [ ] Unsubscribe function removes handler — subsequent emits not received
- [ ] `off()` removes handler correctly
- [ ] Handler for one event type does not fire for another type
- [ ] Simulate multi-agent event sequence:
  - Emit `AgentStarted` for agent-a
  - Emit `AgentStarted` for agent-b
  - Emit `AgentStreaming` for agent-a (3 chunks)
  - Emit `AgentStreaming` for agent-b (2 chunks)
  - Emit `AgentCompleted` for agent-a
  - Emit `AgentErrored` for agent-b
  - Assert handlers received events in correct order with correct agent names

---

## Completion Steps

1. Create `src/core/events.ts` — event type definitions
2. Create `src/core/event-bus.ts` — bus implementation
3. Write all tests, verify they pass
4. Run lint
5. Review: does the bus have any knowledge of agents, UI, or storage? It shouldn't.
6. Review: is the interface easy to use and easy to mock in tests?
7. Refactor if needed
8. Update CLAUDE.md Phase Status table
9. Commit: `feat: phase 2 - event bus core`

---

## Previous Phase

[Phase 1 — Agent Configuration System](./phase-1.md)

## Next Phase

[Phase 3 — Claude Runtime Layer](./phase-3.md)
