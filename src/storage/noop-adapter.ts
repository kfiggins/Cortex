import type { StorageAdapter } from '../core/types.js';

/**
 * No-op StorageAdapter — discards all writes, returns empty history.
 * Used until Phase 4 provides the real JSONL implementation.
 */
export function createNoopAdapter(): StorageAdapter {
  return {
    async appendMessage(): Promise<void> {
      // intentional no-op
    },
    async loadHistory(): Promise<[]> {
      return [];
    },
  };
}
