import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildMessages } from '../../src/runtime/prompt-builder.js';
import type { Message } from '../../src/core/types.js';

const msg = (role: 'user' | 'assistant', content: string): Message => ({
  role,
  content,
  timestamp: 1000,
});

describe('buildSystemPrompt', () => {
  it('returns brain content when memory is empty', () => {
    const result = buildSystemPrompt('You are a helpful assistant.', '');
    expect(result).toBe('You are a helpful assistant.');
  });

  it('returns brain content when memory is only whitespace', () => {
    const result = buildSystemPrompt('Brain content.', '   \n  ');
    expect(result).toBe('Brain content.');
  });

  it('includes memory section when memory is non-empty', () => {
    const result = buildSystemPrompt('You are a helper.', 'User prefers short answers.');
    expect(result).toContain('You are a helper.');
    expect(result).toContain('## Memory');
    expect(result).toContain('User prefers short answers.');
  });

  it('separates brain and memory with a divider', () => {
    const result = buildSystemPrompt('Brain.', 'Memory.');
    expect(result).toContain('---');
    const brainPos = result.indexOf('Brain.');
    const dividerPos = result.indexOf('---');
    const memoryPos = result.indexOf('Memory.');
    expect(brainPos).toBeLessThan(dividerPos);
    expect(dividerPos).toBeLessThan(memoryPos);
  });

  it('trims leading/trailing whitespace from brain', () => {
    const result = buildSystemPrompt('\n\nBrain.\n\n', '');
    expect(result).toBe('Brain.');
  });
});

describe('buildMessages', () => {
  it('appends the user message as the last entry', () => {
    const history: Message[] = [msg('user', 'Hello'), msg('assistant', 'Hi!')];
    const result = buildMessages(history, 'How are you?');

    expect(result).toHaveLength(3);
    expect(result[2].role).toBe('user');
    expect(result[2].content).toBe('How are you?');
  });

  it('works with empty history', () => {
    const result = buildMessages([], 'First message');

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('First message');
  });

  it('does not mutate the original history array', () => {
    const history: Message[] = [msg('user', 'original')];
    buildMessages(history, 'new message');
    expect(history).toHaveLength(1);
  });

  it('preserves history order', () => {
    const history: Message[] = [
      msg('user', 'first'),
      msg('assistant', 'second'),
      msg('user', 'third'),
    ];
    const result = buildMessages(history, 'fourth');

    expect(result.map((m) => m.content)).toEqual(['first', 'second', 'third', 'fourth']);
  });

  it('sets a timestamp on the new message', () => {
    const before = Date.now();
    const result = buildMessages([], 'test');
    const after = Date.now();

    expect(result[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(result[0].timestamp).toBeLessThanOrEqual(after);
  });
});
