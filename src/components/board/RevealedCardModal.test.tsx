// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Card } from '../../types/card';
import { RevealedCardModal } from './RevealedCardModal';

const dummyCard: Card = {
  id: 'c-1',
  code: 'UA01BT/CGH-1-001',
  name: 'ルルーシュ・ランペルージ',
  cardType: 'CHARACTER',
  color: 'PURPLE',
  bp: 3000,
  apCost: 1,
  reqEnergy: 2,
  genEnergy: 1,
  traits: ['アッシュフォード学園'],
  triggers: ['DRAW'],
  effectText: '【登場時】カードを1枚引く。',
  isRested: false,
  bpModifier: 0,
  underCards: [],
};

describe('RevealedCardModal', () => {
  it('shows the printed generated energy plus mark in card details', () => {
    render(
      <RevealedCardModal
        revealed={null}
        inspectCard={{ ...dummyCard, hasGenEnergyPlus: true }}
        onDismissRevealed={vi.fn()}
      />
    );

    expect(screen.getByText('1+')).toBeTruthy();
  });
  it('renders trigger resolution buttons when revealed card is a trigger (isTrigger: true)', () => {
    const onDismissRevealed = vi.fn();
    render(
      <RevealedCardModal
        revealed={{
          card: dummyCard,
          source: 'ライフ1枚目（トリガーチェック）',
          fromPlayerId: 'p1',
          isTrigger: true,
        }}
        inspectCard={null}
        onDismissRevealed={onDismissRevealed}
      />
    );

    expect(screen.getByText(/ライフ1枚目（トリガーチェック）/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /場外へ送る \(基本\)/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /手札に加える/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /ライフに戻す/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /場外へ送る \(基本\)/ }));
    expect(onDismissRevealed).toHaveBeenCalledWith('graveyard');
  });

  it('hides trigger resolution buttons and shows waiting state and cancel button when canControl is false', () => {
    const onDismissRevealed = vi.fn();
    render(
      <RevealedCardModal
        revealed={{
          card: dummyCard,
          source: 'ライフ1枚目（トリガーチェック）',
          fromPlayerId: 'p2',
          isTrigger: true,
        }}
        inspectCard={null}
        canControl={false}
        onDismissRevealed={onDismissRevealed}
      />
    );

    expect(screen.getByText(/ライフ1枚目（トリガーチェック）/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /場外へ送る \(基本\)/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /手札に加える/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '閉じる' })).toBeNull();
    expect(screen.getByText(/相手プレイヤーがトリガー効果を処理中です/)).toBeTruthy();

    const cancelBtn = screen.getByRole('button', { name: /取り消してライフに戻す/ });
    fireEvent.click(cancelBtn);
    expect(onDismissRevealed).toHaveBeenCalledWith('life');
  });

  it('renders close button only without trigger buttons when revealed card is non-trigger (isTrigger: false, e.g. bottom deck reveal)', () => {
    const onDismissRevealed = vi.fn();
    render(
      <RevealedCardModal
        revealed={{
          card: dummyCard,
          source: '山札の下（公開・確認）',
          fromPlayerId: 'p1',
          isTrigger: false,
        }}
        inspectCard={null}
        onDismissRevealed={onDismissRevealed}
      />
    );

    expect(screen.getByText(/山札の下（公開・確認）/)).toBeTruthy();
    // トリガー解決ボタンが表示されないこと
    expect(screen.queryByRole('button', { name: /場外へ送る \(基本\)/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /手札に加える/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /ライフに戻す/ })).toBeNull();

    // 閉じるボタンが存在すること
    const closeBtns = screen.getAllByRole('button', { name: /閉じる \(Esc\)/ });
    expect(closeBtns.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(closeBtns[0]);
    expect(onDismissRevealed).toHaveBeenCalledWith('cancel');
  });

  it('renders card info detail and close button when inspectCard is provided', () => {
    const onCloseInspect = vi.fn();
    render(
      <RevealedCardModal
        revealed={null}
        inspectCard={dummyCard}
        onCloseInspect={onCloseInspect}
      />
    );

    expect(screen.getByRole('dialog', { name: 'カード情報詳細' })).toBeTruthy();
    expect(screen.getByText('カード情報詳細')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /場外へ送る \(基本\)/ })).toBeNull();

    const closeBtns = screen.getAllByRole('button', { name: /閉じる \(Esc\)/ });
    expect(closeBtns.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(closeBtns[0]);
    expect(onCloseInspect).toHaveBeenCalledTimes(1);
  });

  it('renders with z-[60] to overlay above standard z-50 modals', () => {
    const { container } = render(
      <RevealedCardModal
        revealed={null}
        inspectCard={dummyCard}
        onCloseInspect={vi.fn()}
      />
    );

    const backdrop = container.querySelector('.fixed.inset-0');
    expect(backdrop?.className).toContain('z-[60]');
  });

  it('closes inspect modal when Escape key is pressed', () => {
    const onCloseInspect = vi.fn();
    render(
      <RevealedCardModal
        revealed={null}
        inspectCard={dummyCard}
        onCloseInspect={onCloseInspect}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseInspect).toHaveBeenCalledTimes(1);
  });
});
