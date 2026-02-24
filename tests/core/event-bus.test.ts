import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '../../src/core/event-bus.js';
import type {
  AgentStartedEvent,
  AgentStreamingEvent,
  AgentCompletedEvent,
  AgentErroredEvent,
} from '../../src/core/events.js';

// ── helpers ────────────────────────────────────────────────────────────────

const started = (agentName: string): AgentStartedEvent => ({
  type: 'AgentStarted',
  agentName,
});

const streaming = (agentName: string, chunk: string): AgentStreamingEvent => ({
  type: 'AgentStreaming',
  agentName,
  payload: { chunk },
});

const completed = (agentName: string, fullResponse: string): AgentCompletedEvent => ({
  type: 'AgentCompleted',
  agentName,
  payload: { fullResponse },
});

const errored = (agentName: string, error: Error): AgentErroredEvent => ({
  type: 'AgentErrored',
  agentName,
  payload: { error },
});

// ── tests ──────────────────────────────────────────────────────────────────

describe('createEventBus', () => {
  it('delivers an emitted event to a subscribed handler', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('AgentStarted', handler);
    bus.emit(started('agent-a'));

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(started('agent-a'));
  });

  it('delivers the full payload to the handler', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('AgentStreaming', handler);
    bus.emit(streaming('agent-a', 'hello'));

    expect(handler).toHaveBeenCalledWith(streaming('agent-a', 'hello'));
  });

  it('calls all handlers registered for the same event type', () => {
    const bus = createEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    const h3 = vi.fn();

    bus.on('AgentStarted', h1);
    bus.on('AgentStarted', h2);
    bus.on('AgentStarted', h3);
    bus.emit(started('agent-a'));

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
    expect(h3).toHaveBeenCalledOnce();
  });

  it('unsubscribe function prevents future events from reaching the handler', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    const unsub = bus.on('AgentStarted', handler);
    unsub();
    bus.emit(started('agent-a'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribe does not affect other handlers on the same type', () => {
    const bus = createEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    const unsub = bus.on('AgentStarted', h1);
    bus.on('AgentStarted', h2);
    unsub();
    bus.emit(started('agent-a'));

    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('off() removes a handler by reference', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('AgentCompleted', handler);
    bus.off('AgentCompleted', handler);
    bus.emit(completed('agent-a', 'done'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire a handler registered for a different event type', () => {
    const bus = createEventBus();
    const streamHandler = vi.fn();
    const startedHandler = vi.fn();

    bus.on('AgentStreaming', streamHandler);
    bus.on('AgentStarted', startedHandler);
    bus.emit(started('agent-a'));

    expect(startedHandler).toHaveBeenCalledOnce();
    expect(streamHandler).not.toHaveBeenCalled();
  });

  it('emitting with no subscribers does not throw', () => {
    const bus = createEventBus();
    expect(() => bus.emit(started('agent-a'))).not.toThrow();
  });

  it('off() on a type with no handlers does not throw', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    expect(() => bus.off('AgentStarted', handler)).not.toThrow();
  });

  it('can emit multiple times and handler is called each time', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('AgentStreaming', handler);
    bus.emit(streaming('agent-a', 'chunk-1'));
    bus.emit(streaming('agent-a', 'chunk-2'));
    bus.emit(streaming('agent-a', 'chunk-3'));

    expect(handler).toHaveBeenCalledTimes(3);
  });

  describe('multi-agent event sequence', () => {
    it('routes events to the correct handlers with correct agent names', () => {
      const bus = createEventBus();
      const received: string[] = [];

      bus.on('AgentStarted', (e) => received.push(`started:${e.agentName}`));
      bus.on('AgentStreaming', (e) => received.push(`streaming:${e.agentName}:${e.payload.chunk}`));
      bus.on('AgentCompleted', (e) => received.push(`completed:${e.agentName}`));
      bus.on('AgentErrored', (e) => received.push(`errored:${e.agentName}`));

      bus.emit(started('agent-a'));
      bus.emit(started('agent-b'));
      bus.emit(streaming('agent-a', 'a1'));
      bus.emit(streaming('agent-b', 'b1'));
      bus.emit(streaming('agent-a', 'a2'));
      bus.emit(streaming('agent-b', 'b2'));
      bus.emit(streaming('agent-a', 'a3'));
      bus.emit(completed('agent-a', 'full response'));
      bus.emit(errored('agent-b', new Error('oops')));

      expect(received).toEqual([
        'started:agent-a',
        'started:agent-b',
        'streaming:agent-a:a1',
        'streaming:agent-b:b1',
        'streaming:agent-a:a2',
        'streaming:agent-b:b2',
        'streaming:agent-a:a3',
        'completed:agent-a',
        'errored:agent-b',
      ]);
    });

    it('per-agent subscriber only receives events for its agent', () => {
      const bus = createEventBus();
      const agentAChunks: string[] = [];
      const agentBChunks: string[] = [];

      bus.on('AgentStreaming', (e) => {
        if (e.agentName === 'agent-a') agentAChunks.push(e.payload.chunk);
      });
      bus.on('AgentStreaming', (e) => {
        if (e.agentName === 'agent-b') agentBChunks.push(e.payload.chunk);
      });

      bus.emit(streaming('agent-a', 'a1'));
      bus.emit(streaming('agent-b', 'b1'));
      bus.emit(streaming('agent-a', 'a2'));

      expect(agentAChunks).toEqual(['a1', 'a2']);
      expect(agentBChunks).toEqual(['b1']);
    });

    it('AgentErrored payload carries the original error', () => {
      const bus = createEventBus();
      const err = new Error('process died');
      let received: Error | null = null;

      bus.on('AgentErrored', (e) => {
        received = e.payload.error;
      });
      bus.emit(errored('agent-a', err));

      expect(received).toBe(err);
    });
  });
});
