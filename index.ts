import { getDefaultConfig } from './src/core/config.js';
import { getAllAgents } from './src/agents/loader.js';
import { createEventBus } from './src/core/event-bus.js';
import { createJsonlAdapter } from './src/storage/jsonl-adapter.js';
import { createClaudeRunner } from './src/runtime/runner.js';

export async function main(): Promise<void> {
  console.log('Cortex starting...');

  const config = getDefaultConfig();
  const eventBus = createEventBus();
  const storage = createJsonlAdapter(config.storageDir);

  const agents = await getAllAgents(config.agentsDir);
  console.log(`Loaded ${agents.length} agent(s): ${agents.map((a) => a.name).join(', ') || 'none'}`);

  // Runners are created per-agent and share the event bus + storage adapter.
  // Handed to the TUI in Phase 5 — unused here intentionally.
  // @ts-expect-error unused until Phase 5 wires the TUI
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const runners = new Map(
    agents.map((agent) => [agent.name, createClaudeRunner(eventBus, storage)]),
  );

  // Phase 5 will wire the TUI here
}

// Only run when executed directly (not imported in tests)
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}
