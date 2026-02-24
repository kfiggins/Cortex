import { Text } from 'ink';

interface Props {
  text: string;
}

export function StreamChunk({ text }: Props) {
  if (!text) return null;
  return <Text color="yellow">assistant: {text}▋</Text>;
}
