import { spawnSync } from 'child_process';

/**
 * Opens a file in the user's $EDITOR (falls back to vi).
 * Suspends the TUI while the editor is open by temporarily
 * disabling raw mode and inheriting stdio.
 */
export function openInEditor(filePath: string): void {
  const editor = process.env['EDITOR'] || 'vi';

  // Temporarily disable raw mode so the editor can use stdin
  const wasRaw = process.stdin.isTTY && process.stdin.isRaw;
  if (wasRaw) {
    process.stdin.setRawMode(false);
  }

  spawnSync(editor, [filePath], { stdio: 'inherit' });

  // Restore raw mode for Ink
  if (wasRaw && process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
}
