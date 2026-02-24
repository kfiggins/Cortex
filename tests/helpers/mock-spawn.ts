import { vi } from 'vitest';
import type { SpawnOptions } from '../../src/runtime/claude-process.js';

/**
 * Creates a mock spawn function that simulates Claude streaming.
 * Emits events synchronously through the event bus just like the real process would.
 */
export function createMockSpawn(chunks: string[], exitCode = 0) {
  return vi.fn(async (opts: SpawnOptions): Promise<{ fullResponse: string } | null> => {
    const { agentName, eventBus } = opts;

    eventBus.emit({ type: 'AgentStarted', agentName });

    if (exitCode !== 0) {
      eventBus.emit({
        type: 'AgentErrored',
        agentName,
        payload: { error: new Error(`Claude exited with code ${exitCode}`) },
      });
      return null;
    }

    let fullResponse = '';
    for (const chunk of chunks) {
      fullResponse += chunk;
      eventBus.emit({ type: 'AgentStreaming', agentName, payload: { chunk } });
    }

    eventBus.emit({ type: 'AgentCompleted', agentName, payload: { fullResponse } });
    return { fullResponse };
  });
}

/**
 * Creates a mock spawn function that simulates a process spawn error.
 */
export function createErrorSpawn(message = 'spawn failed') {
  return vi.fn(async (opts: SpawnOptions): Promise<null> => {
    opts.eventBus.emit({
      type: 'AgentErrored',
      agentName: opts.agentName,
      payload: { error: new Error(message) },
    });
    return null;
  });
}
