import { describe, expect, it, vi } from 'vitest';
import { createCardCatalog } from '../cardCatalog';
const card = (code: string, titleCode: string, title = titleCode) => ({
  code, titleCode, title, name: code, cardType: 'CHARACTER', color: 'PURPLE', bp: 1000,
  apCost: 1, reqEnergy: 0, genEnergy: 1, traits: [], triggers: [], effectText: '',
});
const a = card('UA/AAA-1-001', 'AAA');
const b = card('UA/BBB-1-001', 'BBB');
const ap = card('UAPR/AAA_AP01', 'OTHER', 'AAA');
const index = { version: 'test', shards: [
  { id: 'AAA', titles: ['AAA'], codes: [a.code] },
  { id: 'BBB', titles: ['BBB'], codes: [b.code] },
  { id: 'OTHER', titles: ['AAA'], codes: [ap.code] },
] };
const setup = () => {
  const assets: Record<string, unknown> = { '/index.json': index, '/AAA.json': [a], '/BBB.json': [b], '/OTHER.json': [ap] };
  const fetcher = vi.fn<typeof fetch>(async (url) => new Response(JSON.stringify(assets[String(url)])));
  const catalog = createCardCatalog('/index.json', { AAA: '/AAA.json', BBB: '/BBB.json', OTHER: '/OTHER.json' }, []);
  return { fetcher, catalog };
};
describe('cold card catalog', () => {
  it('loads only the index on startup and separates known unloaded cards from custom cards', async () => {
    const { fetcher, catalog } = setup();
    await catalog.loadIndex(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(catalog.getCards()).toEqual([]);
    expect(catalog.isOfficialCode(a.code)).toBe(true);
    expect(catalog.isOfficialCode('CUSTOM')).toBe(false);
    expect(() => catalog.requireCard(a.code)).toThrow(/未取得/);
  });
  it('loads all shards for a display title, including exceptional AP codes, and shares requests', async () => {
    const { fetcher, catalog } = setup();
    await Promise.all([catalog.loadTitle('AAA', fetcher), catalog.loadTitle('AAA', fetcher)]);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/index.json', '/AAA.json', '/OTHER.json']);
    expect(catalog.getCards().map((c) => c.code)).toEqual([a.code, ap.code]);
    await catalog.loadTitle('AAA', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('resolves short imported codes without fetching unrelated titles', async () => {
    const { fetcher, catalog } = setup();
    await catalog.ensureCodes(['bbb-1-001', 'CUSTOM'], fetcher);
    expect(catalog.getCards().map((c) => c.code)).toEqual([b.code]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects a mismatched shard atomically and retries it', async () => {
    const { fetcher, catalog } = setup();
    await catalog.loadIndex(fetcher);
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify([b])));
    await expect(catalog.loadTitle('BBB', fetcher)).resolves.toBeUndefined();
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify([b])));
    await expect(catalog.ensureCodes([a.code], fetcher)).rejects.toThrow();
    expect(catalog.getCards().map((c) => c.code)).toEqual([b.code]);
    await catalog.loadTitle('AAA', fetcher);
    expect(catalog.getCards()).toHaveLength(3);
  });
  it('notifies consumers and keeps canonical ordering independent of download order', async () => {
    const { fetcher, catalog } = setup();
    const listener = vi.fn();
    const unsubscribe = catalog.subscribe(listener);
    await catalog.loadTitle('BBB', fetcher);
    await catalog.loadAll(fetcher);
    expect(catalog.getCards().map((c) => c.code)).toEqual([a.code, b.code, ap.code]);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
  it('allows index retry after network failure without publishing an incomplete index', async () => {
    const { fetcher, catalog } = setup();
    fetcher.mockRejectedValueOnce(new Error('offline'));
    await expect(catalog.loadIndex(fetcher)).rejects.toThrow();
    await catalog.loadTitle('BBB', fetcher);
    expect(catalog.getCards()).toHaveLength(1);
  });
});

it('times out a stalled asset and allows retry', async () => {
  vi.useFakeTimers();
  try {
    const { fetcher, catalog } = setup();
    await catalog.loadIndex(fetcher);
    fetcher.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('timeout')));
    }));
    const failure = expect(catalog.ensureCodes([b.code], fetcher)).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(15_000);
    await failure;
    expect(catalog.getCards()).toEqual([]);
    await catalog.ensureCodes([b.code], fetcher);
    expect(catalog.getCards()).toHaveLength(1);
  } finally { vi.useRealTimers(); }
});
it('rejects duplicate index codes and invalid assets before publishing anything', async () => {
  const { fetcher, catalog } = setup();
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ...index, shards: [index.shards[0], { ...index.shards[1], codes: [a.code] }] })));
  await expect(catalog.loadIndex(fetcher)).rejects.toThrow();
  expect(catalog.isOfficialCode(a.code)).toBe(false);
  await catalog.loadIndex(fetcher);
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify([{ ...a, triggers: ['UNKNOWN'] }])));
  await expect(catalog.ensureCodes([a.code], fetcher)).rejects.toThrow();
  expect(catalog.getCards()).toEqual([]);
});
it('does not confuse short import aliases with canonical stored official codes', async () => {
  const { fetcher, catalog } = setup();
  await catalog.loadIndex(fetcher);
  expect(catalog.isOfficialCode('AAA-1-001')).toBe(false);
  expect(catalog.requireCard('CUSTOM')).toBeUndefined();
});
