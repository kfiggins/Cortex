import type { AgentEvent } from '../core/events.js';
import type { AgentConfig, Message } from '../core/types.js';
import type { UIState, AgentStatus } from './state.js';

export function initUIState(agents: AgentConfig[]): UIState {
  const agentStatuses: AgentStatus[] = agents.map((a) => ({
    name: a.name,
    status: 'idle',
    messages: [],
    currentStream: '',
  }));
  return {
    agents: agentStatuses,
    selectedAgentName: agents.length > 0 ? agents[0].name : null,
    inputValue: '',
  };
}

export function applyEvent(state: UIState, event: AgentEvent): UIState {
  switch (event.type) {
    case 'AgentStarted':
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.name === event.agentName ? { ...a, status: 'running' } : a,
        ),
      };

    case 'AgentStreaming':
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.name === event.agentName
            ? { ...a, currentStream: a.currentStream + event.payload.chunk }
            : a,
        ),
      };

    case 'AgentCompleted': {
      const completedMsg: Message = {
        role: 'assistant',
        content: event.payload.fullResponse,
        timestamp: Date.now(),
      };
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.name === event.agentName
            ? { ...a, status: 'idle', messages: [...a.messages, completedMsg], currentStream: '' }
            : a,
        ),
      };
    }

    case 'AgentErrored':
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.name === event.agentName ? { ...a, status: 'error' } : a,
        ),
      };
  }
}

export function selectAgent(state: UIState, agentName: string): UIState {
  return { ...state, selectedAgentName: agentName };
}

export function updateInput(state: UIState, value: string): UIState {
  return { ...state, inputValue: value };
}

export function clearStream(state: UIState, agentName: string): UIState {
  return {
    ...state,
    agents: state.agents.map((a) =>
      a.name === agentName ? { ...a, currentStream: '' } : a,
    ),
  };
}

export function addUserMessage(state: UIState, agentName: string, content: string): UIState {
  const userMsg: Message = { role: 'user', content, timestamp: Date.now() };
  return {
    ...state,
    agents: state.agents.map((a) =>
      a.name === agentName ? { ...a, messages: [...a.messages, userMsg] } : a,
    ),
  };
}
