import { Box, Text } from 'ink';
import type { AgentStatus } from '../state.js';

function statusSymbol(status: AgentStatus['status']): string {
  switch (status) {
    case 'running':
      return '●';
    case 'error':
      return '✗';
    case 'idle':
      return '○';
  }
}

function statusColor(status: AgentStatus['status']): string {
  switch (status) {
    case 'running':
      return 'green';
    case 'error':
      return 'red';
    case 'idle':
      return 'gray';
  }
}

interface Props {
  agents: AgentStatus[];
  selectedAgentName: string | null;
  isFocused: boolean;
}

export function AgentList({ agents, selectedAgentName, isFocused }: Props) {
  return (
    <Box
      flexDirection="column"
      width={20}
      borderStyle="single"
      borderColor={isFocused ? 'cyan' : 'gray'}
    >
      <Text bold> Agents</Text>
      {agents.map((agent) => {
        const isSelected = agent.name === selectedAgentName;
        return (
          <Box key={agent.name}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '► ' : '  '}
              {agent.name}
              {'  '}
            </Text>
            <Text color={statusColor(agent.status)}>{statusSymbol(agent.status)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
