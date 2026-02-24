import { describe, it, expect, vi } from 'vitest';
import { createClaudeRunner } from '../../src/runtime/runner.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createNoopAdapter } from '../../src/storage/noop-adapter.js';
import { createMockSpawn, createErrorSpawn } from '../helpers/mock-spawn.js';
import type { AgentConfig } from '../../src/core/types.js';
import type { AgentEvent } from '../../src/core/events.js';
import type { SpawnOptions } from '../../src/runtime/claude-process.js';

// ── helpers ────────────────────────────────────────────────────────────────

function makeAgentConfig(name: string): AgentConfig {
  return {
    name,
    description: `Agent ${name}`,
    model: 'claude-sonnet-4-6',
    brain: 'You are a test assistant.',
    memory: '',
    tools: [],
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

// ── two runners, independent operation ────────────────────────────────────

describe('multi-runner concurrency', () => {
  it('two runners emit events with correct agentName independently', async () => {
    const bus = createEventBus();
    const events = collectEvents(bus);

    const runnerA = createClaudeRunner(bus, createNoopAdapter(), createMockSpawn(['hello']));
    const runnerB = createClaudeRunner(bus, createNoopAdapter(), createMockSpawn(['world']));

    await runnerA.run({ agentConfig: makeAgentConfig('agent-a'), userMessage: 'hi' });
    await runnerB.run({ agentConfig: makeAgentConfig('agent-b'), userMessage: 'hi' });

    const agentAEvents = events.filter((e) => e.agentName === 'agent-a');
    const agentBEvents = events.filter((e) => e.agentName === 'agent-b');
    expect(agentAEvents.length).toBeGreaterThan(0);
    expect(agentBEvents.length).toBeGreaterThan(0);
    // No cross-contamination
    expect(agentAEvents.every((e) => e.agentName === 'agent-a')).toBe(true);
    expect(agentBEvents.every((e) => e.agentName === 'agent-b')).toBe(true);
  });

  it('streaming events for agent-a are not received in agent-b filter', async () => {
    const bus = createEventBus();
    const agentBChunks: string[] = [];
    bus.on('AgentStreaming', (e) => {
      if (e.agentName === 'agent-b') agentBChunks.push(e.payload.chunk);
    });

    const runnerA = createClaudeRunner(
      bus,
      createNoopAdapter(),
      createMockSpawn(['chunk-a1', 'chunk-a2']),
    );
    await runnerA.run({ agentConfig: makeAgentConfig('agent-a'), userMessage: 'hi' });

    expect(agentBChunks).toHaveLength(0);
  });

  it('both runners complete with correct full responses — no cross-stream contamination', async () => {
    const bus = createEventBus();
    const completedPayloads: Record<string, string> = {};
    bus.on('AgentCompleted', (e) => {
      completedPayloads[e.agentName] = e.payload.fullResponse;
    });

    const runnerA = createClaudeRunner(
      bus,
      createNoopAdapter(),
      createMockSpawn(['response-a']),
    );
    const runnerB = createClaudeRunner(
      bus,
      createNoopAdapter(),
      createMockSpawn(['response-b']),
    );

    await runnerA.run({ agentConfig: makeAgentConfig('agent-a'), userMessage: 'hi' });
    await runnerB.run({ agentConfig: makeAgentConfig('agent-b'), userMessage: 'hi' });

    expect(completedPayloads['agent-a']).toBe('response-a');
    expect(completedPayloads['agent-b']).toBe('response-b');
  });

  it('two runners run truly in parallel without cross-contamination', async () => {
    const bus = createEventBus();
    const streamedChunks: Record<string, string[]> = { 'agent-a': [], 'agent-b': [] };
    bus.on('AgentStreaming', (e) => streamedChunks[e.agentName]?.push(e.payload.chunk));

    // Slow spawn that yields control so both run overlap
    function makeSlowSpawn(chunks: string[], agentLabel: string) {
      return vi.fn(async (opts: SpawnOptions) => {
        opts.eventBus.emit({ type: 'AgentStarted', agentName: opts.agentName });
        let fullResponse = '';
        for (const chunk of chunks) {
          await Promise.resolve(); // yield
          fullResponse += chunk;
          opts.eventBus.emit({
            type: 'AgentStreaming',
            agentName: opts.agentName,
            payload: { chunk: `${agentLabel}:${chunk}` },
          });
        }
        opts.eventBus.emit({
          type: 'AgentCompleted',
          agentName: opts.agentName,
          payload: { fullResponse },
        });
        return { fullResponse };
      });
    }

    const runnerA = createClaudeRunner(
      bus,
      createNoopAdapter(),
      makeSlowSpawn(['1', '2', '3'], 'a'),
    );
    const runnerB = createClaudeRunner(
      bus,
      createNoopAdapter(),
      makeSlowSpawn(['x', 'y', 'z'], 'b'),
    );

    await Promise.all([
      runnerA.run({ agentConfig: makeAgentConfig('agent-a'), userMessage: 'go' }),
      runnerB.run({ agentConfig: makeAgentConfig('agent-b'), userMessage: 'go' }),
    ]);

    expect(streamedChunks['agent-a']).toEqual(['a:1', 'a:2', 'a:3']);
    expect(streamedChunks['agent-b']).toEqual(['b:x', 'b:y', 'b:z']);
  });

  it('one runner erroring does not affect the other runner', async () => {
    const bus = createEventBus();
    const events = collectEvents(bus);

    const runnerA = createClaudeRunner(bus, createNoopAdapter(), createErrorSpawn('agent-a error'));
    const runnerB = createClaudeRunner(
      bus,
      createNoopAdapter(),
      createMockSpawn(['success']),
    );

    await Promise.all([
      runnerA.run({ agentConfig: makeAgentConfig('agent-a'), userMessage: 'hi' }),
      runnerB.run({ agentConfig: makeAgentConfig('agent-b'), userMessage: 'hi' }),
    ]);

    const agentAErrored = events.find(
      (e) => e.type === 'AgentErrored' && e.agentName === 'agent-a',
    );
    const agentBCompleted = events.find(
      (e) => e.type === 'AgentCompleted' && e.agentName === 'agent-b',
    );
    expect(agentAErrored).toBeDefined();
    expect(agentBCompleted).toBeDefined();
  });

  it('isRunning() reflects the correct state per instance', async () => {
    const bus = createEventBus();
    const isRunningDuringA: boolean[] = [];

    let resolveB!: (r: { fullResponse: string }) => void;
    const slowSpawnB = vi.fn(
      () =>
        new Promise<{ fullResponse: string }>((res) => {
          resolveB = res;
        }),
    );

    const runnerA = createClaudeRunner(bus, createNoopAdapter(), createMockSpawn(['done']));
    const runnerB = createClaudeRunner(bus, createNoopAdapter(), slowSpawnB);

    const pB = runnerB.run({ agentConfig: makeAgentConfig('agent-b'), userMessage: 'hi' });

    // Drain microtasks so runnerB sets running = true
    for (let i = 0; i < 5; i++) await Promise.resolve();

    expect(runnerB.isRunning()).toBe(true);

    // runnerA runs and completes independently while runnerB is still running
    await runnerA.run({ agentConfig: makeAgentConfig('agent-a'), userMessage: 'hi' });
    isRunningDuringA.push(runnerA.isRunning());

    // runnerA is done, runnerB still running
    expect(runnerA.isRunning()).toBe(false);
    expect(runnerB.isRunning()).toBe(true);

    // Finish runnerB
    resolveB({ fullResponse: 'done' });
    bus.emit({ type: 'AgentCompleted', agentName: 'agent-b', payload: { fullResponse: 'done' } });
    await pB;

    expect(runnerB.isRunning()).toBe(false);
  });

  // ── stress test: 3 runners, interleaved streaming ──────────────────────

  it('stress: 3 runners with interleaved mock streaming preserve per-agent event ordering', async () => {
    const bus = createEventBus();
    const receivedChunks: Record<string, string[]> = {
      'agent-a': [],
      'agent-b': [],
      'agent-c': [],
    };
    bus.on('AgentStreaming', (e) => receivedChunks[e.agentName]?.push(e.payload.chunk));

    // Each runner gets a unique interleaved delay pattern
    function makeInterleavedSpawn(agentId: string, values: number[]) {
      return vi.fn(async (opts: SpawnOptions) => {
        opts.eventBus.emit({ type: 'AgentStarted', agentName: opts.agentName });
        let fullResponse = '';
        for (const v of values) {
          await Promise.resolve();
          const chunk = `${agentId}-${v}`;
          fullResponse += chunk;
          opts.eventBus.emit({ type: 'AgentStreaming', agentName: opts.agentName, payload: { chunk } });
        }
        opts.eventBus.emit({
          type: 'AgentCompleted',
          agentName: opts.agentName,
          payload: { fullResponse },
        });
        return { fullResponse };
      });
    }

    const runnerA = createClaudeRunner(bus, createNoopAdapter(), makeInterleavedSpawn('a', [1, 2, 3]));
    const runnerB = createClaudeRunner(bus, createNoopAdapter(), makeInterleavedSpawn('b', [4, 5, 6]));
    const runnerC = createClaudeRunner(bus, createNoopAdapter(), makeInterleavedSpawn('c', [7, 8, 9]));

    await Promise.all([
      runnerA.run({ agentConfig: makeAgentConfig('agent-a'), userMessage: 'go' }),
      runnerB.run({ agentConfig: makeAgentConfig('agent-b'), userMessage: 'go' }),
      runnerC.run({ agentConfig: makeAgentConfig('agent-c'), userMessage: 'go' }),
    ]);

    expect(receivedChunks['agent-a']).toEqual(['a-1', 'a-2', 'a-3']);
    expect(receivedChunks['agent-b']).toEqual(['b-4', 'b-5', 'b-6']);
    expect(receivedChunks['agent-c']).toEqual(['c-7', 'c-8', 'c-9']);
  });
});
