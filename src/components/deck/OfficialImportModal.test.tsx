// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as bandaiService from '../../services/bandaiTcgPlusService';
import { OfficialImportModal } from './OfficialImportModal';
import { ensureCardCodes, getCardMaster, type CardMaster } from '../../data/cardDatabase';
import { fetchSeriesCardsViaProxy, parseCardFromDetailHtml } from '../../services/officialCardService';
const card: CardMaster = { code: 'UA01BT/CGH-1-001', titleCode: 'CGH', title: 'コードギアス 反逆のルルーシュ', name: '扇 要', cardType: 'CHARACTER', color: 'PURPLE', bp: 2500, apCost: 1, reqEnergy: 2, genEnergy: 1, traits: [], triggers: [], effectText: '' };
vi.mock('../../data/cardDatabase', async (original) => ({ ...await original<typeof import('../../data/cardDatabase')>(), ensureCardCodes: vi.fn() }));
vi.mock('../../services/officialCardService', async (original) => ({ ...await original<typeof import('../../services/officialCardService')>(), fetchSeriesCardsViaProxy: vi.fn(), parseCardFromDetailHtml: vi.fn(() => card) }));
beforeEach(() => { vi.mocked(parseCardFromDetailHtml).mockReset().mockReturnValue(card); vi.mocked(ensureCardCodes).mockReset().mockResolvedValue(); vi.mocked(fetchSeriesCardsViaProxy).mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const setup = () => {
  const props = { isOpen: true, onClose: vi.fn(), cardPool: [], onAddCardsToPool: vi.fn(), onLoadDeckItems: vi.fn() };
  return { props, ...render(<OfficialImportModal {...props} />) };
};
const pasteHtml = () => {
  fireEvent.click(screen.getByRole('button', { name: 'HTML貼付' }));
  fireEvent.change(screen.getByPlaceholderText('UA01BT/CGH-1-001'), { target: { value: card.code } });
  fireEvent.change(screen.getByPlaceholderText('<div class="cardDetailCol">...'), { target: { value: '<div>fixture</div>' } });
  fireEvent.click(screen.getByRole('button', { name: 'HTMLをパースしてカードプールに追加' }));
};
it('prepares official HTML card data before reporting success or publishing it', async () => {
  let done!: () => void;
  vi.mocked(ensureCardCodes).mockImplementationOnce(() => new Promise<void>((resolve) => { done = resolve; }));
  const { props } = setup(); pasteHtml();
  await waitFor(() => expect(ensureCardCodes).toHaveBeenCalledWith([card.code]));
  expect(props.onAddCardsToPool).not.toHaveBeenCalled();
  expect(screen.queryByText(/追加しました！/)).toBeNull();
  await act(async () => { done(); });
  expect(props.onAddCardsToPool).toHaveBeenCalledWith([card]);
  expect(screen.getByText(/同梱の公式データを使用/)).toBeTruthy();
});
it('keeps pasted HTML on failure and allows retry', async () => {
  vi.mocked(ensureCardCodes).mockRejectedValueOnce(new Error('offline'));
  const { props } = setup(); pasteHtml();
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('offline'));
  expect(props.onAddCardsToPool).not.toHaveBeenCalled();
  expect((screen.getByPlaceholderText('<div class="cardDetailCol">...') as HTMLTextAreaElement).value).toBe('<div>fixture</div>');
  fireEvent.click(screen.getByRole('button', { name: 'HTMLをパースしてカードプールに追加' }));
  await waitFor(() => expect(props.onAddCardsToPool).toHaveBeenCalledTimes(1));
});
for (const leave of ['close', 'tab'] as const) {
  it(`ignores a late series result after ${leave}, even after reopening`, async () => {
    let done!: (cards: CardMaster[]) => void;
    vi.mocked(fetchSeriesCardsViaProxy).mockImplementationOnce(() => new Promise((resolve) => { done = resolve; }));
    const { props, rerender } = setup();
    fireEvent.click(screen.getByRole('button', { name: '公式シリーズ取得' }));
    fireEvent.click(screen.getByRole('button', { name: /このシリーズのカードを取得してプールに追加/ }));
    await waitFor(() => expect(fetchSeriesCardsViaProxy).toHaveBeenCalledTimes(1));
    if (leave === 'close') { rerender(<OfficialImportModal {...props} isOpen={false} />); rerender(<OfficialImportModal {...props} />); }
    else { fireEvent.click(screen.getByRole('button', { name: 'HTML貼付' })); fireEvent.click(screen.getByRole('button', { name: '公式シリーズ取得' })); }
    await act(async () => { done([card]); });
    expect(props.onAddCardsToPool).not.toHaveBeenCalled();
    expect(screen.queryByText(/同梱の公式データを使用:|取得データを追加:/)).toBeNull();
  });
}
it('ignores an HTML completion after the dialog closes', async () => {
  let done!: () => void;
  vi.mocked(ensureCardCodes).mockImplementationOnce(() => new Promise<void>((resolve) => { done = resolve; }));
  const { props, rerender } = setup(); pasteHtml();
  await waitFor(() => expect(ensureCardCodes).toHaveBeenCalled());
  rerender(<OfficialImportModal {...props} isOpen={false} />);
  await act(async () => { done(); });
  expect(props.onAddCardsToPool).not.toHaveBeenCalled();
});
it('publishes series cards only after official preparation and retries a failed preparation', async () => {
  vi.mocked(fetchSeriesCardsViaProxy).mockResolvedValue([card]);
  vi.mocked(ensureCardCodes).mockRejectedValueOnce(new Error('offline'));
  const { props } = setup();
  fireEvent.click(screen.getByRole('button', { name: '公式シリーズ取得' }));
  fireEvent.click(screen.getByRole('button', { name: /このシリーズのカードを取得してプールに追加/ }));
  await waitFor(() => expect(screen.getByText('取得エラー: offline')).toBeTruthy());
  expect(props.onAddCardsToPool).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /このシリーズのカードを取得してプールに追加/ }));
  await waitFor(() => expect(props.onAddCardsToPool).toHaveBeenCalledWith([card]));
});
it('ignores a series completion when closed during official preparation', async () => {
  vi.mocked(fetchSeriesCardsViaProxy).mockResolvedValue([card]);
  let done!: () => void;
  vi.mocked(ensureCardCodes).mockImplementationOnce(() => new Promise<void>((resolve) => { done = resolve; }));
  const { props, rerender } = setup();
  fireEvent.click(screen.getByRole('button', { name: '公式シリーズ取得' }));
  fireEvent.click(screen.getByRole('button', { name: /このシリーズのカードを取得してプールに追加/ }));
  await waitFor(() => expect(ensureCardCodes).toHaveBeenCalled());
  rerender(<OfficialImportModal {...props} isOpen={false} />);
  await act(async () => { done(); });
  expect(props.onAddCardsToPool).not.toHaveBeenCalled();
});

