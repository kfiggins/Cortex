import React from 'react';
import { render } from 'ink';
import { getDefaultConfig } from './src/core/config.js';
import { getAllAgents } from './src/agents/loader.js';
import { createEventBus } from './src/core/event-bus.js';
import { createJsonlAdapter } from './src/storage/jsonl-adapter.js';
import { createClaudeRunner } from './src/runtime/runner.js';
import { createRunnerRegistry } from './src/runtime/runner-registry.js';
import { App } from './src/ui/App.js';

export async function main(): Promise<void> {
  const config = getDefaultConfig();
  const eventBus = createEventBus();
  const storage = createJsonlAdapter(config.storageDir);

  const agents = await getAllAgents(config.agentsDir);

  const registry = createRunnerRegistry();
  for (const agent of agents) {
    registry.registerRunner(agent.name, createClaudeRunner(eventBus, storage));
  }

  function onSendMessage(agentName: string, message: string): void {
    const runner = registry.getRunner(agentName);
    const agentConfig = agents.find((a) => a.name === agentName);
    if (!runner || !agentConfig) return;
    runner.run({ agentConfig, userMessage: message }).catch(console.error);
  }

  const { waitUntilExit } = render(
    React.createElement(App, { agents, eventBus, onSendMessage }),
  );

  await waitUntilExit();
}

// Only run when executed directly (not imported in tests)
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}
