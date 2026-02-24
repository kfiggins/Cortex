import { describe, it, expect } from 'vitest';
import {
  initUIState,
  applyEvent,
  selectAgent,
  updateInput,
  clearStream,
  addUserMessage,
} from '../../src/ui/state-manager.js';
import type { UIState } from '../../src/ui/state.js';
import type { AgentConfig } from '../../src/core/types.js';

// ── helpers ────────────────────────────────────────────────────────────────

function makeAgentConfig(name: string): AgentConfig {
  return {
    name,
    description: `Agent ${name}`,
    model: 'claude-sonnet-4-6',
    brain: 'You are a test assistant.',
    memory: '',
    tools: [],
  };
}

function makeState(agentNames: string[] = ['agent-a', 'agent-b']): UIState {
  return initUIState(agentNames.map(makeAgentConfig));
}

// ── applyEvent ─────────────────────────────────────────────────────────────

describe('applyEvent', () => {
  it('AgentStarted — sets agent status to running', () => {
    const state = makeState();
    const next = applyEvent(state, { type: 'AgentStarted', agentName: 'agent-a' });
    const agent = next.agents.find((a) => a.name === 'agent-a');
    expect(agent?.status).toBe('running');
  });

  it('AgentStarted — does not affect other agents', () => {
    const state = makeState();
    const next = applyEvent(state, { type: 'AgentStarted', agentName: 'agent-a' });
    const other = next.agents.find((a) => a.name === 'agent-b');
    expect(other?.status).toBe('idle');
  });

  it('AgentStreaming — appends chunk to currentStream', () => {
    const state = makeState();
    const s1 = applyEvent(state, {
      type: 'AgentStreaming',
      agentName: 'agent-a',
      payload: { chunk: 'Hello ' },
    });
    const s2 = applyEvent(s1, {
      type: 'AgentStreaming',
      agentName: 'agent-a',
      payload: { chunk: 'world' },
    });
    const agent = s2.agents.find((a) => a.name === 'agent-a');
    expect(agent?.currentStream).toBe('Hello world');
  });

  it('AgentStreaming — does not affect other agents stream', () => {
    const state = makeState();
    const next = applyEvent(state, {
      type: 'AgentStreaming',
      agentName: 'agent-a',
      payload: { chunk: 'text' },
    });
    const other = next.agents.find((a) => a.name === 'agent-b');
    expect(other?.currentStream).toBe('');
  });

  it('AgentCompleted — adds assistant message, clears stream, sets status to idle', () => {
    let state = makeState();
    state = applyEvent(state, { type: 'AgentStarted', agentName: 'agent-a' });
    state = applyEvent(state, {
      type: 'AgentStreaming',
      agentName: 'agent-a',
      payload: { chunk: 'partial...' },
    });
    state = applyEvent(state, {
      type: 'AgentCompleted',
      agentName: 'agent-a',
      payload: { fullResponse: 'Full response text.' },
    });

    const agent = state.agents.find((a) => a.name === 'agent-a');
    expect(agent?.status).toBe('idle');
    expect(agent?.currentStream).toBe('');
    expect(agent?.messages).toHaveLength(1);
    expect(agent?.messages[0].role).toBe('assistant');
    expect(agent?.messages[0].content).toBe('Full response text.');
  });

  it('AgentCompleted — does not affect other agents', () => {
    let state = makeState();
    state = applyEvent(state, { type: 'AgentStarted', agentName: 'agent-b' });
    state = applyEvent(state, {
      type: 'AgentCompleted',
      agentName: 'agent-b',
      payload: { fullResponse: 'done' },
    });
    const other = state.agents.find((a) => a.name === 'agent-a');
    expect(other?.status).toBe('idle');
    expect(other?.messages).toHaveLength(0);
  });

  it('AgentErrored — sets agent status to error', () => {
    const state = makeState();
    const next = applyEvent(state, {
      type: 'AgentErrored',
      agentName: 'agent-a',
      payload: { error: new Error('oops') },
    });
    const agent = next.agents.find((a) => a.name === 'agent-a');
    expect(agent?.status).toBe('error');
  });

  it('AgentErrored — does not affect other agents', () => {
    const state = makeState();
    const next = applyEvent(state, {
      type: 'AgentErrored',
      agentName: 'agent-a',
      payload: { error: new Error('oops') },
    });
    const other = next.agents.find((a) => a.name === 'agent-b');
    expect(other?.status).toBe('idle');
  });

  it('events for non-selected agent update their own status without affecting selected agent', () => {
    let state = makeState();
    state = selectAgent(state, 'agent-a');
    state = applyEvent(state, { type: 'AgentStarted', agentName: 'agent-b' });

    const selected = state.agents.find((a) => a.name === 'agent-a');
    const other = state.agents.find((a) => a.name === 'agent-b');
    expect(state.selectedAgentName).toBe('agent-a');
    expect(selected?.status).toBe('idle');
    expect(other?.status).toBe('running');
  });
});

