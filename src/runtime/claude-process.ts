import { spawn } from 'child_process';
import type { EventBus } from '../core/event-bus.js';
import type { Message } from '../core/types.js';

export interface SpawnOptions {
  model: string;
  agentName: string;
  systemPrompt: string;
  messages: Message[];
  eventBus: EventBus;
}

export interface ProcessResult {
  fullResponse: string;
}

/**
 * Spawns the Claude CLI process and streams output via the event bus.
 *
 * Emits (in order):
 *   AgentStarted → AgentStreaming (0..n) → AgentCompleted | AgentErrored
 *
 * Never throws — all errors are communicated via AgentErrored.
 * Returns the full response string on success, null on error.
 */
export async function spawnClaude(opts: SpawnOptions): Promise<ProcessResult | null> {
  const { model, agentName, systemPrompt, messages, eventBus } = opts;

  eventBus.emit({ type: 'AgentStarted', agentName });

  // Build CLI arguments
  // Last message is the user's input; prior messages form the conversation context
  const lastMessage = messages[messages.length - 1];
  const userInput = lastMessage?.content ?? '';

  // Pass history as a JSON string via --conversation flag if supported,
  // otherwise fall back to system+single-message invocation.
  // For now: simple single-turn call. Multi-turn history via Phase 4 context window.
  const args = ['--model', model, '--system', systemPrompt, '-p', userInput, '--output-format', 'stream-json', '--no-markdown'];

  return new Promise((resolve) => {
    let fullResponse = '';
    let stderr = '';
    let settled = false;

    function settle(result: ProcessResult | null) {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    }

    let proc: ReturnType<typeof spawn>;

    try {
      proc = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      eventBus.emit({
        type: 'AgentErrored',
        agentName,
        payload: { error: err instanceof Error ? err : new Error(String(err)) },
      });
      settle(null);
      return;
    }

    // stdio is configured as 'pipe' so stdout/stderr are always defined
    (proc.stdout as NonNullable<typeof proc.stdout>).on('data', (chunk: Buffer) => {
      const raw = chunk.toString();
      // Claude stream-json emits one JSON object per line
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          const text = extractText(parsed);
          if (text) {
            fullResponse += text;
            eventBus.emit({ type: 'AgentStreaming', agentName, payload: { chunk: text } });
          }
        } catch {
          // Non-JSON line (e.g. progress indicators) — emit as raw chunk
          fullResponse += trimmed;
          eventBus.emit({ type: 'AgentStreaming', agentName, payload: { chunk: trimmed } });
        }
      }
    });

    (proc.stderr as NonNullable<typeof proc.stderr>).on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err: Error) => {
      eventBus.emit({ type: 'AgentErrored', agentName, payload: { error: err } });
      settle(null);
    });

    proc.on('close', (code: number | null) => {
      if (code !== 0) {
        const msg = stderr.trim() || `Claude exited with code ${String(code)}`;
        eventBus.emit({
          type: 'AgentErrored',
          agentName,
          payload: { error: new Error(msg) },
        });
        settle(null);
        return;
      }
      eventBus.emit({ type: 'AgentCompleted', agentName, payload: { fullResponse } });
      settle({ fullResponse });
    });
  });
}

/** Extract text content from a Claude stream-json event object. */
function extractText(parsed: Record<string, unknown>): string {
  // stream-json format: { type: 'content_block_delta', delta: { type: 'text_delta', text: '...' } }
  if (parsed['type'] === 'content_block_delta') {
    const delta = parsed['delta'] as Record<string, unknown> | undefined;
    if (delta && typeof delta['text'] === 'string') {
      return delta['text'];
    }
  }
  return '';
}
