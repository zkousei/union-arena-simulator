import React, { useState } from 'react';
import { Card } from '../../types/card';
import { CardView } from '../board/CardView';
import { Layers, Hand, Trash2, ArrowUpRight, X, ShieldAlert, ArrowUp, ArrowDown, Split, Eye } from 'lucide-react';

interface UnderCardsModalProps {
  isOpen: boolean;
  parentCard: Card | null;
  isOpponent?: boolean;
  hasEmptyFrontSlot: boolean;
  hasEmptyEnergySlot: boolean;
  onSeparateCard: (
    underCardId: string,
    destination: 'hand' | 'graveyard' | 'frontLine' | 'energyLine' | 'removed' | 'life' | 'lifeFaceUp' | 'deckTop' | 'deckBottom'
  ) => void;
  onSeparateParentCard?: (destination: 'hand' | 'graveyard' | 'removed' | 'deckTop' | 'deckBottom' | 'life' | 'lifeFaceUp') => void;
  onInspectCard?: (card: Card) => void;
  onClose: () => void;
}

export const UnderCardsModal: React.FC<UnderCardsModalProps> = ({
  isOpen,
  parentCard,
  isOpponent = false,
  hasEmptyFrontSlot,
  hasEmptyEnergySlot,
  onSeparateCard,
  onSeparateParentCard,
  onInspectCard,
  onClose,
}) => {
  const [revealOwnFaceDown, setRevealOwnFaceDown] = useState(true);
  if (!isOpen || !parentCard) return null;

  const underCards = parentCard.underCards || [];
  const revealFaceDown = !isOpponent && revealOwnFaceDown;

  const handleSeparateParent = (dest: 'hand' | 'graveyard' | 'removed' | 'deckTop' | 'deckBottom' | 'life' | 'lifeFaceUp') => {
    if (onSeparateParentCard) {
      onSeparateParentCard(dest);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border-2 border-purple-500/80 rounded-2xl max-w-4xl w-full p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                重なっているカードの確認・分離操作
                <span className="text-xs font-normal text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded-full border border-purple-500/40">
                  下敷き {underCards.length}枚
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                上のカード（表面）または下敷きカードを個別に分離して移動できます。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isOpponent && (
              <button
                onClick={() => setRevealOwnFaceDown(!revealOwnFaceDown)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 border border-amber-500/40 flex items-center gap-1.5 transition-colors"
                title="裏向きマーカーの内容表示を切り替えます（ルール上、プレイヤー自身はいつでも確認可能です）"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>{revealFaceDown ? 'マーカー表面を表示中' : 'マーカーを裏面で表示'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* メインコンテンツ: 上のカード（親）と 下敷きカード（子） */}
        <div className="flex flex-col md:flex-row gap-4 items-start justify-center">
          {/* 左側: 現在の表面（上のカード） */}
          <div className="flex flex-col items-center gap-2 bg-purple-950/40 p-4 rounded-xl border-2 border-purple-500/60 shadow-lg w-full md:w-64 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-purple-300 bg-purple-900/60 px-2.5 py-1 rounded-full border border-purple-400/40">
              <Split className="w-3.5 h-3.5 text-purple-300" />
              現在の表面（上のカード）
            </div>
            
            <CardView
              card={parentCard}
              isOpponent={isOpponent}
              onInspect={!isOpponent || !parentCard.isFaceDown ? onInspectCard : undefined}
            />
            {onInspectCard && (!isOpponent || !parentCard.isFaceDown) && (
              <button
                onClick={() => onInspectCard(parentCard)}
                className="w-full flex items-center justify-center gap-1 py-1 px-2 bg-purple-900/60 hover:bg-purple-800 border border-purple-400/40 rounded text-[10px] text-purple-200 font-bold transition-colors"
                title="表面カードの詳細・テキストを確認"
              >
                <Eye className="w-3 h-3 text-purple-300" />
                表面カードの詳細
              </button>
            )}

            {!isOpponent && <div className="w-full mt-2 pt-2 border-t border-purple-500/30 flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-300 text-center">
                上のカードを分離する
              </span>
              <p className="text-[10px] text-purple-200/80 text-center leading-tight">
                ※分離すると直下の下敷きカードが新たな表面として残ります
              </p>

              <div className="grid grid-cols-2 gap-1 text-[10px] mt-1">
                <button
                  onClick={() => handleSeparateParent('hand')}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-sky-700 hover:bg-sky-600 rounded text-white font-bold transition-colors"
                  title="上のカードを手札に戻す"
                >
                  <Hand className="w-3 h-3" />
                  手札へ戻す
                </button>
                <button
                  onClick={() => handleSeparateParent('graveyard')}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-rose-700 hover:bg-rose-600 rounded text-white font-bold transition-colors"
                  title="上のカードを場外へ送る"
                >
                  <Trash2 className="w-3 h-3" />
                  場外へ送る
                </button>
                <button
                  onClick={() => handleSeparateParent('removed')}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-purple-700 hover:bg-purple-600 rounded text-white font-bold transition-colors"
                  title="上のカードを除外する"
                >
                  <ShieldAlert className="w-3 h-3" />
                  除外する
                </button>
                <button
                  onClick={() => handleSeparateParent('deckTop')}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-indigo-700 hover:bg-indigo-600 rounded text-white font-bold transition-colors"
                  title="上のカードを山札の上に置く"
                >
                  <ArrowUp className="w-3 h-3" />
                  山札上へ
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <button
                  onClick={() => handleSeparateParent('lifeFaceUp')}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-amber-950/90 hover:bg-amber-900 border border-amber-500/60 rounded text-amber-300 font-bold transition-colors"
                  title="上のカードをライフに表向きで置く"
                >
                  <ShieldAlert className="w-3 h-3 text-amber-400" />
                  ライフ(表)
                </button>
                <button
                  onClick={() => handleSeparateParent('life')}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 rounded text-rose-300 font-bold transition-colors"
                  title="上のカードをライフに裏向きで置く"
                >
                  <ShieldAlert className="w-3 h-3 text-rose-400" />
                  ライフ(裏)
                </button>
              </div>

              <button
                onClick={() => handleSeparateParent('deckBottom')}
                className="w-full flex items-center justify-center gap-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-slate-300 font-bold transition-colors"
                title="上のカードを山札の下に置く"
              >
                <ArrowDown className="w-3 h-3" />
                山札下へ
              </button>
            </div>}
          </div>

          {/* 右側: 下敷きカード一覧 */}
          <div className="flex-1 flex flex-col gap-2 w-full">
            <div className="text-xs font-bold text-slate-300 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              下敷きカード一覧（{underCards.length}枚）
              <span className="text-[10px] font-normal text-slate-400 ml-1">
                ※下敷きカード単体を個別に手札・場外・ライフ・フィールドへ分離できます
              </span>
            </div>

            <div className="flex items-center justify-start gap-4 flex-wrap py-2 overflow-x-auto min-h-[220px]">
              {underCards.length === 0 ? (
                <div className="text-sm text-slate-500 py-8 text-center w-full">下敷きカードはありません</div>
              ) : (
                underCards.map((card, index) => {
                  const isTopUnderCard = index === underCards.length - 1;
                  return (
                    <div
                      key={`${card.id}-${index}`}
                      className={`flex flex-col items-center gap-2 bg-slate-950/90 p-3 rounded-xl border shadow-lg relative ${
                        isTopUnderCard ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mb-0.5">
                        <span>下敷き #{index + 1}</span>
                        {card.isFaceDown ? (
                          <span className="text-[9px] bg-amber-950/90 text-amber-300 px-1 rounded border border-amber-500/40 flex items-center gap-0.5">
                            <Eye className="w-2.5 h-2.5" />
                            マーカー(裏)
                          </span>
                        ) : (
                          <span className="text-[9px] bg-purple-950/80 text-purple-300 px-1 rounded border border-purple-500/40">
                            レイド元(表)
                          </span>
                        )}
                        {isTopUnderCard && (
                          <span className="text-[9px] bg-indigo-950/80 text-indigo-300 px-1 rounded border border-indigo-500/40">
                            直下
                          </span>
                        )}
                      </div>
                      <CardView
                        card={card}
                        isOpponent={isOpponent}
                        revealFaceDown={revealFaceDown}
                        onInspect={!isOpponent || !card.isFaceDown ? onInspectCard : undefined}
                      />

                      {/* 詳細確認ボタン */}
                      {onInspectCard && (!isOpponent || !card.isFaceDown) && (
                        <button
                          onClick={() => onInspectCard(card)}
                          className="w-full flex items-center justify-center gap-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-indigo-300 font-bold transition-colors"
                          title="カード詳細・効果テキストを確認"
                        >
                          <Eye className="w-3 h-3 text-indigo-400" />
                          詳細を確認
                        </button>
                      )}

                      {/* 下敷きカード個別分離アクションボタン */}
                      {!isOpponent && <div className="flex flex-col gap-1 w-full text-[10px] mt-1">
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            onClick={() => onSeparateCard(card.id, 'hand')}
                            className="flex items-center justify-center gap-1 py-1 px-1 bg-sky-700 hover:bg-sky-600 rounded text-white font-bold transition-colors"
                            title="手札に戻す"
                          >
                            <Hand className="w-3 h-3" />
                            手札へ
                          </button>
                          <button
                            onClick={() => onSeparateCard(card.id, 'graveyard')}
                            className="flex items-center justify-center gap-1 py-1 px-1 bg-rose-700 hover:bg-rose-600 rounded text-white font-bold transition-colors"
                            title="場外に送る"
                          >
                            <Trash2 className="w-3 h-3" />
                            場外へ
                          </button>
                          <button
                            onClick={() => onSeparateCard(card.id, 'removed')}
                            className="flex items-center justify-center gap-1 py-1 px-1 bg-purple-700 hover:bg-purple-600 rounded text-white font-bold transition-colors"
                            title="除外する（リムーブエリア）"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            除外へ
                          </button>
                        </div>

                        {/* ライフ・山札送り (リーファ地神テラリア等) */}
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            onClick={() => onSeparateCard(card.id, 'lifeFaceUp')}
                            className="flex items-center justify-center gap-0.5 py-1 px-1 bg-amber-950/90 hover:bg-amber-900 border border-amber-500/60 rounded text-amber-300 font-bold transition-colors"
                            title="ライフに表向きで置く（リーファ地神テラリア等の効果）"
                          >
                            <ShieldAlert className="w-3 h-3 text-amber-400" />
                            ライフ(表)
                          </button>
                          <button
                            onClick={() => onSeparateCard(card.id, 'life')}
                            className="flex items-center justify-center gap-0.5 py-1 px-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 rounded text-rose-300 font-bold transition-colors"
                            title="ライフに裏向きで置く"
                          >
                            <ShieldAlert className="w-3 h-3 text-rose-400" />
                            ライフ(裏)
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1">
                          <button
                            onClick={() => onSeparateCard(card.id, 'deckTop')}
                            className="flex items-center justify-center gap-1 py-1 px-1 bg-slate-800 hover:bg-slate-700 rounded text-amber-300 font-semibold transition-colors"
                            title="山札の上に置く"
                          >
                            <ArrowUp className="w-3 h-3" />
                            山札上
                          </button>
                          <button
                            onClick={() => onSeparateCard(card.id, 'deckBottom')}
                            className="flex items-center justify-center gap-1 py-1 px-1 bg-slate-800 hover:bg-slate-700 rounded text-indigo-300 font-semibold transition-colors"
                            title="山札の下に置く"
                          >
                            <ArrowDown className="w-3 h-3" />
                            山札下
                          </button>
                        </div>

                        {hasEmptyFrontSlot && (
                          <button
                            onClick={() => onSeparateCard(card.id, 'frontLine')}
                            className="flex items-center justify-center gap-1 py-1 px-2 bg-indigo-700 hover:bg-indigo-600 rounded text-white font-bold transition-colors"
                            title="フロントLの空き枠に出す"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            フロントLに出す
                          </button>
                        )}

                        {hasEmptyEnergySlot && (
                          <button
                            onClick={() => onSeparateCard(card.id, 'energyLine')}
                            className="flex items-center justify-center gap-1 py-1 px-2 bg-emerald-700 hover:bg-emerald-600 rounded text-white font-bold transition-colors"
                            title="エナジーLの空き枠に出す"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            エナジーLに出す
                          </button>
                        )}
                      </div>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="border-t border-slate-800 pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold text-slate-300 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
