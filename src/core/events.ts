/**
 * Canonical event type definitions — the contract between all layers.
 * Runtime emits these. UI and storage subscribe to them.
 * This file must have zero imports from other layers.
 */

export type AgentEventType =
  | 'AgentStarted'
  | 'AgentStreaming'
  | 'AgentCompleted'
  | 'AgentErrored';

export interface AgentStartedEvent {
  type: 'AgentStarted';
  agentName: string;
}

export interface AgentStreamingEvent {
  type: 'AgentStreaming';
  agentName: string;
  payload: { chunk: string };
}

export interface AgentCompletedEvent {
  type: 'AgentCompleted';
  agentName: string;
  payload: { fullResponse: string };
}

export interface AgentErroredEvent {
  type: 'AgentErrored';
  agentName: string;
  payload: { error: Error };
}

export type AgentEvent =
  | AgentStartedEvent
  | AgentStreamingEvent
  | AgentCompletedEvent
  | AgentErroredEvent;
