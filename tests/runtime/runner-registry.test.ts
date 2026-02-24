import { describe, it, expect, vi } from 'vitest';
import { createRunnerRegistry } from '../../src/runtime/runner-registry.js';
import type { ClaudeRunner } from '../../src/runtime/runner.js';

function makeStubRunner(name: string): ClaudeRunner {
  return {
    run: vi.fn().mockResolvedValue(undefined),
    isRunning: vi.fn().mockReturnValue(false),
    // tag for identification in assertions
    _name: name,
  } as unknown as ClaudeRunner;
}

describe('createRunnerRegistry', () => {
  it('returns undefined for an unregistered agent', () => {
    const registry = createRunnerRegistry();
    expect(registry.getRunner('unknown')).toBeUndefined();
  });

  it('returns the registered runner for a known agent', () => {
    const registry = createRunnerRegistry();
    const runner = makeStubRunner('agent-a');
    registry.registerRunner('agent-a', runner);
    expect(registry.getRunner('agent-a')).toBe(runner);
  });

  it('each agent gets its own independent runner', () => {
    const registry = createRunnerRegistry();
    const runnerA = makeStubRunner('agent-a');
    const runnerB = makeStubRunner('agent-b');
    registry.registerRunner('agent-a', runnerA);
    registry.registerRunner('agent-b', runnerB);
    expect(registry.getRunner('agent-a')).toBe(runnerA);
    expect(registry.getRunner('agent-b')).toBe(runnerB);
    expect(registry.getRunner('agent-a')).not.toBe(runnerB);
  });

  it('getAllRunnerNames returns all registered names', () => {
    const registry = createRunnerRegistry();
    registry.registerRunner('agent-a', makeStubRunner('agent-a'));
    registry.registerRunner('agent-b', makeStubRunner('agent-b'));
    registry.registerRunner('agent-c', makeStubRunner('agent-c'));
    expect(registry.getAllRunnerNames().sort()).toEqual(['agent-a', 'agent-b', 'agent-c']);
  });

  it('getAllRunnerNames returns empty array when nothing registered', () => {
    const registry = createRunnerRegistry();
    expect(registry.getAllRunnerNames()).toEqual([]);
  });

  it('registering a new runner for the same name replaces the old one', () => {
    const registry = createRunnerRegistry();
    const original = makeStubRunner('v1');
    const replacement = makeStubRunner('v2');
    registry.registerRunner('agent-a', original);
    registry.registerRunner('agent-a', replacement);
    expect(registry.getRunner('agent-a')).toBe(replacement);
  });
});
