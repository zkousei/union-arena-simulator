import React from 'react';
import { Layers, RotateCcw, Sparkles, Dices, Users, RotateCw, PlusCircle, Undo2, Volume2, VolumeX } from 'lucide-react';
import { ConnectionStatus } from '../../types/peer';

interface ActionToolbarProps {
  onSetupDeck: () => void;
  onDrawCard: () => void;
  onSetAllActive: () => void;
  onRecoverAp: () => void;
  onRollDice: () => void;
  onResetGame: () => void;
  onUndo: () => void;
  canUndo: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenPeerModal: () => void;
  peerStatus: ConnectionStatus;
  isHost: boolean;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  onSetupDeck,
  onDrawCard,
  onSetAllActive,
  onRecoverAp,
  onRollDice,
  onResetGame,
  onUndo,
  canUndo,
  soundEnabled,
  onToggleSound,
  onOpenPeerModal,
  peerStatus,
  isHost,
}) => {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs">
      {/* プレイ操作ボタングループ */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={onSetupDeck}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow transition"
          title="50枚サンプルデッキを読み込み、ライフ7枚・手札7枚・APを自動セットアップします"
        >
          <Layers className="w-3.5 h-3.5" />
          デッキセットアップ
        </button>

        <button
          onClick={onDrawCard}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 transition"
          title="山札からカードを1枚引きます"
        >
          <PlusCircle className="w-3.5 h-3.5 text-sky-400" />
          1枚ドロー
        </button>

        <button
          onClick={onSetAllActive}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 transition"
          title="自陣のすべてのカードをアクティブ（リロール）にします"
        >
          <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
          全アクティブ
        </button>

        <button
          onClick={onRecoverAp}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 transition"
          title="APを全回復にします"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          AP全回復
        </button>

        <button
          onClick={onRollDice}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 transition"
          title="先攻後攻決め等のダイス（1〜6）を振ります"
        >
          <Dices className="w-3.5 h-3.5 text-purple-400" />
          ダイス
        </button>

        {/* Undoボタン */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-amber-300 font-bold rounded-lg border border-slate-700 transition"
          title="直前の操作を1手巻き戻します"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Undo
        </button>

        {/* サウンドトグルボタン */}
        <button
          onClick={onToggleSound}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
          title={soundEnabled ? '効果音: ON' : '効果音: OFF'}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
        </button>

        <button
          onClick={onResetGame}
          className="flex items-center gap-1 px-2 py-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition ml-1"
          title="盤面を初期状態にリセットします"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          リセット
        </button>
      </div>

      {/* P2P通信ステータス & 接続ボタン */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 bg-slate-950 rounded-lg border border-slate-800">
          <div
            className={`w-2 h-2 rounded-full ${
              peerStatus === 'connected'
                ? 'bg-emerald-400'
                : peerStatus === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-slate-500'
            }`}
          />
          <span className="text-slate-300">
            {peerStatus === 'connected'
              ? `P2P接続中 (${isHost ? 'ホスト' : 'ゲスト'})`
              : peerStatus === 'connecting'
              ? '接続試行中...'
              : 'オフライン（ソロ）'}
          </span>
        </div>

        <button
          onClick={onOpenPeerModal}
          className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg shadow transition"
        >
          <Users className="w-3.5 h-3.5" />
          P2P通信対戦
        </button>
      </div>
    </div>
  );
};
