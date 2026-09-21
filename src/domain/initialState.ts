import { GameState, PlayerState } from '../types/game';

export function createInitialPlayerState(
  id: string,
  name: string,
  isFirst: boolean = false
): PlayerState {
  return {
    id,
    name,
    isFirst,
    isReady: false,
    hasMulliganed: false,
    isHandKept: false,
    hasExtraDrawn: false,
    deck: [],
    hand: [],
    frontLine: [null, null, null, null],
    energyLine: [null, null, null, null],
    life: [],
    graveyard: [],
    removed: [],
    apArea: [],
    apCurrent: 1,
    apMax: 1,
  };
}

export function createInitialGameState(
  player1Id: string = 'player-1',
  player1Name: string = 'Player 1',
  player2Id: string = 'player-2',
  player2Name: string = 'Player 2',
  activePlayerId: string = 'player-1'
): GameState {
  return {
    status: 'PREPARING',
    turn: 1,
    firstPlayerId: player1Id,
    activePlayerId,
    phase: 'START',
    players: {
      [player1Id]: createInitialPlayerState(player1Id, player1Name, true),
      [player2Id]: createInitialPlayerState(player2Id, player2Name, false),
    },
    revealedCard: null,
    revealedDeckCards: null,
    pendingCombat: null,
    logs: [
      {
        id: 'log-init',
        timestamp: Date.now(),
        message: 'ゲーム準備を開始しました。デッキをセットアップし、先攻・後攻を決定してください。',
        type: 'system',
      },
    ],
  };
}
