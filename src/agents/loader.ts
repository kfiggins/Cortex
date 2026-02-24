import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import { validateAgentYaml } from './validator.js';
import type { AgentConfig } from '../core/types.js';

/**
 * Loads all agent configs from the given directory.
 * - Skips subdirectories missing agent.yaml (logs a warning)
 * - Throws on malformed YAML or invalid schema
 * - Throws if brain.md is missing
 * - Auto-creates memory.md if missing
 * - Throws if agentsDir does not exist
 */
export async function getAllAgents(agentsDir: string): Promise<AgentConfig[]> {
  // Verify the agents directory exists
  try {
    const dirStat = await stat(agentsDir);
    if (!dirStat.isDirectory()) {
      throw new Error(`Agents path exists but is not a directory: ${agentsDir}`);
    }
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      throw new Error(`Agents directory not found: ${agentsDir}`);
    }
    throw err;
  }

  const entries = await readdir(agentsDir, { withFileTypes: true });
  const agentDirs = entries.filter((e) => e.isDirectory());

  const configs: AgentConfig[] = [];

  for (const dir of agentDirs) {
    const agentPath = join(agentsDir, dir.name);
    const config = await loadAgent(agentPath, dir.name);
    if (config !== null) {
      configs.push(config);
    }
  }

  return configs;
}

async function loadAgent(agentPath: string, dirName: string): Promise<AgentConfig | null> {
  const yamlPath = join(agentPath, 'agent.yaml');
  const brainPath = join(agentPath, 'brain.md');
  const memoryPath = join(agentPath, 'memory.md');

  // agent.yaml — skip with warning if missing
  let rawYaml: string;
  try {
    rawYaml = await readFile(yamlPath, 'utf-8');
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      console.warn(`[cortex] Skipping "${dirName}": agent.yaml not found`);
      return null;
    }
    throw err;
  }

  // Parse YAML
  let parsed: unknown;
  try {
    parsed = yaml.load(rawYaml);
  } catch (err) {
    throw new Error(
      `[${dirName}] Failed to parse agent.yaml: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Validate schema
  const validated = validateAgentYaml(parsed, dirName);

  // brain.md — required
  let brain: string;
  try {
    brain = await readFile(brainPath, 'utf-8');
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      throw new Error(`[${dirName}] brain.md is required but was not found`);
    }
    throw err;
  }

  // memory.md — auto-create if missing
  let memory: string;
  try {
    memory = await readFile(memoryPath, 'utf-8');
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      await writeFile(memoryPath, '', 'utf-8');
      memory = '';
    } else {
      throw err;
    }
  }

  return {
    name: validated.name,
    description: validated.description,
    model: validated.model,
    tools: validated.tools,
    brain,
    memory,
  };
}

function isNodeError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && 'code' in err;
}
