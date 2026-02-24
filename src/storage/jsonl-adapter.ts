import { appendFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { StorageAdapter, Message } from '../core/types.js';

/**
 * JSONL-backed StorageAdapter.
 * Transcripts are stored at: <baseDir>/transcripts/<agentName>/transcript.jsonl
 *
 * One JSON object per line. Each line is a serialized Message.
 * Append-only writes — never reads to write.
 */
export function createJsonlAdapter(baseDir: string): StorageAdapter {
  function transcriptPath(agentName: string): string {
    return join(baseDir, 'transcripts', agentName, 'transcript.jsonl');
  }

  function transcriptDir(agentName: string): string {
    return join(baseDir, 'transcripts', agentName);
  }

  return {
    async appendMessage(agentName: string, message: Message): Promise<void> {
      const dir = transcriptDir(agentName);
      await mkdir(dir, { recursive: true });

      const line = JSON.stringify(message) + '\n';
      await appendFile(transcriptPath(agentName), line, 'utf-8');
    },

    async loadHistory(agentName: string, limit?: number): Promise<Message[]> {
      let raw: string;
      try {
        raw = await readFile(transcriptPath(agentName), 'utf-8');
      } catch (err) {
        if (isNodeError(err) && err.code === 'ENOENT') {
          return [];
        }
        throw err;
      }

      if (!raw.trim()) {
        return [];
      }

      const messages: Message[] = [];
      const lines = raw.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (isMessage(parsed)) {
            messages.push(parsed);
          } else {
            console.warn(`[cortex] Skipping malformed transcript line: ${trimmed}`);
          }
        } catch {
          console.warn(`[cortex] Skipping unparseable transcript line: ${trimmed}`);
        }
      }

      if (limit !== undefined && limit > 0) {
        return messages.slice(-limit);
      }
      return messages;
    },
  };
}

function isMessage(value: unknown): value is Message {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    (obj['role'] === 'user' || obj['role'] === 'assistant') &&
    typeof obj['content'] === 'string' &&
    typeof obj['timestamp'] === 'number'
  );
}

function isNodeError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && 'code' in err;
}
