import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadMemory, saveMemory } from '../../src/runtime/memory-loader.js';

let agentDir: string;

beforeEach(async () => {
  agentDir = await mkdtemp(join(tmpdir(), 'cortex-memory-'));
});

afterEach(async () => {
  await rm(agentDir, { recursive: true, force: true });
});

describe('loadMemory', () => {
  it('returns file contents when memory.md exists', async () => {
    await saveMemory(agentDir, 'User prefers short answers.');
    const result = await loadMemory(agentDir);
    expect(result).toBe('User prefers short answers.');
  });

  it('returns empty string when memory.md does not exist', async () => {
    const result = await loadMemory(agentDir);
    expect(result).toBe('');
  });
});

describe('saveMemory', () => {
  it('writes content to memory.md', async () => {
    await saveMemory(agentDir, 'New memory content.');
    const content = await readFile(join(agentDir, 'memory.md'), 'utf-8');
    expect(content).toBe('New memory content.');
  });

  it('creates the file if it does not exist', async () => {
    const deepDir = join(agentDir, 'nested', 'agent');
    await saveMemory(deepDir, 'Created from nothing.');
    const content = await readFile(join(deepDir, 'memory.md'), 'utf-8');
    expect(content).toBe('Created from nothing.');
  });

  it('overwrites existing content', async () => {
    await saveMemory(agentDir, 'Version 1');
    await saveMemory(agentDir, 'Version 2');
    const content = await readFile(join(agentDir, 'memory.md'), 'utf-8');
    expect(content).toBe('Version 2');
  });
});
