import { describe, it, expect, vi } from 'vitest';

// Mock ink before importing main — main() now renders a TUI which requires
// raw mode. In the test environment stdin has no raw mode, so we stub render.
vi.mock('ink', () => ({
  render: vi.fn(() => ({
    waitUntilExit: () => Promise.resolve(),
  })),
}));

const { main } = await import('../../index.js');

describe('CLI boot', () => {
  it('main() resolves without throwing', async () => {
    await expect(main()).resolves.toBeUndefined();
  });
});
