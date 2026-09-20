import React, { useState } from 'react';
import { UsePeerReturn } from '../../hooks/usePeer';
import { Copy, Check, Users, Radio, LogOut, ArrowRight, ShieldCheck } from 'lucide-react';

interface PeerModalProps {
  peer: UsePeerReturn;
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: () => Promise<string>;
  onJoinRoom: (roomId: string) => Promise<void>;
  onDisconnect: () => void;
}

export const PeerModal: React.FC<PeerModalProps> = ({
  peer,
  isOpen,
  onClose,
  onCreateRoom,
  onJoinRoom,
  onDisconnect,
}) => {
  const [joinId, setJoinId] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    try {
      setLoading(true);
      await onCreateRoom();
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinId.trim()) return;
    try {
      setLoading(true);
      await onJoinRoom(joinId.trim());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const copyRoomUrl = () => {
    if (!peer.peerId) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${peer.peerId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="peer-modal-title"
        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 text-xs"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" />
            <h3 id="peer-modal-title" className="font-bold text-base text-white">
              P2P 通信対戦 (PeerJS)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded"
          >
            閉じる
          </button>
        </div>

        {/* 接続中ステータス表示 */}
        <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                peer.status === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : peer.status === 'connecting' || peer.status === 'reconnecting'
                  ? 'bg-amber-400 animate-spin'
                  : 'bg-slate-600'
              }`}
            />
            <span className="font-semibold text-slate-300">
              {peer.status === 'connected'
                ? '接続完了 (対戦中)'
                : peer.status === 'connecting'
                ? '接続待機・ネゴシエーション中...'
                : peer.status === 'waiting'
                ? '対戦相手の参加待ち'
                : peer.status === 'reconnecting'
                ? '切断を検知・再接続中...'
                : peer.status === 'error'
                ? '接続エラー'
                : '未接続'}
            </span>
          </div>

          {peer.role !== null && (
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1 text-rose-400 hover:text-rose-300 px-2 py-1 bg-rose-950/40 rounded border border-rose-800/40"
            >
              <LogOut className="w-3 h-3" />
              切断
            </button>
          )}
        </div>

        {peer.error && (
          <div
            role="alert"
            className="space-y-2 bg-rose-950/50 border border-rose-800 text-rose-300 p-2.5 rounded-lg"
          >
            <p>{peer.error}</p>
            {peer.role === 'guest' && (
              <button
                type="button"
                onClick={() => void peer.reconnect()}
                className="rounded bg-rose-800/70 px-2.5 py-1 font-bold text-white hover:bg-rose-700"
              >
                今すぐ再試行
              </button>
            )}
          </div>
        )}

        {/* ホストとして部屋作成 */}
        {peer.role !== 'guest' && (
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <Radio className="w-4 h-4 text-indigo-400" />
            <span>ホストとして部屋を作る</span>
          </div>

          {!peer.peerId ? (
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg shadow transition"
            >
              {loading ? 'ルーム生成中...' : 'ルームを作成する'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-slate-400 text-[11px]">
                対戦相手に以下の招待URLまたはルームIDを共有してください：
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={peer.peerId}
                  className="flex-1 bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg text-slate-200 font-mono text-[11px]"
                />
                <button
                  onClick={copyRoomUrl}
                  className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'コピー済' : 'URL共有'}
                </button>
              </div>
              {peer.status === 'waiting' && (
                <div className="text-[11px] text-amber-400 flex items-center gap-1 animate-pulse">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  相手の接続を待機しています...
                </div>
              )}
            </div>
          )}
          </div>
        )}

        {/* ゲストとして参加 */}
        {peer.role === null && (
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <ArrowRight className="w-4 h-4 text-emerald-400" />
              <span>既存の部屋に参加する</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="ホストのルームIDを入力"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg text-slate-200 placeholder-slate-500 text-xs"
              />
              <button
                onClick={handleJoin}
                disabled={!joinId.trim() || loading}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg font-bold"
              >
                {loading ? '接続中...' : '参加'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
