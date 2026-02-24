import { Box, Text } from 'ink';
import type { Message } from '../../core/types.js';

interface Props {
  messages: Message[];
}

export function MessageList({ messages }: Props) {
  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => (
        <Box key={i} marginBottom={0}>
          <Text color={msg.role === 'user' ? 'cyan' : 'green'} bold>
            {msg.role}:{' '}
          </Text>
          <Text>{msg.content}</Text>
        </Box>
      ))}
    </Box>
  );
}
