import { join } from 'path';

export interface CortexConfig {
  agentsDir: string; // default: './agents'
  storageDir: string; // default: './.cortex'
}

/**
 * Returns the default config using process.cwd() as the base.
 * This is the single authoritative source of default paths.
 * All code must receive paths from here — never construct paths internally.
 */
export function getDefaultConfig(): CortexConfig {
  const cwd = process.cwd();
  return {
    agentsDir: join(cwd, 'agents'),
    storageDir: join(cwd, '.cortex'),
  };
}
