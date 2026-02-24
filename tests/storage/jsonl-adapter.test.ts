import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createJsonlAdapter } from '../../src/storage/jsonl-adapter.js';
import type { Message } from '../../src/core/types.js';

// ── helpers ────────────────────────────────────────────────────────────────

function msg(role: 'user' | 'assistant', content: string, timestamp = 1000): Message {
  return { role, content, timestamp };
}

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'cortex-storage-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ── tests ──────────────────────────────────────────────────────────────────

describe('createJsonlAdapter', () => {
  it('creates the transcript file on first append', async () => {
    const adapter = createJsonlAdapter(tempDir);
    await adapter.appendMessage('agent-a', msg('user', 'hello'));

    const path = join(tempDir, 'transcripts', 'agent-a', 'transcript.jsonl');
    const content = await readFile(path, 'utf-8');
    expect(content.trim()).not.toBe('');
  });

  it('appended message is valid JSON with correct fields', async () => {
    const adapter = createJsonlAdapter(tempDir);
    const message = msg('user', 'hello world', 12345);
    await adapter.appendMessage('agent-a', message);

    const path = join(tempDir, 'transcripts', 'agent-a', 'transcript.jsonl');
    const line = (await readFile(path, 'utf-8')).trim();
    const parsed = JSON.parse(line) as Message;

    expect(parsed.role).toBe('user');
    expect(parsed.content).toBe('hello world');
    expect(parsed.timestamp).toBe(12345);
  });

  it('each message is written on its own line', async () => {
    const adapter = createJsonlAdapter(tempDir);
    await adapter.appendMessage('agent-a', msg('user', 'one'));
    await adapter.appendMessage('agent-a', msg('assistant', 'two'));
    await adapter.appendMessage('agent-a', msg('user', 'three'));

    const path = join(tempDir, 'transcripts', 'agent-a', 'transcript.jsonl');
    const lines = (await readFile(path, 'utf-8')).trim().split('\n');
    expect(lines).toHaveLength(3);
  });

  it('loadHistory returns messages in chronological order', async () => {
    const adapter = createJsonlAdapter(tempDir);
    await adapter.appendMessage('agent-a', msg('user', 'first', 1));
    await adapter.appendMessage('agent-a', msg('assistant', 'second', 2));
    await adapter.appendMessage('agent-a', msg('user', 'third', 3));

    const history = await adapter.loadHistory('agent-a');

    expect(history).toHaveLength(3);
    expect(history.map((m) => m.content)).toEqual(['first', 'second', 'third']);
  });

  it('loadHistory with limit returns only the last N messages', async () => {
    const adapter = createJsonlAdapter(tempDir);
    for (let i = 1; i <= 5; i++) {
      await adapter.appendMessage('agent-a', msg('user', `msg-${i}`, i));
    }

    const history = await adapter.loadHistory('agent-a', 3);

    expect(history).toHaveLength(3);
    expect(history.map((m) => m.content)).toEqual(['msg-3', 'msg-4', 'msg-5']);
  });

  it('loadHistory returns [] when transcript file does not exist', async () => {
    const adapter = createJsonlAdapter(tempDir);
    const history = await adapter.loadHistory('nonexistent-agent');
    expect(history).toEqual([]);
  });

  it('loadHistory returns [] for an empty transcript file', async () => {
    const adapter = createJsonlAdapter(tempDir);
    // Create empty file via append of nothing — use a different approach: append then delete content
    // Simplest: create the dir and file manually
    const { mkdir, writeFile } = await import('fs/promises');
    const dir = join(tempDir, 'transcripts', 'agent-a');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'transcript.jsonl'), '', 'utf-8');

    const history = await adapter.loadHistory('agent-a');
    expect(history).toEqual([]);
  });

  it('loadHistory skips malformed lines and returns the rest', async () => {
    const { mkdir, writeFile } = await import('fs/promises');
    const adapter = createJsonlAdapter(tempDir);
    const dir = join(tempDir, 'transcripts', 'agent-a');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'transcript.jsonl'),
      [
        JSON.stringify(msg('user', 'good-1')),
        'this is not json {{{',
        JSON.stringify(msg('assistant', 'good-2')),
        '{"role":"user"}', // missing required fields
        JSON.stringify(msg('user', 'good-3')),
      ].join('\n') + '\n',
      'utf-8',
    );

    const history = await adapter.loadHistory('agent-a');

    expect(history).toHaveLength(3);
    expect(history.map((m) => m.content)).toEqual(['good-1', 'good-2', 'good-3']);
  });

  it('two agents write to independent directories', async () => {
    const adapter = createJsonlAdapter(tempDir);
    await adapter.appendMessage('agent-a', msg('user', 'from-a'));
    await adapter.appendMessage('agent-b', msg('user', 'from-b'));

    const historyA = await adapter.loadHistory('agent-a');
    const historyB = await adapter.loadHistory('agent-b');

    expect(historyA).toHaveLength(1);
    expect(historyA[0].content).toBe('from-a');
    expect(historyB).toHaveLength(1);
    expect(historyB[0].content).toBe('from-b');
  });

  it('integration: history persists across adapter instances (simulates restart)', async () => {
    // First adapter instance — write messages
    const adapter1 = createJsonlAdapter(tempDir);
    await adapter1.appendMessage('agent-a', msg('user', 'hello', 1));
    await adapter1.appendMessage('agent-a', msg('assistant', 'hi there', 2));

    // Second adapter instance with same baseDir — simulates app restart
    const adapter2 = createJsonlAdapter(tempDir);
    const history = await adapter2.loadHistory('agent-a');

    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('hello');
    expect(history[1].content).toBe('hi there');
  });

  it('loadHistory with limit 0 returns all messages', async () => {
    const adapter = createJsonlAdapter(tempDir);
    for (let i = 1; i <= 4; i++) {
      await adapter.appendMessage('agent-a', msg('user', `msg-${i}`, i));
    }

    const history = await adapter.loadHistory('agent-a', 0);
    expect(history).toHaveLength(4);
  });
});
