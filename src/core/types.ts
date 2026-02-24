export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  brain: string; // contents of brain.md
  memory: string; // contents of memory.md (empty string if auto-created)
  tools: string[]; // reserved for V2 — always []
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface RunnerInput {
  agentConfig: AgentConfig;
  userMessage: string;
}

/**
 * Storage interface — swappable. Runtime depends on this, not on any
 * concrete implementation. Phase 4 provides the real JSONL adapter.
 */
export interface StorageAdapter {
  appendMessage(agentName: string, message: Message): Promise<void>;
  loadHistory(agentName: string, limit?: number): Promise<Message[]>;
}
