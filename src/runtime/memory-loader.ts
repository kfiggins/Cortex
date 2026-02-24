import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

/**
 * Loads memory.md from disk for a specific agent.
 * Returns empty string if the file does not exist.
 */
export async function loadMemory(agentDir: string): Promise<string> {
  try {
    return await readFile(join(agentDir, 'memory.md'), 'utf-8');
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return '';
    }
    throw err;
  }
}

/**
 * Writes memory content to memory.md for a specific agent.
 * Creates the file (and parent directory) if it doesn't exist.
 */
export async function saveMemory(agentDir: string, content: string): Promise<void> {
  const filePath = join(agentDir, 'memory.md');
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf-8');
}

function isNodeError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && 'code' in err;
}
