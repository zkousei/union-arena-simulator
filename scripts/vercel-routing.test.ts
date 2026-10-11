import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

describe('production TCG+ routing', () => {
  it.each(['url_code', 'recipe'])('provides an official upstream route for %s instead of the SPA fallback', endpoint => {
    const source = `/api/tcg-plus/api/user/deck/${endpoint}`;
    const route = config.rewrites.find((rule: { source: string }) => rule.source === source);
    expect(route, 'The deployed API route must exist').toBeDefined();
    const destination = new URL(route.destination);
    expect(destination.origin).toBe('https://api.bandai-tcg-plus.com');
    expect(destination.pathname).toBe(`/api/user/deck/${endpoint}`);
    expect(destination.search).toBe(''); // Original query is forwarded by Vercel.
  });
});