it('reports the bundled card name when official HTML content is not used', async () => {
  vi.mocked(parseCardFromDetailHtml).mockReturnValueOnce({ ...card, name: 'HTML更新版', effectText: '更新効果' });
  setup(); pasteHtml();
  await waitFor(() => expect(screen.getByText(/同梱の公式データを使用/)).toBeTruthy());
  expect(screen.queryByText(/パースして追加しました/)).toBeNull();
  expect(screen.getByText(new RegExp(getCardMaster(card.code)!.name))).toBeTruthy();
  expect(screen.queryByText(/HTML更新版/)).toBeNull();
});
it('reports bundled and custom series cards separately', async () => {
  vi.mocked(fetchSeriesCardsViaProxy).mockResolvedValue([card, { ...card, code: 'CUSTOM/NEW-1-001' }]);
  const { props } = setup();
  fireEvent.click(screen.getByRole('button', { name: '公式シリーズ取得' }));
  fireEvent.click(screen.getByRole('button', { name: /このシリーズのカードを取得してプールに追加/ }));
  await waitFor(() => expect(props.onAddCardsToPool).toHaveBeenCalled());
  expect(screen.getByText(/同梱の公式データを使用: 1枚/)).toBeTruthy();
  expect(screen.getByText(/取得データを追加: 1枚/)).toBeTruthy();
});

