import { Box, Text } from 'ink';
import type { AgentStatus } from '../state.js';
import { MessageList } from './MessageList.js';
import { StreamChunk } from './StreamChunk.js';

interface Props {
  agent: AgentStatus | null;
}

export function ChatWindow({ agent }: Props) {
  if (!agent) {
    return (
      <Box flexGrow={1} borderStyle="single" borderColor="gray" flexDirection="column">
        <Text color="gray"> No agent selected. Use ↑/↓ to navigate and Enter to select.</Text>
      </Box>
    );
  }

  return (
    <Box flexGrow={1} borderStyle="single" borderColor="gray" flexDirection="column">
      <Text bold> Chat: {agent.name}</Text>
      <Box flexDirection="column" flexGrow={1} paddingLeft={1}>
        <MessageList messages={agent.messages} />
        <StreamChunk text={agent.currentStream} />
      </Box>
    </Box>
  );
}
