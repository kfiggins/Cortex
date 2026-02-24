import { Box, Text } from 'ink';

interface Props {
  value: string;
  isFocused: boolean;
  agentName: string | null;
}

export function InputBar({ value, isFocused, agentName }: Props) {
  const label = agentName ? `> ` : `> (select an agent) `;
  const cursor = isFocused ? '▋' : '';
  return (
    <Box borderStyle="single" borderColor={isFocused ? 'cyan' : 'gray'}>
      <Text color={isFocused ? 'cyan' : 'gray'}>{label}</Text>
      <Text>
        {value}
        {cursor}
      </Text>
    </Box>
  );
}
