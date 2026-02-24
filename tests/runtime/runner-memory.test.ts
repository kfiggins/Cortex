import { describe, it, expect, vi } from 'vitest';
import { createClaudeRunner } from '../../src/runtime/runner.js';
import type { MemoryHookContext } from '../../src/runtime/runner.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createNoopAdapter } from '../../src/storage/noop-adapter.js';
import { createMockSpawn } from '../helpers/mock-spawn.js';
import type { AgentConfig, StorageAdapter } from '../../src/core/types.js';

// ── helpers ────────────────────────────────────────────────────────────────

function makeAgentConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    name: 'test-agent',
    description: 'A test agent',
    model: 'claude-sonnet-4-6',
    brain: 'You are a test assistant.',
    memory: 'stale memory from config',
    tools: [],
    ...overrides,
  };
}

// ── fresh memory loading ───────────────────────────────────────────────────

describe('runner fresh memory loading', () => {
  it('uses loadMemory hook instead of agentConfig.memory when provided', async () => {
    const bus = createEventBus();
    let capturedSystemPrompt = '';

    const spawnFn = vi.fn(async (opts: Parameters<typeof createMockSpawn>[0] extends never ? never : { systemPrompt: string; agentName: string; eventBus: typeof bus }) => {
      capturedSystemPrompt = opts.systemPrompt;
      opts.eventBus.emit({ type: 'AgentStarted', agentName: opts.agentName });
      opts.eventBus.emit({
        type: 'AgentCompleted',
        agentName: opts.agentName,
        payload: { fullResponse: 'done' },
      });
      return { fullResponse: 'done' };
    });

    const runner = createClaudeRunner(bus, createNoopAdapter(), spawnFn, {
      loadMemory: vi.fn().mockResolvedValue('fresh memory from disk'),
    });

    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'hi' });

    expect(capturedSystemPrompt).toContain('fresh memory from disk');
    expect(capturedSystemPrompt).not.toContain('stale memory from config');
  });

  it('falls back to agentConfig.memory when loadMemory hook is not provided', async () => {
    const bus = createEventBus();
    let capturedSystemPrompt = '';

    const spawnFn = vi.fn(async (opts: { systemPrompt: string; agentName: string; eventBus: typeof bus }) => {
      capturedSystemPrompt = opts.systemPrompt;
      opts.eventBus.emit({ type: 'AgentStarted', agentName: opts.agentName });
      opts.eventBus.emit({
        type: 'AgentCompleted',
        agentName: opts.agentName,
        payload: { fullResponse: 'done' },
      });
      return { fullResponse: 'done' };
    });

    const runner = createClaudeRunner(bus, createNoopAdapter(), spawnFn);

    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'hi' });

    expect(capturedSystemPrompt).toContain('stale memory from config');
  });

  it('reloads memory on each run — simulates editing between runs', async () => {
    const bus = createEventBus();
    const capturedPrompts: string[] = [];

    const spawnFn = vi.fn(async (opts: { systemPrompt: string; agentName: string; eventBus: typeof bus }) => {
      capturedPrompts.push(opts.systemPrompt);
      opts.eventBus.emit({ type: 'AgentStarted', agentName: opts.agentName });
      opts.eventBus.emit({
        type: 'AgentCompleted',
        agentName: opts.agentName,
        payload: { fullResponse: 'done' },
      });
      return { fullResponse: 'done' };
    });

    let memoryContent = 'run 1 memory';
    const loadMemory = vi.fn(async () => memoryContent);

    const runner = createClaudeRunner(bus, createNoopAdapter(), spawnFn, { loadMemory });

    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'first' });
    memoryContent = 'run 2 memory (edited)';
    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'second' });

    expect(loadMemory).toHaveBeenCalledTimes(2);
    expect(capturedPrompts[0]).toContain('run 1 memory');
    expect(capturedPrompts[1]).toContain('run 2 memory (edited)');
  });
});

// ── system prompt memory format ────────────────────────────────────────────

