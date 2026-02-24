import type { EventBus } from '../core/event-bus.js';
import type { RunnerInput, StorageAdapter, Message } from '../core/types.js';
import { buildSystemPrompt, buildMessages } from './prompt-builder.js';
import { spawnClaude, type SpawnOptions } from './claude-process.js';

export interface ClaudeRunner {
  run(input: RunnerInput): Promise<void>;
  isRunning(): boolean;
}

/**
 * Internal type for the spawn function so it can be swapped in tests.
 */
type SpawnFn = (opts: SpawnOptions) => Promise<{ fullResponse: string } | null>;

export function createClaudeRunner(
  eventBus: EventBus,
  storage: StorageAdapter,
  spawnFn: SpawnFn = spawnClaude,
): ClaudeRunner {
  let running = false;

  return {
    isRunning(): boolean {
      return running;
    },

    async run(input: RunnerInput): Promise<void> {
      if (running) {
        // Reject concurrent runs on the same runner instance (Phase 6 will manage this)
        eventBus.emit({
          type: 'AgentErrored',
          agentName: input.agentConfig.name,
          payload: { error: new Error(`Agent "${input.agentConfig.name}" is already running`) },
        });
        return;
      }

      running = true;

      try {
        const { agentConfig, userMessage } = input;

        // Load history fresh from storage every run — never rely on stale in-memory state
        const history = await storage.loadHistory(agentConfig.name);

        const systemPrompt = buildSystemPrompt(agentConfig.brain, agentConfig.memory);
        const messages = buildMessages(history, userMessage);

        // Persist the user message before spawning
        const userMsg: Message = messages[messages.length - 1];
        await storage.appendMessage(agentConfig.name, userMsg);

        const result = await spawnFn({
          model: agentConfig.model,
          agentName: agentConfig.name,
          systemPrompt,
          messages,
          eventBus,
        });

        if (result) {
          const assistantMsg: Message = {
            role: 'assistant',
            content: result.fullResponse,
            timestamp: Date.now(),
          };
          await storage.appendMessage(agentConfig.name, assistantMsg);
        }
      } finally {
        running = false;
      }
    },
  };
}
