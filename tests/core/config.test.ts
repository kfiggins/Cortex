import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { getDefaultConfig } from '../../src/core/config.js';

describe('getDefaultConfig', () => {
  it('returns agentsDir relative to process.cwd()', () => {
    const config = getDefaultConfig();
    expect(config.agentsDir).toBe(join(process.cwd(), 'agents'));
  });

  it('returns storageDir relative to process.cwd()', () => {
    const config = getDefaultConfig();
    expect(config.storageDir).toBe(join(process.cwd(), '.cortex'));
  });

  it('returns a new object on each call', () => {
    const a = getDefaultConfig();
    const b = getDefaultConfig();
    expect(a).not.toBe(b);
  });
});
