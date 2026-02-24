import { describe, it, expect, vi } from 'vitest';
import { createClaudeRunner } from '../../src/runtime/runner.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createNoopAdapter } from '../../src/storage/noop-adapter.js';
import { createMockSpawn, createErrorSpawn } from '../helpers/mock-spawn.js';
import type { AgentConfig, StorageAdapter } from '../../src/core/types.js';
import type { AgentEvent } from '../../src/core/events.js';

// ── helpers ────────────────────────────────────────────────────────────────

function makeAgentConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    name: 'test-agent',
    description: 'A test agent',
    model: 'claude-sonnet-4-6',
    brain: 'You are a test assistant.',
    memory: '',
    tools: [],
    ...overrides,
  };
}

function collectEvents(bus: ReturnType<typeof createEventBus>): AgentEvent[] {
  const events: AgentEvent[] = [];
  bus.on('AgentStarted', (e) => events.push(e));
  bus.on('AgentStreaming', (e) => events.push(e));
  bus.on('AgentCompleted', (e) => events.push(e));
  bus.on('AgentErrored', (e) => events.push(e));
  return events;
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('createClaudeRunner', () => {
  it('emits AgentStarted at the beginning of a run', async () => {
    const bus = createEventBus();
    const events = collectEvents(bus);
    const runner = createClaudeRunner(bus, createNoopAdapter(), createMockSpawn(['hello']));

    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'hi' });

    expect(events[0].type).toBe('AgentStarted');
    expect(events[0].agentName).toBe('test-agent');
  });

  it('emits AgentStreaming for each chunk in order', async () => {
    const bus = createEventBus();
    const events = collectEvents(bus);
    const runner = createClaudeRunner(
      bus,
      createNoopAdapter(),
      createMockSpawn(['chunk-1', 'chunk-2', 'chunk-3']),
    );

    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'hi' });

    const streamEvents = events.filter((e) => e.type === 'AgentStreaming');
    expect(streamEvents).toHaveLength(3);
    expect(streamEvents.map((e) => (e.type === 'AgentStreaming' ? e.payload.chunk : ''))).toEqual([
      'chunk-1',
      'chunk-2',
      'chunk-3',
    ]);
  });

  it('emits AgentCompleted with the assembled full response', async () => {
    const bus = createEventBus();
    const events = collectEvents(bus);
    const runner = createClaudeRunner(
      bus,
      createNoopAdapter(),
      createMockSpawn(['Hello ', 'world']),
    );

    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'hi' });

    const completed = events.find((e) => e.type === 'AgentCompleted');
    expect(completed).toBeDefined();
    expect(completed?.type === 'AgentCompleted' && completed.payload.fullResponse).toBe(
      'Hello world',
    );
  });

  it('emits AgentErrored on process failure', async () => {
    const bus = createEventBus();
    const events = collectEvents(bus);
    const runner = createClaudeRunner(bus, createNoopAdapter(), createErrorSpawn('spawn failed'));

    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'hi' });

    const errored = events.find((e) => e.type === 'AgentErrored');
    expect(errored).toBeDefined();
    expect(errored?.type === 'AgentErrored' && errored.payload.error.message).toContain(
      'spawn failed',
    );
  });

  it('does not throw when Claude errors — communicates via event only', async () => {
    const bus = createEventBus();
    const runner = createClaudeRunner(bus, createNoopAdapter(), createErrorSpawn());

    await expect(
      runner.run({ agentConfig: makeAgentConfig(), userMessage: 'hi' }),
    ).resolves.toBeUndefined();
  });

  it('appends user message to storage before spawning', async () => {
    const bus = createEventBus();
    const storage: StorageAdapter = {
      appendMessage: vi.fn().mockResolvedValue(undefined),
      loadHistory: vi.fn().mockResolvedValue([]),
    };
    const runner = createClaudeRunner(bus, storage, createMockSpawn(['response']));

    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'hello' });

    expect(storage.appendMessage).toHaveBeenCalledWith(
      'test-agent',
      expect.objectContaining({ role: 'user', content: 'hello' }),
    );
  });

  it('appends assistant response to storage after completion', async () => {
    const bus = createEventBus();
    const storage: StorageAdapter = {
      appendMessage: vi.fn().mockResolvedValue(undefined),
      loadHistory: vi.fn().mockResolvedValue([]),
    };
    const runner = createClaudeRunner(bus, storage, createMockSpawn(['the response']));

    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'hi' });

    expect(storage.appendMessage).toHaveBeenCalledWith(
      'test-agent',
      expect.objectContaining({ role: 'assistant', content: 'the response' }),
    );
  });

  it('loads history from storage at start of each run', async () => {
    const bus = createEventBus();
    const storage: StorageAdapter = {
      appendMessage: vi.fn().mockResolvedValue(undefined),
      loadHistory: vi.fn().mockResolvedValue([
        { role: 'user', content: 'prior message', timestamp: 1000 },
      ]),
    };
    const runner = createClaudeRunner(bus, storage, createMockSpawn(['reply']));

    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'new message' });

    expect(storage.loadHistory).toHaveBeenCalledWith('test-agent');
  });

  it('isRunning() returns true during run, false after completion', async () => {
    const bus = createEventBus();
    let runningDuring = false;

    const runner = createClaudeRunner(bus, createNoopAdapter(), async (opts) => {
      runningDuring = true;
      opts.eventBus.emit({ type: 'AgentStarted', agentName: opts.agentName });
      opts.eventBus.emit({
        type: 'AgentCompleted',
        agentName: opts.agentName,
        payload: { fullResponse: 'done' },
      });
      return { fullResponse: 'done' };
    });

    expect(runner.isRunning()).toBe(false);
    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'hi' });
    expect(runningDuring).toBe(true);
    expect(runner.isRunning()).toBe(false);
  });

  it('rejects a second run while already running and emits AgentErrored', async () => {
    const bus = createEventBus();
    const events = collectEvents(bus);

    let resolveSpawn!: (r: { fullResponse: string }) => void;
    const slowSpawn = vi.fn(
      () =>
        new Promise<{ fullResponse: string }>((res) => {
          resolveSpawn = res;
        }),
    );

    const runner = createClaudeRunner(bus, createNoopAdapter(), slowSpawn);

    const p1 = runner.run({ agentConfig: makeAgentConfig(), userMessage: 'a' });

    // Drain microtasks: (1) check running, (2) set running=true, (3) loadHistory, (4) appendMessage
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const p2 = runner.run({ agentConfig: makeAgentConfig(), userMessage: 'b' });

    resolveSpawn({ fullResponse: 'done' });
    bus.emit({ type: 'AgentStarted', agentName: 'test-agent' });
    bus.emit({ type: 'AgentCompleted', agentName: 'test-agent', payload: { fullResponse: 'done' } });

    await Promise.all([p1, p2]);

    const errorEvents = events.filter((e) => e.type === 'AgentErrored');
    expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    expect(errorEvents[0].agentName).toBe('test-agent');
  });

  it('two runner instances emit events with their own agentName', async () => {
    const bus = createEventBus();
    const startedNames: string[] = [];
    bus.on('AgentStarted', (e) => startedNames.push(e.agentName));

    const runnerA = createClaudeRunner(bus, createNoopAdapter(), createMockSpawn(['a']));
    const runnerB = createClaudeRunner(bus, createNoopAdapter(), createMockSpawn(['b']));

    await runnerA.run({ agentConfig: makeAgentConfig({ name: 'agent-a' }), userMessage: 'hi' });
    await runnerB.run({ agentConfig: makeAgentConfig({ name: 'agent-b' }), userMessage: 'hi' });

    expect(startedNames).toContain('agent-a');
    expect(startedNames).toContain('agent-b');
  });
});
