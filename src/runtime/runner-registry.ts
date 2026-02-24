import type { ClaudeRunner } from './runner.js';

export interface RunnerRegistry {
  getRunner(agentName: string): ClaudeRunner | undefined;
  registerRunner(agentName: string, runner: ClaudeRunner): void;
  getAllRunnerNames(): string[];
}

export function createRunnerRegistry(): RunnerRegistry {
  const registry = new Map<string, ClaudeRunner>();

  return {
    getRunner(agentName: string): ClaudeRunner | undefined {
      return registry.get(agentName);
    },

    registerRunner(agentName: string, runner: ClaudeRunner): void {
      registry.set(agentName, runner);
    },

    getAllRunnerNames(): string[] {
      return [...registry.keys()];
    },
  };
}