// ── selectAgent ────────────────────────────────────────────────────────────

describe('selectAgent', () => {
  it('updates selectedAgentName', () => {
    const state = makeState();
    const next = selectAgent(state, 'agent-b');
    expect(next.selectedAgentName).toBe('agent-b');
  });

  it('does not mutate other state fields', () => {
    const state = makeState();
    const next = selectAgent(state, 'agent-b');
    expect(next.agents).toStrictEqual(state.agents);
    expect(next.inputValue).toBe(state.inputValue);
  });
});

// ── updateInput ────────────────────────────────────────────────────────────

describe('updateInput', () => {
  it('updates inputValue', () => {
    const state = makeState();
    const next = updateInput(state, 'hello world');
    expect(next.inputValue).toBe('hello world');
  });

  it('can clear inputValue', () => {
    const state = updateInput(makeState(), 'text');
    const next = updateInput(state, '');
    expect(next.inputValue).toBe('');
  });
});

// ── clearStream ────────────────────────────────────────────────────────────

describe('clearStream', () => {
  it('clears currentStream for the specified agent', () => {
    let state = makeState();
    state = applyEvent(state, {
      type: 'AgentStreaming',
      agentName: 'agent-a',
      payload: { chunk: 'some text' },
    });
    const next = clearStream(state, 'agent-a');
    const agent = next.agents.find((a) => a.name === 'agent-a');
    expect(agent?.currentStream).toBe('');
  });

  it('does not affect other agents streams', () => {
    let state = makeState();
    state = applyEvent(state, {
      type: 'AgentStreaming',
      agentName: 'agent-b',
      payload: { chunk: 'other text' },
    });
    const next = clearStream(state, 'agent-a');
    const other = next.agents.find((a) => a.name === 'agent-b');
    expect(other?.currentStream).toBe('other text');
  });
});

// ── switching agents while one is streaming ────────────────────────────────

describe('switching agents while one is streaming', () => {
  it('switching selected agent does not interrupt the streaming agent', () => {
    let state = makeState();
    state = selectAgent(state, 'agent-a');
    state = applyEvent(state, { type: 'AgentStarted', agentName: 'agent-a' });
    state = applyEvent(state, {
      type: 'AgentStreaming',
      agentName: 'agent-a',
      payload: { chunk: 'streaming...' },
    });

    // Switch to agent-b
    state = selectAgent(state, 'agent-b');

    expect(state.selectedAgentName).toBe('agent-b');
    const agentA = state.agents.find((a) => a.name === 'agent-a');
    expect(agentA?.status).toBe('running');
    expect(agentA?.currentStream).toBe('streaming...');
  });

  it('switching back to streaming agent shows its accumulated stream', () => {
    let state = makeState();
    state = applyEvent(state, { type: 'AgentStarted', agentName: 'agent-a' });
    state = applyEvent(state, {
      type: 'AgentStreaming',
      agentName: 'agent-a',
      payload: { chunk: 'chunk1' },
    });
    state = selectAgent(state, 'agent-b');
    state = applyEvent(state, {
      type: 'AgentStreaming',
      agentName: 'agent-a',
      payload: { chunk: 'chunk2' },
    });
    state = selectAgent(state, 'agent-a');

    const agentA = state.agents.find((a) => a.name === 'agent-a');
    expect(agentA?.currentStream).toBe('chunk1chunk2');
  });
});

// ── addUserMessage ─────────────────────────────────────────────────────────

describe('addUserMessage', () => {
  it('adds a user message to the specified agent', () => {
    const state = makeState();
    const next = addUserMessage(state, 'agent-a', 'Hello!');
    const agent = next.agents.find((a) => a.name === 'agent-a');
    expect(agent?.messages).toHaveLength(1);
    expect(agent?.messages[0].role).toBe('user');
    expect(agent?.messages[0].content).toBe('Hello!');
  });

  it('does not affect other agents', () => {
    const state = makeState();
    const next = addUserMessage(state, 'agent-a', 'Hello!');
    const other = next.agents.find((a) => a.name === 'agent-b');
    expect(other?.messages).toHaveLength(0);
  });
});