describe('OfficialImportModal', () => {
  const mockCardPool = [
    {
      code: 'UA08BT/BLC-2-016',
      baseCode: 'UA08BT/BLC-2-016',
      name: '黒崎 一護',
      title: 'BLEACH',
      titleCode: 'BLC',
      cardType: 'CHARACTER' as const,
      color: 'BLUE' as const,
      bp: 1500,
      apCost: 1,
      reqEnergy: 0,
      genEnergy: 1,
      traits: [],
      triggers: [],
      effectText: '',
    },
  ];

  it('renders BANDAI TCG+ tab by default', () => {
    render(
      <OfficialImportModal
        isOpen={true}
        onClose={vi.fn()}
        cardPool={mockCardPool}
        onAddCardsToPool={vi.fn()}
        onLoadDeckItems={vi.fn()}
      />
    );

    expect(screen.getByText(/BANDAI TCG\+ レシピ/i)).toBeTruthy();
    expect(
      screen.getByPlaceholderText(/https:\/\/www\.bandai-tcg-plus\.com\/deck_code_recipe\//i)
    ).toBeTruthy();
  });

  it('fetches recipe and allows creating deck', async () => {
    const onLoadDeckItems = vi.fn();
    const onClose = vi.fn();

    vi.spyOn(bandaiService, 'fetchBandaiDeckRecipe').mockResolvedValueOnce({
      deckCode: 'lFv8V8TK9AD3EvVn',
      gameTitleId: 9,
      mainDeck: [
        {
          id: 1,
          code: 'HnW',
          card_number: 'BLC-2-016',
          card_name: '黒崎 一護',
          card_count: 4,
          image_url: 'https://example.com/ichigo.png',
          cost: '0',
          color: '青',
          type: 'キャラクター',
        },
      ],
    });

    render(
      <OfficialImportModal
        isOpen={true}
        onClose={onClose}
        cardPool={mockCardPool}
        onAddCardsToPool={vi.fn()}
        onLoadDeckItems={onLoadDeckItems}
      />
    );

    const input = screen.getByPlaceholderText(
      /https:\/\/www\.bandai-tcg-plus\.com\/deck_code_recipe\//i
    );
    fireEvent.change(input, {
      target: { value: 'https://www.bandai-tcg-plus.com/deck_code_recipe/lFv8V8TK9AD3EvVn' },
    });

    const fetchButton = screen.getByRole('button', { name: /レシピを取得/i });
    fireEvent.click(fetchButton);

    await waitFor(() => {
      expect(screen.getByText(/レシピ取得成功/i)).toBeTruthy();
    });

    const createButton = screen.getByRole('button', { name: /このデッキを作成/i });
    fireEvent.click(createButton);

    expect(onLoadDeckItems).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          count: 4,
          card: expect.objectContaining({
            name: '黒崎 一護',
          }),
        }),
      ]),
      expect.stringContaining('TCG+ デッキ'),
      'BLC'
    );
    expect(onClose).toHaveBeenCalled();
  });
});

it('still publishes new custom HTML cards and reports their addition', async () => {
  const custom = { ...card, code: 'CUSTOM/NEW-1-001', name: '新規カード' };
  vi.mocked(parseCardFromDetailHtml).mockReturnValueOnce(custom);
  const { props } = setup(); pasteHtml();
  await waitFor(() => expect(props.onAddCardsToPool).toHaveBeenCalledWith([custom]));
  expect(screen.getByText(/新規カード.*パースして追加しました/)).toBeTruthy();
  expect(screen.queryByText(/同梱の公式データを使用/)).toBeNull();
});

it('does not reuse a legacy synthesized card as an official TCG+ match', async () => {
  const legacy = { ...card, code: 'UAPR/NEW-1-999', name: '旧補完カード', bp: null };
  vi.spyOn(bandaiService, 'fetchBandaiDeckRecipe').mockResolvedValueOnce({ deckCode: 'fixture123', gameTitleId: 1, mainDeck: [{ id: 1, code: 'fixture', card_number: legacy.code, card_name: legacy.name, card_count: 1, image_url: '', cost: '0', color: '紫', type: 'キャラクター' }] });
  const props = { isOpen: true, cardPool: [legacy], onClose: vi.fn(), onLoadDeckItems: vi.fn(), onAddCardsToPool: vi.fn() };
  render(<OfficialImportModal {...props} />);
  fireEvent.change(screen.getByPlaceholderText(/https:\/\/www\.bandai-tcg-plus/), { target: { value: 'fixture123' } });
  fireEvent.click(screen.getByRole('button', { name: 'レシピを取得' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(legacy.code));
  expect(screen.queryByRole('button', { name: 'このデッキを作成' })).toBeNull();
  expect(props.onLoadDeckItems).not.toHaveBeenCalled();
});
it('blocks an unknown TCG+ card without creating a partial deck and allows retry', async () => {
  const raw = { id: 1, code: 'fixture', card_number: 'UAPR/NEW-1-999', card_name: '未収録', card_count: 1, image_url: '', cost: '0', color: '紫', type: 'キャラクター' };
  vi.spyOn(bandaiService, 'fetchBandaiDeckRecipe').mockResolvedValueOnce({ deckCode: 'fixture123', gameTitleId: 1, mainDeck: [raw] }).mockResolvedValueOnce({ deckCode: 'fixture123', gameTitleId: 1, mainDeck: [{ ...raw, card_number: card.code }] });
  const { props } = setup();
  fireEvent.change(screen.getByPlaceholderText(/https:\/\/www\.bandai-tcg-plus/), { target: { value: 'fixture123' } });
  fireEvent.click(screen.getByRole('button', { name: 'レシピを取得' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('UAPR/NEW-1-999'));
  expect(screen.queryByRole('button', { name: 'このデッキを作成' })).toBeNull();
  expect(props.onAddCardsToPool).not.toHaveBeenCalled();
  expect(props.onLoadDeckItems).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'レシピを取得' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'このデッキを作成' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'このデッキを作成' }));
  expect(props.onLoadDeckItems).toHaveBeenCalledTimes(1);
});