describe('memory injection in system prompt', () => {
  it('empty memory omits memory section from system prompt', async () => {
    const bus = createEventBus();
    let capturedSystemPrompt = '';

    const spawnFn = vi.fn(async (opts: { systemPrompt: string; agentName: string; eventBus: typeof bus }) => {
      capturedSystemPrompt = opts.systemPrompt;
      opts.eventBus.emit({ type: 'AgentStarted', agentName: opts.agentName });
      opts.eventBus.emit({
        type: 'AgentCompleted',
        agentName: opts.agentName,
        payload: { fullResponse: 'done' },
      });
      return { fullResponse: 'done' };
    });

    const runner = createClaudeRunner(bus, createNoopAdapter(), spawnFn, {
      loadMemory: vi.fn().mockResolvedValue(''),
    });

    await runner.run({ agentConfig: makeAgentConfig({ memory: '' }), userMessage: 'hi' });

    expect(capturedSystemPrompt).not.toContain('## Memory');
    expect(capturedSystemPrompt).not.toContain('previous sessions');
  });

  it('non-empty memory includes memory section with context header', async () => {
    const bus = createEventBus();
    let capturedSystemPrompt = '';

    const spawnFn = vi.fn(async (opts: { systemPrompt: string; agentName: string; eventBus: typeof bus }) => {
      capturedSystemPrompt = opts.systemPrompt;
      opts.eventBus.emit({ type: 'AgentStarted', agentName: opts.agentName });
      opts.eventBus.emit({
        type: 'AgentCompleted',
        agentName: opts.agentName,
        payload: { fullResponse: 'done' },
      });
      return { fullResponse: 'done' };
    });

    const runner = createClaudeRunner(bus, createNoopAdapter(), spawnFn, {
      loadMemory: vi.fn().mockResolvedValue('User likes cats.'),
    });

    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'hi' });

    expect(capturedSystemPrompt).toContain('## Memory');
    expect(capturedSystemPrompt).toContain('The following is context from previous sessions:');
    expect(capturedSystemPrompt).toContain('User likes cats.');
  });
});

// ── memory hook ────────────────────────────────────────────────────────────

describe('onMemoryHook', () => {
  it('is invoked after AgentCompleted with conversation context', async () => {
    const bus = createEventBus();
    const hookCalls: MemoryHookContext[] = [];

    const storage: StorageAdapter = {
      appendMessage: vi.fn().mockResolvedValue(undefined),
      loadHistory: vi.fn().mockResolvedValue([
        { role: 'user', content: 'prior message', timestamp: 1000 },
      ]),
    };

    const runner = createClaudeRunner(bus, storage, createMockSpawn(['response']), {
      onMemoryHook: vi.fn(async (ctx) => {
        hookCalls.push(ctx);
      }),
    });

    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'new message' });

    expect(hookCalls).toHaveLength(1);
    expect(hookCalls[0].agentName).toBe('test-agent');
    // Conversation should include history + user message + assistant message
    expect(hookCalls[0].conversation.length).toBeGreaterThanOrEqual(3);
    expect(hookCalls[0].conversation[0].content).toBe('prior message');
    expect(hookCalls[0].conversation[hookCalls[0].conversation.length - 1].role).toBe('assistant');
  });

  it('no-ops gracefully when onMemoryHook is undefined', async () => {
    const bus = createEventBus();

    const runner = createClaudeRunner(bus, createNoopAdapter(), createMockSpawn(['ok']));

    // Should not throw
    await expect(
      runner.run({ agentConfig: makeAgentConfig(), userMessage: 'hi' }),
    ).resolves.toBeUndefined();
  });

  it('is not invoked when the spawn fails (no AgentCompleted)', async () => {
    const bus = createEventBus();
    const onMemoryHook = vi.fn();

    const failSpawn = vi.fn(async (opts: { agentName: string; eventBus: typeof bus }) => {
      opts.eventBus.emit({
        type: 'AgentErrored',
        agentName: opts.agentName,
        payload: { error: new Error('boom') },
      });
      return null;
    });

    const runner = createClaudeRunner(bus, createNoopAdapter(), failSpawn, { onMemoryHook });

    await runner.run({ agentConfig: makeAgentConfig(), userMessage: 'hi' });

    expect(onMemoryHook).not.toHaveBeenCalled();
  });
});
