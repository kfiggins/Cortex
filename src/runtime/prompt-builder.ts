import type { Message } from '../core/types.js';

/**
 * Assembles the system prompt from brain and memory.
 * Memory section is omitted entirely when memory is empty.
 *
 * Format:
 *   <brain contents>
 *
 *   ---
 *   ## Memory
 *
 *   <memory contents>    ← only if non-empty
 */
export function buildSystemPrompt(brain: string, memory: string): string {
  const trimmedMemory = memory.trim();
  if (!trimmedMemory) {
    return brain.trim();
  }
  return `${brain.trim()}\n\n---\n## Memory\n\n${trimmedMemory}`;
}

/**
 * Assembles the messages array from history + the new user message.
 * The new user message is always appended last.
 */
export function buildMessages(history: Message[], userMessage: string): Message[] {
  const newMessage: Message = {
    role: 'user',
    content: userMessage,
    timestamp: Date.now(),
  };
  return [...history, newMessage];
}
