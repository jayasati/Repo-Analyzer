
import * as readline from 'readline';
import * as fs from 'fs';

/**
 * Reads only the first MAX_LINES of a file — enough to capture all import
 * statements which appear at the top of every source file.
 *
 * WHY: A 10 000-line generated file may have 10 import lines at the top.
 * Reading the full 2MB wastes memory. We stop after 200 lines.
 */
export async function readImportSection(
  filePath: string,
  maxLines = 200,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    const rl = readline.createInterface({
      input:     fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      lines.push(line);
      if (lines.length >= maxLines) rl.close();
    });

    rl.on('close', () => resolve(lines.join('\n')));
    rl.on('error', reject);
  });
}