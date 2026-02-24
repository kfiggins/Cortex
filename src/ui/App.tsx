import { useState, useEffect } from 'react';
import { Box, useInput, useApp } from 'ink';
import type { AgentConfig } from '../core/types.js';
import type { EventBus } from '../core/event-bus.js';
import {
  initUIState,
  applyEvent,
  selectAgent,
  updateInput,
  addUserMessage,
} from './state-manager.js';
import type { UIState } from './state.js';
import { AgentList } from './components/AgentList.js';
import { ChatWindow } from './components/ChatWindow.js';
import { InputBar } from './components/InputBar.js';

interface Props {
  agents: AgentConfig[];
  eventBus: EventBus;
  onSendMessage: (agentName: string, message: string) => void;
  onEditMemory: (agentName: string) => void;
}

type Focus = 'list' | 'input';

export function App({ agents, eventBus, onSendMessage, onEditMemory }: Props) {
  const { exit } = useApp();
  const [state, setState] = useState<UIState>(() => initUIState(agents));
  const [focus, setFocus] = useState<Focus>('list');

  useEffect(() => {
    const unsubs = [
      eventBus.on('AgentStarted', (e) => setState((s) => applyEvent(s, e))),
      eventBus.on('AgentStreaming', (e) => setState((s) => applyEvent(s, e))),
      eventBus.on('AgentCompleted', (e) => setState((s) => applyEvent(s, e))),
      eventBus.on('AgentErrored', (e) => setState((s) => applyEvent(s, e))),
    ];
    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [eventBus]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    if (key.ctrl && input === 'm' && state.selectedAgentName) {
      onEditMemory(state.selectedAgentName);
      return;
    }

    if (focus === 'list') {
      if (key.tab) {
        setFocus('input');
        return;
      }
      const idx = state.agents.findIndex((a) => a.name === state.selectedAgentName);
      if (key.upArrow && idx > 0) {
        setState((s) => selectAgent(s, state.agents[idx - 1].name));
      }
      if (key.downArrow && idx < state.agents.length - 1) {
        setState((s) => selectAgent(s, state.agents[idx + 1].name));
      }
      if (key.return && state.selectedAgentName) {
        setFocus('input');
      }
    } else {
      if (key.tab) {
        setFocus('list');
        return;
      }
      if (key.return) {
        if (state.inputValue.trim() && state.selectedAgentName) {
          const msg = state.inputValue.trim();
          const agent = state.selectedAgentName;
          setState((s) => addUserMessage(updateInput(s, ''), agent, msg));
          onSendMessage(agent, msg);
        }
        return;
      }
      if (key.backspace || key.delete) {
        setState((s) => updateInput(s, s.inputValue.slice(0, -1)));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setState((s) => updateInput(s, s.inputValue + input));
      }
    }
  });

  const selectedAgent = state.agents.find((a) => a.name === state.selectedAgentName) ?? null;

  return (
    <Box flexDirection="column">
      <Box>
        <AgentList
          agents={state.agents}
          selectedAgentName={state.selectedAgentName}
          isFocused={focus === 'list'}
        />
        <ChatWindow agent={selectedAgent} />
      </Box>
      <InputBar
        value={state.inputValue}
        isFocused={focus === 'input'}
        agentName={state.selectedAgentName}
      />
    </Box>
  );
}
