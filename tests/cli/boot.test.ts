import { describe, it, expect, vi } from 'vitest';
import { main } from '../../index.js';

describe('CLI boot', () => {
  it('main() resolves without throwing', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(main()).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });

  it('main() prints "Cortex starting..."', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await main();

    expect(consoleSpy).toHaveBeenCalledWith('Cortex starting...');
    consoleSpy.mockRestore();
  });
});
