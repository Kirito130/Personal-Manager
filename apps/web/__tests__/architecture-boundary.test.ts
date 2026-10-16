import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const webRoot = join(__dirname, '..');

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '__tests__') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkTsFiles(path, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(path);
  }
  return acc;
}

describe('architecture boundary', () => {
  it('does not call Supabase PostgREST (.from / .rpc) from the web app', () => {
    const offenders: string[] = [];
    for (const file of walkTsFiles(webRoot)) {
      const src = readFileSync(file, 'utf8');
      // Allow comments that mention the forbidden APIs.
      const lines = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
      const body = lines.join('\n');
      // PostgREST-style calls only (avoid matching Array.from / Buffer.from).
      if (
        /\.from\s*\(\s*['"`]/.test(body) ||
        /\.rpc\s*\(\s*['"`]/.test(body)
      ) {
        offenders.push(file.replace(webRoot, 'apps/web'));
      }
    }
    expect(offenders).toEqual([]);
  });
});
