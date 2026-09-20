import { Card } from './card';

export type Phase = 'START' | 'MOVE' | 'MAIN' | 'ATTACK' | 'END';

export type GameStatus = 'PREPARING' | 'PLAYING' | 'FINISHED';

export type FieldSlotIndex = 0 | 1 | 2 | 3;

export type ZoneType =
  | 'deck'
  | 'hand'
  | 'frontLine'
  | 'energyLine'
  | 'life'
  | 'graveyard'
  | 'removed'
  | 'apArea';

export interface CardLocation {
  playerId: string;
  zone: ZoneType;
  slotIndex?: number; // frontLine または energyLine の場合 0..3
  index?: number;     // hand, deck, life, graveyard などの配列インデックス
}

export interface PlayerState {
  id: string;
  name: string;
  isFirst: boolean;            // 先攻フラグ
  isReady: boolean;            // 準備完了フラグ
  hasMulliganed: boolean;      // マリガン実行済みフラグ
  isHandKept?: boolean;        // 手札キープ決定済みフラグ
  hasExtraDrawn: boolean;      // スタートフェイズのエクストラドロー実行済みフラグ
  deck: Card[];
  hand: Card[];
  frontLine: (Card | null)[];  // 最大4枠 (スロット0〜3)
  energyLine: (Card | null)[]; // 最大4枠 (スロット0〜3)
  life: Card[];               // 初期7枚
  graveyard: Card[];          // 場外
  removed: Card[];            // 除外
  apArea: Card[];             // APカード (最大3枚)
  apCurrent: number;          // 現在使用可能なAP
  apMax: number;              // ターンに応じた最大AP (1〜3)
  revealedTopDeckCard?: Card | null; // 山札の一番上が表向きの場合のカード情報
}

export interface GameLogItem {
  id: string;
  timestamp: number;
  playerId?: string;
  playerName?: string;
  message: string;
  type: 'action' | 'phase' | 'system' | 'chat';
}

export interface GameState {
  status: GameStatus;
  turn: number;
  firstPlayerId: string | null;
  activePlayerId: string;
  phase: Phase;
  players: {
    [playerId: string]: PlayerState;
  };
  revealedCard: {
    card: Card;
    source: string;
    fromPlayerId: string;
  } | null;
  revealedDeckCards: {
    playerId: string;
    cards: Card[];
  } | null;
  logs: GameLogItem[];
}
