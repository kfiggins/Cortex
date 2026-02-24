import type { AgentEvent, AgentEventType } from './events.js';

type Handler<T extends AgentEvent> = (event: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = Handler<any>;

export interface EventBus {
  /**
   * Emit an event synchronously to all registered handlers of that type.
   */
  emit(event: AgentEvent): void;

  /**
   * Subscribe to events of a specific type.
   * Returns an unsubscribe function — call it to remove the handler.
   */
  on<T extends AgentEvent>(type: T['type'], handler: Handler<T>): () => void;

  /**
   * Unsubscribe a handler by reference.
   */
  off(type: AgentEventType, handler: AnyHandler): void;
}

export function createEventBus(): EventBus {
  const handlers = new Map<AgentEventType, Set<AnyHandler>>();

  function getOrCreate(type: AgentEventType): Set<AnyHandler> {
    let set = handlers.get(type);
    if (!set) {
      set = new Set();
      handlers.set(type, set);
    }
    return set;
  }

  return {
    emit(event: AgentEvent): void {
      const set = handlers.get(event.type);
      if (!set) return;
      // Snapshot before iterating so unsubscribes during emit are safe
      for (const handler of [...set]) {
        handler(event);
      }
    },

    on<T extends AgentEvent>(type: T['type'], handler: Handler<T>): () => void {
      getOrCreate(type).add(handler as AnyHandler);
      return () => {
        handlers.get(type)?.delete(handler as AnyHandler);
      };
    },

    off(type: AgentEventType, handler: AnyHandler): void {
      handlers.get(type)?.delete(handler);
    },
  };
}
