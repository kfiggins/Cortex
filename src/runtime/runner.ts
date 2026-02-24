import type { EventBus } from '../core/event-bus.js';
import type { RunnerInput, StorageAdapter, Message } from '../core/types.js';
import { buildSystemPrompt, buildMessages } from './prompt-builder.js';
import { spawnClaude, type SpawnOptions } from './claude-process.js';

export interface ClaudeRunner {
  run(input: RunnerInput): Promise<void>;
  isRunning(): boolean;
}

export interface MemoryHookContext {
  agentName: string;
  conversation: Message[];
}

export interface RunnerHooks {
  loadMemory?: (agentName: string) => Promise<string>;
  onMemoryHook?: (ctx: MemoryHookContext) => Promise<void>;
}

/**
 * Internal type for the spawn function so it can be swapped in tests.
 */
type SpawnFn = (opts: SpawnOptions) => Promise<{ fullResponse: string } | null>;

export function createClaudeRunner(
  eventBus: EventBus,
  storage: StorageAdapter,
  spawnFn: SpawnFn = spawnClaude,
  hooks?: RunnerHooks,
): ClaudeRunner {
  let running = false;

  return {
    isRunning(): boolean {
      return running;
    },

    async run(input: RunnerInput): Promise<void> {
      if (running) {
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

        // Reload memory fresh from disk if a loader is provided,
        // so edits between runs are always picked up.
        const memory = hooks?.loadMemory
          ? await hooks.loadMemory(agentConfig.name)
          : agentConfig.memory;

        // Load history fresh from storage every run
        const history = await storage.loadHistory(agentConfig.name);

        const systemPrompt = buildSystemPrompt(agentConfig.brain, memory);
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

          // MEMORY HOOK: In V2, the system will analyze the conversation
          // and suggest updates to memory.md here.
          // For now, this is a no-op unless a hook is provided.
          await hooks?.onMemoryHook?.({
            agentName: agentConfig.name,
            conversation: [...history, userMsg, assistantMsg],
          });
        }
      } finally {
        running = false;
      }
    },
  };
}
