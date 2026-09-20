import React from 'react';
import { PlayerState } from '../../types/game';
import { Layers, CheckCircle, Dices, Play, RefreshCw, UserCheck, Shield, Sparkles } from 'lucide-react';

interface PreGameBarProps {
  myPlayer: PlayerState;
  opponentPlayer: PlayerState;
  firstPlayerId: string | null;
  onSetFirstPlayer: (playerId: string) => void;
  onOpenDeckPicker: () => void;
  onMulligan: (targetPlayerId?: string) => void;
  onKeepHand: (targetPlayerId?: string) => void;
  onPlaceLife: (targetPlayerId?: string) => void;
  onToggleReady: (targetPlayerId?: string) => void;
  onStartGame: () => void;
  onRollDice: () => void;
  isSoloMode?: boolean;
}

export const PreGameBar: React.FC<PreGameBarProps> = ({
  myPlayer,
  opponentPlayer,
  firstPlayerId,
  onSetFirstPlayer,
  onOpenDeckPicker,
  onMulligan,
  onKeepHand,
  onPlaceLife,
  onToggleReady,
  onStartGame,
  onRollDice,
  isSoloMode = false,
}) => {
  // ソロプレイ時はP1(下側)とP2(上側)を特定
  const p1 = myPlayer.id === 'player-1' ? myPlayer : opponentPlayer;
  const p2 = myPlayer.id === 'player-2' ? myPlayer : opponentPlayer;

  const p1HasHand = p1.hand.length > 0;
  const p1IsFirst = p1.id === firstPlayerId;
  const p1HandDetermined = !!p1.hasMulliganed || !!p1.isHandKept;
  const p1HasLife = p1.life.length > 0;

  const p2HasHand = p2.hand.length > 0;
  const p2IsFirst = p2.id === firstPlayerId;
  const p2HandDetermined = !!p2.hasMulliganed || !!p2.isHandKept;
  const p2HasLife = p2.life.length > 0;

  const handleQuickPlaceBothLife = () => {
    if (!p1HasLife) onPlaceLife(p1.id);
    if (!p2HasLife) onPlaceLife(p2.id);
  };

  if (isSoloMode) {
    const canStartSolo =
      (p1HasLife || p1.isReady || !p1HasHand) &&
      (p2HasLife || p2.isReady || !p2HasHand) &&
      (p1HasHand || p2HasHand);

    return (
      <div className="flex flex-col gap-2 bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border-b border-indigo-500/30 p-3 shadow-lg w-full text-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* 先攻・後攻決定 */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="font-bold text-slate-400 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              先攻:
            </span>
            <button
              onClick={() => onSetFirstPlayer(p1.id)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                p1IsFirst
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-white bg-slate-900'
              }`}
            >
              P1 (下側) が先攻
            </button>
            <button
              onClick={() => onSetFirstPlayer(p2.id)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                p2IsFirst
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-white bg-slate-900'
              }`}
            >
              P2 (上側) が先攻
            </button>
            <button
              onClick={onRollDice}
              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
              title="ダイスを振って決定"
            >
              <Dices className="w-3.5 h-3.5 text-purple-400" />
            </button>
          </div>

          {/* デッキ選択ボタン */}
          <button
            onClick={onOpenDeckPicker}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow transition"
            title="P1・P2のデッキを選択・セットします"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>デッキ選択・セット</span>
          </button>

          {/* 両者ライフ一括配置ショートカット（キープ/マリガン決定後のみ） */}
          {p1HasHand && p2HasHand && p1HandDetermined && p2HandDetermined && (!p1HasLife || !p2HasLife) && (
            <button
              onClick={handleQuickPlaceBothLife}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg shadow transition text-[11px] animate-pulse"
              title="P1とP2の山札からそれぞれ7枚をライフに裏向きで配置します"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>⚡ 両者のライフ7枚を一括配置</span>
            </button>
          )}

          {/* 対戦開始 */}
          <button
            onClick={onStartGame}
            disabled={!canStartSolo}
            className="flex items-center gap-1.5 px-5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-extrabold rounded-lg shadow-lg shadow-emerald-600/30 transition transform active:scale-95"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>対戦開始 (START GAME)</span>
          </button>
        </div>

        {/* P1 / P2 準備コントロールバー */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
          {/* P1 (下側) */}
          <div className="flex items-center gap-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800 flex-wrap">
            <span className="font-bold text-indigo-300 text-[11px] px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-700/50">
              P1 (下)
            </span>
            {!p1HasHand ? (
              <span className="text-slate-500 text-[11px]">デッキ未セット</span>
            ) : (
              <>
                {!p1HandDetermined ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onMulligan(p1.id)}
                      className="px-2 py-0.5 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded text-[11px]"
                    >
                      引き直し
                    </button>
                    <button
                      onClick={() => onKeepHand(p1.id)}
                      className="px-2 py-0.5 bg-teal-700 hover:bg-teal-600 text-white font-bold rounded text-[11px]"
                    >
                      キープ
                    </button>
                  </div>
                ) : (
                  <span className="text-emerald-400 text-[11px] flex items-center gap-0.5">
                    <CheckCircle className="w-3 h-3" /> 手札決定済
                  </span>
                )}

                {p1HandDetermined && !p1HasLife ? (
                  <button
                    onClick={() => onPlaceLife(p1.id)}
                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-[11px]"
                  >
                    ライフ7枚配置
                  </button>
                ) : p1HandDetermined && p1HasLife ? (
                  <span className="text-indigo-300 text-[11px] flex items-center gap-0.5">
                    <Shield className="w-3 h-3" /> ライフ済
                  </span>
                ) : null}
              </>
            )}
          </div>

          {/* P2 (上側) */}
          <div className="flex items-center gap-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800 flex-wrap">
            <span className="font-bold text-amber-300 text-[11px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-700/50">
              P2 (上)
            </span>
            {!p2HasHand ? (
              <span className="text-slate-500 text-[11px]">デッキ未セット</span>
            ) : (
              <>
                {!p2HandDetermined ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onMulligan(p2.id)}
                      className="px-2 py-0.5 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded text-[11px]"
                    >
                      引き直し
                    </button>
                    <button
                      onClick={() => onKeepHand(p2.id)}
                      className="px-2 py-0.5 bg-teal-700 hover:bg-teal-600 text-white font-bold rounded text-[11px]"
                    >
                      キープ
                    </button>
                  </div>
                ) : (
                  <span className="text-emerald-400 text-[11px] flex items-center gap-0.5">
                    <CheckCircle className="w-3 h-3" /> 手札決定済
                  </span>
                )}

                {p2HandDetermined && !p2HasLife ? (
                  <button
                    onClick={() => onPlaceLife(p2.id)}
                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-[11px]"
                  >
                    ライフ7枚配置
                  </button>
                ) : p2HandDetermined && p2HasLife ? (
                  <span className="text-indigo-300 text-[11px] flex items-center gap-0.5">
                    <Shield className="w-3 h-3" /> ライフ済
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // P2Pオンライン対戦時
  const hasHand = myPlayer.hand.length > 0;
  const isFirst = myPlayer.id === firstPlayerId;
  const isHandDetermined = !!myPlayer.hasMulliganed || !!myPlayer.isHandKept;
  const hasLife = myPlayer.life.length > 0;

  // 相手の手札判断状態
  const oppHasHand = opponentPlayer.hand.length > 0;
  const oppHandDetermined = !!opponentPlayer.hasMulliganed || !!opponentPlayer.isHandKept;
  const oppIsFirst = opponentPlayer.id === firstPlayerId;

  // 公式ルール順序ガイド: 先攻が未判断で、自分が後攻の場合
  const isWaitingForFirstPlayer = oppIsFirst && oppHasHand && !oppHandDetermined && !isHandDetermined;

  const canStart = (hasLife || myPlayer.isReady) && (opponentPlayer.life.length > 0 || opponentPlayer.isReady || opponentPlayer.hand.length === 0);

  return (
    <div className="flex flex-col gap-2 bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border-b border-indigo-500/30 p-3 shadow-lg w-full text-xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* ステップ1: 先攻・後攻決定 */}
        <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
          <span className="font-bold text-slate-400 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
            手番:
          </span>
          <button
            onClick={() => onSetFirstPlayer(myPlayer.id)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
              isFirst
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            自分が先攻
          </button>
          <button
            onClick={() => onSetFirstPlayer(opponentPlayer.id)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
              !isFirst
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            相手が先攻
          </button>
          <button
            onClick={onRollDice}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
            title="ダイスを振って決定"
          >
            <Dices className="w-3.5 h-3.5 text-purple-400" />
          </button>
        </div>

        {/* ステップ2, 3, 4: デッキ準備・マリガン・ライフ配置 */}
        <div className="flex items-center gap-2 flex-wrap">
          {!hasHand ? (
            <button
              onClick={onOpenDeckPicker}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow transition animate-pulse"
            >
              <Layers className="w-3.5 h-3.5" />
              ① デッキを選択・セット
            </button>
          ) : (
            <>
              {/* デッキ変更ボタン */}
              <button
                onClick={onOpenDeckPicker}
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] border border-slate-700 transition"
                title="別のデッキを選択して再読み込み"
              >
                <Layers className="w-3 h-3 text-indigo-400" />
                デッキ変更
              </button>
              {/* マリガン判断（キープ または 引き直し） */}
              {!isHandDetermined ? (
                <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-indigo-500/40">
                  <span className="text-[11px] text-amber-300 font-bold">
                    ② 手札判断{isWaitingForFirstPlayer ? ' (先攻優先)' : ''}:
                  </span>
                  <button
                    onClick={() => onMulligan(myPlayer.id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded shadow transition text-[11px]"
                    title="公式ルール: 手札7枚を横に置き、山札から新たに7枚引いたあと、横に置いた7枚を山札に戻してシャッフルします（1回のみ）"
                  >
                    <RefreshCw className="w-3 h-3" />
                    引き直す (マリガン)
                  </button>
                  <button
                    onClick={() => onKeepHand(myPlayer.id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-teal-700 hover:bg-teal-600 text-white font-bold rounded shadow transition text-[11px]"
                    title="手札を引き直さず、このまま7枚で対戦を開始します"
                  >
                    <Sparkles className="w-3 h-3" />
                    この手札でキープ
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-emerald-950/60 border border-emerald-500/50 px-2.5 py-1 rounded-lg text-emerald-300 text-[11px] font-bold">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  手札決定済 ({myPlayer.hasMulliganed ? 'マリガン済' : 'キープ'})
                </div>
              )}

              {/* ライフ7枚配置ステップ（キープ/マリガン決定後のみ） */}
              {!hasLife ? (
                <button
                  onClick={() => onPlaceLife(myPlayer.id)}
                  disabled={!isHandDetermined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg shadow transition ${
                    isHandDetermined
                      ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse ring-2 ring-amber-400/50'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
                  }`}
                  title={isHandDetermined
                    ? '公式ルール: マリガン終了後、山札の上から7枚を裏向きでライフに配置します'
                    : '先にキープ/マリガンを決定してください'}
                >
                  <Shield className="w-3.5 h-3.5" />
                  ③ ライフ7枚を配置
                </button>
              ) : (
                <div className="flex items-center gap-1 bg-indigo-950/60 border border-indigo-500/50 px-2.5 py-1 rounded-lg text-indigo-300 text-[11px] font-bold">
                  <Shield className="w-3 h-3 text-indigo-400" />
                  ライフ7枚配置済
                </div>
              )}
            </>
          )}

          {/* ステップ5: 準備完了 (Ready) */}
          <button
            onClick={() => onToggleReady(myPlayer.id)}
            disabled={!hasHand}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs shadow transition ${
              myPlayer.isReady
                ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {myPlayer.isReady ? '準備完了 (READY)' : '準備完了にする'}
          </button>
        </div>

        {/* 対戦開始 */}
        <div>
          <button
            onClick={onStartGame}
            disabled={!canStart}
            className="flex items-center gap-1.5 px-5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-extrabold rounded-lg shadow-lg shadow-emerald-600/30 transition transform active:scale-95"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>対戦開始 (START GAME)</span>
          </button>
        </div>
      </div>

      {/* 公式ルールガイダンス */}
      <div className="text-[11px] text-indigo-300/80 flex items-center justify-between px-1">
        <span>
          📜 <strong>公式ルール手順:</strong> ①手番決定 → ②手札7枚ドロー（山札43枚） → ③先攻から順に手札判断（マリガン/キープ） → ④ライフ7枚配置（山札残り36枚） → ⑤対戦開始
        </span>
        <span className="font-semibold text-slate-400">
          相手: {oppHasHand ? (oppHandDetermined ? '手札決定済' : '手札確認中') : 'デッキ未セット'}
          {opponentPlayer.life.length > 0 ? '・ライフ済' : ''}
          {opponentPlayer.isReady ? '・✅Ready' : ''}
        </span>
      </div>
    </div>
  );
};
