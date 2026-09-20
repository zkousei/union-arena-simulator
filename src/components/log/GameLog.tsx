import React, { useEffect, useRef, useState } from 'react';
import { GameLogItem } from '../../types/game';
import { ScrollText, MessageSquare, Send } from 'lucide-react';

interface GameLogProps {
  logs: GameLogItem[];
  myPlayerId: string;
  myPlayerName: string;
  onSendChat?: (text: string) => void;
}

const QUICK_PHRASES = [
  'よろしくお願いします！',
  '効果確認中です',
  'アタックします！',
  'ブロックします',
  'ターン終了です',
  'ありがとうございました！',
];

export const GameLog: React.FC<GameLogProps> = ({
  logs,
  myPlayerId,
  onSendChat,
}) => {
  const [tab, setTab] = useState<'all' | 'chat'>('all');
  const [inputText, setInputText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const filteredLogs = tab === 'chat' ? logs.filter((l) => l.type === 'chat') : logs;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredLogs.length]);

  const handleSend = () => {
    if (!inputText.trim() || !onSendChat) return;
    onSendChat(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/80 rounded-xl border border-slate-800 p-2 shadow-inner text-xs">
      {/* タブヘッダー */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
          <button
            onClick={() => setTab('all')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold transition ${
              tab === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ScrollText className="w-3 h-3" />
            ログ
          </button>
          <button
            onClick={() => setTab('chat')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold transition ${
              tab === 'chat' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            チャット
          </button>
        </div>

        <span className="text-[10px] text-slate-500 font-mono">
          {filteredLogs.length} 件
        </span>
      </div>

      {/* ログ / チャットメッセージ一覧 */}
      <div className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-1 text-xs font-mono scrollbar-thin">
        {filteredLogs.map((log) => {
          const isPhase = log.type === 'phase';
          const isSystem = log.type === 'system';
          const isChat = log.type === 'chat';
          const isMine = log.playerId === myPlayerId;

          if (isChat) {
            return (
              <div
                key={log.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[9px] text-slate-500 mb-0.5">
                  {log.playerName || 'プレイヤー'} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div
                  className={`p-2 rounded-xl text-[11px] max-w-[85%] break-words font-sans shadow-md ${
                    isMine
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                  }`}
                >
                  {log.message}
                </div>
              </div>
            );
          }

          return (
            <div
              key={log.id}
              className={`p-1.5 rounded text-[11px] leading-relaxed transition-all ${
                isPhase
                  ? 'bg-indigo-950/50 text-indigo-200 border-l-2 border-indigo-400'
                  : isSystem
                  ? 'bg-amber-950/40 text-amber-200 border-l-2 border-amber-400'
                  : 'bg-slate-900/60 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-[9px] text-slate-500 mb-0.5">
                <span>{log.playerName || 'SYSTEM'}</span>
                <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <div className="break-words">{log.message}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* チャット送信エリア & 定型文 */}
      {onSendChat && (
        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          {/* クイック定型文ピッカー */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {QUICK_PHRASES.map((phrase, idx) => (
              <button
                key={idx}
                onClick={() => onSendChat(phrase)}
                className="whitespace-nowrap px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded text-[10px] text-slate-300 transition"
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* 入力ボックス */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="メッセージを入力..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
