import { Card } from '../types/card';
import { CARD_DATABASE, CardMaster } from './cardDatabase';
import { UserDeck, flattenDeckToCards } from '../domain/deckValidation';

export interface PresetDeckInfo {
  id: string;
  titleCode: string;
  title: string;
  deckName: string;
  color: 'PURPLE' | 'GREEN' | 'YELLOW';
  colorClass: string;
  description: string;
  leadCardName: string;
  keyFeatures: string[];
  deck: UserDeck;
}

// カード検索ヘルパー
function getCard(code: string): CardMaster {
  const c = CARD_DATABASE.find((card) => card.code === code);
  if (!c) {
    throw new Error(`Card not found for code: ${code}`);
  }
  return c;
}

/**
 * プリセットデッキ定義（コードギアス・HUNTER×HUNTER・呪術廻戦）
 * 公式カードリストに完全準拠し、「同名最大4枚」「50枚」「特別トリガー（Special 4枚/Final 4枚/Color 4枚）」の公式大会ルールを100%満たす構成
 */
export const PRESET_DECKS: PresetDeckInfo[] = [
  {
    id: 'preset-cgh',
    titleCode: 'CGH',
    title: 'コードギアス 反逆のルルーシュ',
    deckName: '黒の騎士団 & ガウェイン (レイド) デッキ',
    color: 'PURPLE',
    colorClass: 'border-purple-500/50 bg-purple-950/20 hover:border-purple-400 text-purple-300',
    leadCardName: 'ガウェイン (レイド)',
    description: 'ゼロやカレンで盤面と手札を整え、強力なレイド「ガウェイン」「紅蓮弐式」で相手フロントラインを制圧するコントロールビート型。',
    keyFeatures: ['ガウェイン全体BPデバフ', '紅蓮弐式インパクト奇襲', '合衆国日本によるAP回復'],
    deck: {
      id: 'preset-cgh',
      name: '黒の騎士団 & ガウェイン (レイド) デッキ',
      titleCode: 'CGH',
      updatedAt: Date.now(),
      items: [
        { card: getCard('UA01BT/CGH-1-002'), count: 4 }, // 紅月 カレン (GET)
        { card: getCard('UA01BT/CGH-1-005'), count: 4 }, // C.C. (2個玉)
        { card: getCard('UA01BT/CGH-1-008'), count: 4 }, // 皇 神楽耶
        { card: getCard('UA01BT/CGH-1-009'), count: 4 }, // ゼロ (GET / ルルーシュ扱い)
        { card: getCard('UA01BT/CGH-1-011'), count: 2 }, // ディートハルト・リート
        { card: getCard('UA01BT/CGH-1-013'), count: 4 }, // 藤堂 鏡志朗 (COLOR)
        { card: getCard('UA01BT/CGH-1-015'), count: 4 }, // ルルーシュ・ランペルージ (ACTIVE)
        { card: getCard('UA01BT/CGH-1-022'), count: 4 }, // ガウェイン (RAID)
        { card: getCard('UA01BT/CGH-1-023'), count: 4 }, // 紅蓮弐式 (RAID/GET)
        { card: getCard('UA01BT/CGH-1-026'), count: 4 }, // 無頼改
        { card: getCard('UA01BT/CGH-1-027'), count: 4 }, // 潜水艦 (FIELD)
        { card: getCard('UA01BT/CGH-1-029'), count: 4 }, // 合衆国日本 (FINAL)
        { card: getCard('UA01BT/CGH-1-030'), count: 4 }, // 絶対遵守のギアス (SPECIAL)
      ],
    },
  },
  {
    id: 'preset-htr',
    titleCode: 'HTR',
    title: 'HUNTER×HUNTER',
    deckName: 'ハンター試験 & ゴン (レイド) デッキ',
    color: 'GREEN',
    colorClass: 'border-emerald-500/50 bg-emerald-950/20 hover:border-emerald-400 text-emerald-300',
    leadCardName: 'ゴン＝フリークス (レイド)',
    description: 'キルアやサトツでエナジー基盤を固め、レイド「ゴン＝フリークス」の全体BP強化とクラピカで盤面を制圧するアグロビート型。',
    keyFeatures: ['レイドゴンのBP+1000付与', 'サトツ・ネテロの2個玉加速', '釣り竿による相手除去'],
    deck: {
      id: 'preset-htr',
      name: 'ハンター試験 & ゴン (レイド) デッキ',
      titleCode: 'HTR',
      updatedAt: Date.now(),
      items: [
        { card: getCard('UA03BT/HTR-1-078'), count: 4 }, // ゴン＝フリークス (RAID)
        { card: getCard('UA03BT/HTR-1-073'), count: 4 }, // クラピカ (COLOR)
        { card: getCard('UA03BT/HTR-1-079'), count: 4 }, // サトツ (2個玉)
        { card: getCard('UA03BT/HTR-1-081'), count: 4 }, // ゼパイル (DRAW)
        { card: getCard('UA03BT/HTR-1-082'), count: 4 }, // センリツ (ACTIVE)
        { card: getCard('UA03BT/HTR-1-085'), count: 4 }, // ネテロ (2個玉)
        { card: getCard('UA03BT/HTR-1-086'), count: 4 }, // バショウ (ACTIVE)
        { card: getCard('UA03BT/HTR-1-090'), count: 4 }, // レオリオ
        { card: getCard('UA03BT/HTR-1-093'), count: 4 }, // ヒソカ (DRAW)
        { card: getCard('UA03BT/HTR-1-094'), count: 4 }, // キルア＝ゾルディック (GET)
        { card: getCard('UA03BT/HTR-1-095'), count: 2 }, // 天空闘技場 (FIELD)
        { card: getCard('UA03BT/HTR-1-097'), count: 4 }, // 釣り竿 (SPECIAL)
        { card: getCard('UA03BT/HTR-1-099'), count: 4 }, // ハンターライセンス (FINAL)
      ],
    },
  },
  {
    id: 'preset-jjk',
    titleCode: 'JJK',
    title: '呪術廻戦',
    deckName: '呪術高専 & 伏黒恵 (レイド) デッキ',
    color: 'YELLOW',
    colorClass: 'border-yellow-500/50 bg-yellow-950/20 hover:border-yellow-400 text-yellow-300',
    leadCardName: '伏黒 恵 (レイド)',
    description: '虎杖・釘崎・真希で序盤を展開し、レイド「伏黒 恵」や玉犬、最強術師「五条 悟」の超火力と「虚式「茈」」で圧倒するパワー型。',
    keyFeatures: ['虎杖悠仁の2個玉加速', '五条悟による攻防制圧', '虚式「茈」による必殺除去'],
    deck: {
      id: 'preset-jjk',
      name: '呪術高専 & 伏黒恵 (レイド) デッキ',
      titleCode: 'JJK',
      updatedAt: Date.now(),
      items: [
        { card: getCard('UA02BT/JJK-1-001'), count: 4 }, // 虎杖 悠仁 (2個玉)
        { card: getCard('UA02BT/JJK-1-003'), count: 4 }, // 狗巻 棘
        { card: getCard('UA02BT/JJK-1-006'), count: 4 }, // 釘崎 野薔薇 (GET)
        { card: getCard('UA02BT/JJK-1-011'), count: 4 }, // 五条 悟 (COLOR)
        { card: getCard('UA02BT/JJK-1-013'), count: 4 }, // 禪院 真希 (ACTIVE)
        { card: getCard('UA02BT/JJK-1-015'), count: 4 }, // パンダ
        { card: getCard('UA02BT/JJK-1-018'), count: 4 }, // 伏黒 津美紀 (DRAW)
        { card: getCard('UA02BT/JJK-1-022'), count: 4 }, // 伏黒 恵 (RAID)
        { card: getCard('UA02BT/JJK-1-024'), count: 4 }, // 玉犬：黒＆白
        { card: getCard('UA02BT/JJK-1-025'), count: 4 }, // 玉犬：渾 (ACTIVE)
        { card: getCard('UA02BT/JJK-1-028'), count: 2 }, // 無量空処 (FIELD)
        { card: getCard('UA02BT/JJK-1-029'), count: 4 }, // 虚式「茈」 (SPECIAL)
        { card: getCard('UA02BT/JJK-1-034'), count: 4 }, // 領域展開 (FINAL)
      ],
    },
  },
];

/**
 * 指定作品のプリセットデッキから50枚のカード配列を生成
 */
export function generatePresetDeck(titleCode: string = 'CGH', playerId: string = 'player-1'): Card[] {
  const preset = PRESET_DECKS.find((p) => p.titleCode === titleCode) || PRESET_DECKS[0];
  return flattenDeckToCards(preset.deck, playerId);
}

/**
 * 従来のテストおよび初期設定用互換関数（デフォルトでコードギアスの50枚デッキを返す）
 */
export function generateSampleDeck(playerId: string = 'player-1'): Card[] {
  return generatePresetDeck('CGH', playerId);
}
