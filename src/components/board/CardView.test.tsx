// @vitest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Card } from '../../types/card';
import { CardView } from './CardView';

const dummyCard: Card = {
  id: 'card-1',
  code: 'UA01BT/CGH-1-001',
  name: 'ルルーシュ・ランペルージ',
  cardType: 'CHARACTER',
  color: 'PURPLE',
  bp: 3000,
  apCost: 1,
  reqEnergy: 2,
  genEnergy: 1,
  traits: ['ギアス', '黒の騎士団'],
  triggers: ['DRAW'],
  effectText: 'テスト効果テキスト',
  isRested: false,
  bpModifier: 0,
  underCards: [],
};

describe('CardView', () => {
  it('renders active card with card-active class', () => {
    const { container } = render(
      <CardView card={{ ...dummyCard, isRested: false }} />
    );

    const cardStack = container.querySelector('.card-active');
    expect(cardStack).not.toBeNull();
    expect(screen.getByText('ルルーシュ・ランペルージ')).toBeDefined();
  });

  it('renders rested card with card-rested class in standard mode', () => {
    const { container } = render(
      <CardView card={{ ...dummyCard, isRested: true }} isCompact={false} />
    );

    const cardStack = container.querySelector('.card-rested');
    expect(cardStack).not.toBeNull();
    expect(container.querySelector('.card-active')).toBeNull();
  });

  it('renders rested card with card-rested-compact class in compact mode', () => {
    const { container } = render(
      <CardView card={{ ...dummyCard, isRested: true }} isCompact={true} />
    );

    const cardStack = container.querySelector('.card-rested-compact');
    expect(cardStack).not.toBeNull();
    expect(container.querySelector('.card-active')).toBeNull();
  });

  it('calls onToggleRest when rest option in context menu is clicked', () => {
    const handleToggleRest = vi.fn();
    const { container } = render(
      <CardView
        card={dummyCard}
        location={{ playerId: 'player-1', zone: 'frontLine', slotIndex: 0 }}
        onToggleRest={handleToggleRest}
      />
    );

    // 右クリックでコンテキストメニューを開く
    const cardEl = container.querySelector('[draggable="true"]')!;
    fireEvent.contextMenu(cardEl);

    const restBtn = screen.getByText('レストにする');
    fireEvent.click(restBtn);
    expect(handleToggleRest).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleRest when double-clicked if onToggleRest is provided', () => {
    const handleToggleRest = vi.fn();
    const handleInspect = vi.fn();
    const { container } = render(
      <CardView
        card={dummyCard}
        location={{ playerId: 'player-1', zone: 'frontLine', slotIndex: 0 }}
        onToggleRest={handleToggleRest}
        onInspect={handleInspect}
      />
    );

    const cardEl = container.querySelector('[draggable="true"]')!;
    fireEvent.doubleClick(cardEl);
    expect(handleToggleRest).toHaveBeenCalledTimes(1);
    expect(handleInspect).not.toHaveBeenCalled();
  });

  it('calls onToggleRest when rotate icon button is clicked', () => {
    const handleToggleRest = vi.fn();
    render(
      <CardView
        card={dummyCard}
        location={{ playerId: 'player-1', zone: 'frontLine', slotIndex: 0 }}
        onToggleRest={handleToggleRest}
      />
    );

    const rotateBtn = screen.getByTitle('レストにする (ダブルクリックでも切替可)');
    fireEvent.click(rotateBtn);
    expect(handleToggleRest).toHaveBeenCalledTimes(1);
  });

  it('calls onInspect when double-clicked if onToggleRest is not provided, or when zoom button clicked', () => {
    const handleInspect = vi.fn();
    const { container } = render(
      <CardView
        card={dummyCard}
        location={{ playerId: 'player-1', zone: 'hand', index: 0 }}
        onInspect={handleInspect}
      />
    );

    const cardEl = container.querySelector('[draggable="true"]')!;
    fireEvent.doubleClick(cardEl);
    expect(handleInspect).toHaveBeenCalledTimes(1);

    const zoomBtn = screen.getByTitle('カード詳細を確認 (拡大表示)');
    fireEvent.click(zoomBtn);
    expect(handleInspect).toHaveBeenCalledTimes(2);
  });

  it('calls onHoverCard on mouse enter and leave', () => {
    const handleHoverCard = vi.fn();
    const { container } = render(
      <CardView
        card={dummyCard}
        location={{ playerId: 'player-1', zone: 'frontLine', slotIndex: 0 }}
        onHoverCard={handleHoverCard}
      />
    );

    const cardStack = container.querySelector('.card-active')!;
    fireEvent.mouseEnter(cardStack);
    expect(handleHoverCard).toHaveBeenCalledWith(dummyCard);

    fireEvent.mouseLeave(cardStack);
    expect(handleHoverCard).toHaveBeenCalledWith(null);
  });

  it('renders + symbol next to BP when card has hasBpPlus', () => {
    render(<CardView card={{ ...dummyCard, bp: 4000, hasBpPlus: true }} />);
    expect(screen.getByText('4000+')).toBeTruthy();
  });

  it('hydrates and renders BP from CARD_DATABASE when card.bp is null', () => {
    // UA01BT/CGH-1-001 has BP 2500 in official cards
    render(<CardView card={{ ...dummyCard, bp: null }} />);
    expect(screen.getByText('2500')).toBeTruthy();
  });

  it('calls onDirectAttack when quick attack sword button is clicked', () => {
    const handleDirectAttack = vi.fn();
    render(
      <CardView
        card={{ ...dummyCard, isRested: false }}
        location={{ playerId: 'player-1', zone: 'frontLine', slotIndex: 0 }}
        isOpponent={false}
        onDirectAttack={handleDirectAttack}
      />
    );

    const attackBtn = screen.getByTitle('アタック（1クリックで相手プレイヤーへ攻撃宣言）');
    fireEvent.click(attackBtn);
    expect(handleDirectAttack).toHaveBeenCalledTimes(1);
  });

  it('exposes a custom accessible name and supports keyboard selection', () => {
    const handleClick = vi.fn();
    render(
      <CardView
        card={dummyCard}
        accessibleLabel="手札カード: ルルーシュ・ランペルージ (キャラクター)"
        onClick={handleClick}
      />
    );

    const cardButton = screen.getByRole('button', {
      name: '手札カード: ルルーシュ・ランペルージ (キャラクター)',
    });
    fireEvent.keyDown(cardButton, { key: 'Enter' });
    fireEvent.keyDown(cardButton, { key: ' ' });

    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});
