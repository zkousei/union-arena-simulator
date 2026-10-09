import { describe, expect, it, vi } from 'vitest';
import { createCardAssetLoader } from '../officialCardAsset';

const card = {
  code: 'UA01BT/CGH-1-001', name: 'テスト', title: 'コードギアス', titleCode: 'CGH',
  cardType: 'CHARACTER', color: 'PURPLE', bp: 1000, apCost: 1, reqEnergy: 0,
  genEnergy: 1, traits: [], triggers: ['GET'], effectText: '',
};
const response = (data: unknown) => new Response(JSON.stringify(data));

describe('official card asset loading', () => {
  it('shares concurrent requests and caches the completed database', async () => {
    const apply = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response([card]));
    const load = createCardAssetLoader('/assets/cards.json', apply);
    await Promise.all([load(fetcher), load(fetcher)]);
    await load(fetcher);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/assets/cards.json');
    expect(apply).toHaveBeenCalledExactlyOnceWith([card]);
  });

  it('does not publish partial data and permits retry after an HTTP failure', async () => {
    const apply = vi.fn();
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(response([card]));
    const load = createCardAssetLoader('/assets/cards.json', apply);
    await expect(load(fetcher)).rejects.toThrow();
    expect(apply).not.toHaveBeenCalled();
    await load(fetcher);
    expect(apply).toHaveBeenCalledWith([card]);
  });

  it('permits retry after a network failure or malformed JSON', async () => {
    const apply = vi.fn();
    const fetcher = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response('<html>Not JSON</html>'))
      .mockResolvedValueOnce(response([card]));
    const load = createCardAssetLoader('/assets/cards.json', apply);
    await expect(load(fetcher)).rejects.toThrow();
    await expect(load(fetcher)).rejects.toThrow();
    expect(apply).not.toHaveBeenCalled();
    await load(fetcher);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it.each([
    {}, [], [card, null], [card, { ...card, traits: null }],
    [{ ...card, triggers: ['UNKNOWN'] }], [{ ...card, bp: '1000' }],
    [{ ...card, hasBpPlus: 'yes' }], [{ ...card, imageUrl: {} }],
    [{ ...card, cardType: 'UNKNOWN' }], [{ ...card, color: 'UNKNOWN' }],
  ])('rejects invalid data without publishing any cards: %j', async (data) => {
    const apply = vi.fn();
    const load = createCardAssetLoader('/assets/cards.json', apply);
    await expect(load(vi.fn<typeof fetch>().mockResolvedValue(response(data)))).rejects.toThrow();
    expect(apply).not.toHaveBeenCalled();
  });
});
