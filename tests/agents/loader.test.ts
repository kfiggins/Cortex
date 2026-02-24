import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getAllAgents } from '../../src/agents/loader.js';

// ── helpers ────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'cortex-loader-test-'));
}

interface AgentFiles {
  yaml?: string;
  brain?: string;
  memory?: string;
}

function createAgent(agentsDir: string, name: string, files: AgentFiles = {}): string {
  const agentDir = join(agentsDir, name);
  mkdirSync(agentDir, { recursive: true });

  if (files.yaml !== undefined) {
    writeFileSync(join(agentDir, 'agent.yaml'), files.yaml, 'utf-8');
  }
  if (files.brain !== undefined) {
    writeFileSync(join(agentDir, 'brain.md'), files.brain, 'utf-8');
  }
  if (files.memory !== undefined) {
    writeFileSync(join(agentDir, 'memory.md'), files.memory, 'utf-8');
  }
  return agentDir;
}

function validYaml(name: string): string {
  return `name: ${name}\ndescription: A test agent\nmodel: claude-sonnet-4-6\ntools: []\n`;
}

// ── tests ──────────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(() => {
  tempDir = makeTempDir();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('getAllAgents', () => {
  it('loads a valid agent correctly', async () => {
    createAgent(tempDir, 'my-agent', {
      yaml: validYaml('my-agent'),
      brain: 'You are a helpful assistant.',
      memory: 'User prefers concise responses.',
    });

    const agents = await getAllAgents(tempDir);

    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('my-agent');
    expect(agents[0].description).toBe('A test agent');
    expect(agents[0].model).toBe('claude-sonnet-4-6');
    expect(agents[0].brain).toBe('You are a helpful assistant.');
    expect(agents[0].memory).toBe('User prefers concise responses.');
    expect(agents[0].tools).toEqual([]);
  });

  it('auto-creates memory.md when missing and returns empty string', async () => {
    const agentDir = createAgent(tempDir, 'no-memory', {
      yaml: validYaml('no-memory'),
      brain: 'I have no memory yet.',
    });

    const agents = await getAllAgents(tempDir);

    expect(agents).toHaveLength(1);
    expect(agents[0].memory).toBe('');
    expect(existsSync(join(agentDir, 'memory.md'))).toBe(true);
  });

  it('throws when brain.md is missing', async () => {
    createAgent(tempDir, 'no-brain', {
      yaml: validYaml('no-brain'),
    });

    await expect(getAllAgents(tempDir)).rejects.toThrow('brain.md');
  });

  it('throws with agent name when brain.md is missing', async () => {
    createAgent(tempDir, 'no-brain', {
      yaml: validYaml('no-brain'),
    });

    await expect(getAllAgents(tempDir)).rejects.toThrow('no-brain');
  });

  it('throws on malformed YAML', async () => {
    createAgent(tempDir, 'bad-yaml', {
      yaml: 'name: bad-yaml\n  invalid: [unclosed\n',
      brain: 'some brain',
    });

    await expect(getAllAgents(tempDir)).rejects.toThrow('bad-yaml');
  });

  it('throws when a required YAML field is missing', async () => {
    createAgent(tempDir, 'missing-field', {
      yaml: 'name: missing-field\ndescription: desc\n', // model missing
      brain: 'brain content',
    });

    await expect(getAllAgents(tempDir)).rejects.toThrow('"model"');
  });

  it('loads all agents when multiple valid agents exist', async () => {
    for (const name of ['agent-a', 'agent-b', 'agent-c']) {
      createAgent(tempDir, name, {
        yaml: validYaml(name),
        brain: `Brain for ${name}`,
      });
    }

    const agents = await getAllAgents(tempDir);

    expect(agents).toHaveLength(3);
    const names = agents.map((a) => a.name).sort();
    expect(names).toEqual(['agent-a', 'agent-b', 'agent-c']);
  });

  it('returns empty array for an empty agents directory', async () => {
    const agents = await getAllAgents(tempDir);
    expect(agents).toEqual([]);
  });

  it('throws when the agents directory does not exist', async () => {
    await expect(getAllAgents('/nonexistent/path/that/does/not/exist')).rejects.toThrow(
      'not found',
    );
  });

  it('skips a subdirectory missing agent.yaml without throwing', async () => {
    // valid agent
    createAgent(tempDir, 'good-agent', {
      yaml: validYaml('good-agent'),
      brain: 'good brain',
    });
    // directory with no agent.yaml — should be skipped
    mkdirSync(join(tempDir, 'orphan-dir'));

    const agents = await getAllAgents(tempDir);

    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('good-agent');
  });
});
