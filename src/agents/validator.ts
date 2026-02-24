/**
 * Validates a raw parsed YAML object against the AgentConfig schema.
 * Throws a descriptive error on any violation.
 * Does NOT load file contents — that's the loader's job.
 */

export interface RawAgentYaml {
  name: string;
  description: string;
  model: string;
  tools: string[];
}

export function validateAgentYaml(raw: unknown, agentDirName: string): RawAgentYaml {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`[${agentDirName}] agent.yaml must be a YAML object, got ${typeof raw}`);
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj['name'] !== 'string' || obj['name'].trim() === '') {
    throw new Error(`[${agentDirName}] agent.yaml missing required field: "name"`);
  }
  if (obj['name'] !== agentDirName) {
    throw new Error(
      `[${agentDirName}] agent.yaml "name" field ("${obj['name']}") must match the directory name ("${agentDirName}")`,
    );
  }
  if (typeof obj['description'] !== 'string' || obj['description'].trim() === '') {
    throw new Error(`[${agentDirName}] agent.yaml missing required field: "description"`);
  }
  if (typeof obj['model'] !== 'string' || obj['model'].trim() === '') {
    throw new Error(`[${agentDirName}] agent.yaml missing required field: "model"`);
  }

  // tools is optional — default to [] if absent, error if present but wrong type
  const tools = obj['tools'] ?? [];
  if (!Array.isArray(tools)) {
    throw new Error(`[${agentDirName}] agent.yaml field "tools" must be an array`);
  }
  if (tools.some((t) => typeof t !== 'string')) {
    throw new Error(`[${agentDirName}] agent.yaml field "tools" must be an array of strings`);
  }

  return {
    name: obj['name'],
    description: obj['description'],
    model: obj['model'],
    tools: tools as string[],
  };
}
