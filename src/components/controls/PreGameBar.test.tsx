// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createInitialPlayerState } from '../../domain/initialState';
import { Card } from '../../types/card';
import { PreGameBar } from './PreGameBar';

const card: Card = {
  id: 'test-card',
  code: 'TEST-001',
  name: 'Test Card',
  cardType: 'CHARACTER',
  color: 'BLUE',
  bp: 1000,
  apCost: 1,
  reqEnergy: 1,
  genEnergy: 1,
  traits: [],
  triggers: [],
  effectText: '',
  isRested: false,
  bpModifier: 0,
  underCards: [],
};

const callbacks = {
  onSetFirstPlayer: vi.fn(),
  onOpenDeckPicker: vi.fn(),
  onMulligan: vi.fn(),
  onKeepHand: vi.fn(),
  onPlaceLife: vi.fn(),
  onToggleReady: vi.fn(),
  onStartGame: vi.fn(),
  onRollDice: vi.fn(),
};

describe('PreGameBar', () => {
  it.each([
    ['solo', true],
    ['P2P', false],
  ])('disables game start in %s mode when only one player has set a deck', (_mode, isSoloMode) => {
    const player1 = createInitialPlayerState('player-1', 'Player 1', true);
    const player2 = createInitialPlayerState('player-2', 'Player 2', false);
    player1.hand = [card];
    player1.isReady = true;
    player2.isReady = true;

    render(
      <PreGameBar
        myPlayer={player1}
        opponentPlayer={player2}
        firstPlayerId="player-1"
        isSoloMode={isSoloMode}
        {...callbacks}
      />
    );

    expect(screen.getByRole('button', { name: /対戦開始/ }).hasAttribute('disabled')).toBe(true);
  });

  it.each([
    ['solo', true],
    ['P2P', false],
  ])('enables game start in %s mode after both players complete setup', (_mode, isSoloMode) => {
    const player1 = createInitialPlayerState('player-1', 'Player 1', true);
    const player2 = createInitialPlayerState('player-2', 'Player 2', false);
    for (const player of [player1, player2]) {
      player.hand = [{ ...card, id: `${player.id}-hand` }];
      player.life = [{ ...card, id: `${player.id}-life`, isFaceDown: true }];
      player.isHandKept = true;
      player.isReady = true;
    }

    render(
      <PreGameBar
        myPlayer={player1}
        opponentPlayer={player2}
        firstPlayerId="player-1"
        isSoloMode={isSoloMode}
        {...callbacks}
      />
    );

    expect(screen.getByRole('button', { name: /対戦開始/ }).hasAttribute('disabled')).toBe(false);
  });
});
