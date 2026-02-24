import type { Message } from '../core/types.js';

export interface AgentStatus {
  name: string;
  status: 'idle' | 'running' | 'error';
  messages: Message[];
  currentStream: string;
}

export interface UIState {
  agents: AgentStatus[];
  selectedAgentName: string | null;
  inputValue: string;
}
