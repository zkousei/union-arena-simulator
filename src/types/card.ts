export type CardType = 'CHARACTER' | 'EVENT' | 'FIELD' | 'ACTION_POINT';

export type CardColor = 'YELLOW' | 'GREEN' | 'RED' | 'BLUE' | 'PURPLE' | 'COLORLESS';

export type TriggerType =
  | 'DRAW'
  | 'ACTIVE'
  | 'RAID'
  | 'GET'
  | 'BOUNCE'
  | 'COLOR'
  | 'SPECIAL'
  | 'FINAL';

export interface Card {
  id: string;             // 一意のインスタンスID
  code: string;           // カード番号 (例: UA01BT/XXX)
  name: string;           // カード名
  cardType: CardType;     // キャラ / イベント / フィールド / AP
  color: CardColor;       // 色
  bp: number | null;      // バトルポイント (キャラのみ)
  hasBpPlus?: boolean;    // BPに「+」表記があるカード（例: 4000+）
  apCost: number;         // APコスト (通常1)
  reqEnergy: number;      // 必要エナジー
  genEnergy: number;      // 発生エナジー (通常1〜2)
  traits: string[];       // 特徴 (例: ["黒の騎士団", "生徒会"])
  triggers: TriggerType[];// トリガーアイコン
  effectText: string;     // カードテキスト
  imageUrl?: string;      // 画像URL (未設定時はダミー描画)

  // レアリティ・メタデータ
  rarity?: string;        // レアリティ (C, U, R, SR, ★, ★★, ★★★, AP, PR, UR, SP等)
  baseCode?: string;      // 基本カード番号 (パラレル版_p1等の接尾辞を除いた正規番号)
  isParallel?: boolean;   // パラレル版・特別アートフラグ
  isUnrevealed?: boolean; // 未公開カードフラグ (COMING SOON)
  seriesId?: string;      // 収録シリーズID
  seriesName?: string;    // 収録シリーズ名
  
  // 盤面上の動的状態
  isRested: boolean;      // レスト状態
  bpModifier: number;     // 一時的BP補正 (+1000など)
  underCards: Card[];     // レイド元などの下に重ねられたカード群
  isFaceDown?: boolean;   // 裏向き状態
  isFrozen?: boolean;     // フリーズ状態（次のターンアクティブにならない）
  isMarker?: boolean;     // 下敷きカードがマーカーであるか（false/undefinedはレイド元）
}

/**
 * カード番号からパラレル接尾辞(_p1, _p2等)を除去した基本コードを取得
 * 例: "UA01BT/CGH-1-004_p1" -> "UA01BT/CGH-1-004"
 */
export function getBaseCardCode(code: string): string {
  return code.replace(/_p\d+$/i, '');
}

