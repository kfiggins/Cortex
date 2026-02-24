export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  brain: string; // contents of brain.md
  memory: string; // contents of memory.md (empty string if auto-created)
  tools: string[]; // reserved for V2 — always []
}
