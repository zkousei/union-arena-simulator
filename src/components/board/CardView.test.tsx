// @vitest-environment jsdom

import { render, screen, fireEvent, within } from '@testing-library/react';
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
  it('shows base generated energy without an effect-increase plus sign', () => {
    render(<CardView card={{ ...dummyCard, genEnergy: 1 }} />);

    expect(screen.getByTitle('発生エナジー: 1').textContent).toBe('1');
  });
  it('does not offer inspection for an opponent face-down card', () => {
    const handleInspect = vi.fn();

    render(
      <CardView
        card={{ ...dummyCard, isFaceDown: true }}
        isOpponent={true}
        revealFaceDown={true}
        onInspect={handleInspect}
      />
    );

    expect(screen.queryByTitle('自分のみ表面を確認')).toBeNull();
    expect(screen.queryByText('裏向きカードを見る (デバッグ)')).toBeNull();
    expect(screen.queryByText(dummyCard.name)).toBeNull();
  });

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

  it('supports modifying BP in 500 and 1000 increments, and resetting modifier from context menu', () => {
    const handleModifyBp = vi.fn();
    const { container } = render(
      <CardView
        card={{ ...dummyCard, bpModifier: 500 }}
        location={{ playerId: 'player-1', zone: 'frontLine', slotIndex: 0 }}
        onModifyBp={handleModifyBp}
      />
    );

    const cardEl = container.querySelector('[draggable="true"]')!;
    fireEvent.contextMenu(cardEl);

    // Verify buttons are present
    const plus500 = screen.getByRole('button', { name: '+500' });
    const minus500 = screen.getByRole('button', { name: '-500' });
    const plus1000 = screen.getByRole('button', { name: '+1000' });
    const minus1000 = screen.getByRole('button', { name: '-1000' });
    const resetBtn = screen.getByRole('button', { name: /修正リセット/ });

    fireEvent.click(plus500);
    expect(handleModifyBp).toHaveBeenCalledWith(500);

    fireEvent.click(minus500);
    expect(handleModifyBp).toHaveBeenCalledWith(-500);

    fireEvent.click(plus1000);
    expect(handleModifyBp).toHaveBeenCalledWith(1000);

    fireEvent.click(minus1000);
    expect(handleModifyBp).toHaveBeenCalledWith(-1000);

    fireEvent.click(resetBtn);
    expect(handleModifyBp).toHaveBeenCalledWith(-500);
  });

  it('ensures context menu is constrained to viewport and can be closed via close button', () => {
    const { container } = render(
      <CardView
        card={dummyCard}
        location={{ playerId: 'player-1', zone: 'frontLine', slotIndex: 0 }}
      />
    );

    const cardEl = container.querySelector('[draggable="true"]')!;
    fireEvent.contextMenu(cardEl);

    // Menu should be constrained with overflow scroll
    const menuEl = container.querySelector('.overflow-y-auto');
    expect(menuEl).not.toBeNull();

    // Close button should close the menu
    const closeBtn = screen.getByTitle('閉じる');
    fireEvent.click(closeBtn);
    expect(container.querySelector('.overflow-y-auto')).toBeNull();
  });

  it('renders a single consolidated inspect button in context menu and opens inspect modal on click', () => {
    const handleInspect = vi.fn();
    const { container } = render(
      <CardView
        card={dummyCard}
        location={{ playerId: 'player-1', zone: 'frontLine', slotIndex: 0 }}
        onInspect={handleInspect}
      />
    );

    const cardEl = container.querySelector('[draggable="true"]')!;
    fireEvent.contextMenu(cardEl);

    const menuEl = container.querySelector('.overflow-y-auto')!;
    expect(menuEl).not.toBeNull();

    // There should be exactly one inspect button in the context menu (not duplicated)
    const inspectBtns = within(menuEl as HTMLElement).getAllByRole('button', { name: /詳細|効果/ });
    expect(inspectBtns).toHaveLength(1);
    expect(inspectBtns[0].textContent).toContain('カード詳細・効果を見る');

    fireEvent.click(inspectBtns[0]);
    expect(handleInspect).toHaveBeenCalledWith(dummyCard);
  });

  it('renders raid badge in mid-left position avoiding overlap with quick action buttons', () => {
    const handleOpenUnderCards = vi.fn();
    const handleDirectAttack = vi.fn();

    const raidCard = {
      ...dummyCard,
      triggers: ['RAID' as const],
      underCards: [{ ...dummyCard, id: 'base-card-1' }],
    };

    render(
      <CardView
        card={raidCard}
        location={{ playerId: 'player-1', zone: 'frontLine', slotIndex: 0 }}
        isOpponent={false}
        onDirectAttack={handleDirectAttack}
        onOpenUnderCards={handleOpenUnderCards}
      />
    );

    const raidBadge = screen.getByTitle('クリックで下敷きカード（レイド元）を確認・操作');
    expect(raidBadge).toBeTruthy();
    expect(raidBadge.className).toContain('top-7');
    expect(raidBadge.className).not.toContain('-top-1.5');

    // レイドバッジとアタックボタンがそれぞれ独立してクリック可能
    const attackBtn = screen.getByTitle('アタック（1クリックで相手プレイヤーへ攻撃宣言）');
    expect(attackBtn).toBeTruthy();

    fireEvent.click(raidBadge);
    expect(handleOpenUnderCards).toHaveBeenCalledTimes(1);
    expect(handleDirectAttack).not.toHaveBeenCalled();

    fireEvent.click(attackBtn);
    expect(handleDirectAttack).toHaveBeenCalledTimes(1);
  });

  it('renders MARK badge (amber) instead of RAID badge when card only has markers (even if card has RAID trigger)', () => {
    const handleOpenUnderCards = vi.fn();

    // 素出しされたレイドカードにマーカーが置かれた状況
    const cardWithMarkerOnly = {
      ...dummyCard,
      triggers: ['RAID' as const],
      underCards: [{ ...dummyCard, id: 'marker-1', isMarker: true }],
    };

    render(
      <CardView
        card={cardWithMarkerOnly}
        location={{ playerId: 'player-1', zone: 'frontLine', slotIndex: 0 }}
        isOpponent={false}
        onOpenUnderCards={handleOpenUnderCards}
      />
    );

    const markBadge = screen.getByTitle('クリックで下敷きカード（マーカー）を確認・操作');
    expect(markBadge).toBeTruthy();
    expect(markBadge.textContent).toContain('MARK');
    expect(markBadge.textContent).not.toContain('RAID');
    expect(markBadge.className).toContain('bg-amber-600');
    expect(markBadge.className).not.toContain('bg-purple-600');
  });

  it('renders both RAID and MARK info when card has both raid base and marker', () => {
    const handleOpenUnderCards = vi.fn();

    const cardWithBoth = {
      ...dummyCard,
      triggers: ['RAID' as const],
      underCards: [
        { ...dummyCard, id: 'base-1', isMarker: false },
        { ...dummyCard, id: 'marker-1', isMarker: true },
      ],
    };

    render(
      <CardView
        card={cardWithBoth}
        location={{ playerId: 'player-1', zone: 'frontLine', slotIndex: 0 }}
        isOpponent={false}
        onOpenUnderCards={handleOpenUnderCards}
      />
    );

    const badge = screen.getByTitle('クリックで下敷きカード（レイド元・マーカー）を確認・操作');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('RAID');
    expect(badge.textContent).toContain('1');
    expect(badge.textContent).toContain('MARK');
  });

  it('does not render REST badge when card is rested (rotation is the only visual indicator)', () => {
    const restedCard = {
      ...dummyCard,
      isRested: true,
      rarity: 'R' as const,
    };

    render(
      <CardView
        card={restedCard}
        location={{ playerId: 'player-1', zone: 'frontLine', slotIndex: 0 }}
        isOpponent={false}
      />
    );

    // RESTバッジは存在しない（横向き回転で視覚的にレストと分かる）
    expect(screen.queryByText('REST')).toBeNull();
  });
});
