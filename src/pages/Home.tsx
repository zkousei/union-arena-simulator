import React, { useEffect, useState } from 'react';
import {
  Swords,
  Layers,
  Users,
  Play,
  HelpCircle,
  Sparkles,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Flame,
  LogIn,
  Eye,
} from 'lucide-react';
import type { PresetDeckInfo } from '../data/sampleDeck';
import type { UserDeck } from '../domain/deckValidation';
import { normalizeRoomId } from '../domain/roomId';

interface HomeProps {
  onStartSolo: () => void;
  onHostGame: () => void;
  onJoinGame: (roomId: string) => void;
  onSpectateGame: (roomId: string) => void;
  onOpenDeckBuilder: () => void;
  onSelectPresetDeck: (deck: UserDeck, mode: 'solo' | 'p2p') => void;
}

export const HomePage: React.FC<HomeProps> = ({
  onStartSolo,
  onHostGame,
  onJoinGame,
  onSpectateGame,
  onOpenDeckBuilder,
  onSelectPresetDeck,
}) => {
  const [activeRuleTab, setActiveRuleTab] = useState<'basics' | 'phases' | 'raid' | 'battle'>('basics');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [joinRoomInput, setJoinRoomInput] = useState('');
  const [joinRoomError, setJoinRoomError] = useState<string | null>(null);
  const [spectatorRoomInput, setSpectatorRoomInput] = useState('');
  const [spectatorRoomError, setSpectatorRoomError] = useState<string | null>(null);
  const [presetDecks, setPresetDecks] = useState<PresetDeckInfo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('../data/sampleDeck').then(({ PRESET_DECKS }) => {
      if (!cancelled) setPresetDecks(PRESET_DECKS);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = joinRoomInput.trim();
    if (!trimmed) return;

    const roomId = normalizeRoomId(trimmed);
    if (!roomId) {
      setJoinRoomError('6文字のルームコードを入力してください。');
      return;
    }
    setJoinRoomError(null);
    onJoinGame(roomId);
  };

  const handleSpectateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = spectatorRoomInput.trim();
    if (!trimmed) return;

    const roomId = normalizeRoomId(trimmed);
    if (!roomId) {
      setSpectatorRoomError('6文字のルームコードを入力してください。');
      return;
    }
    setSpectatorRoomError(null);
    onSpectateGame(roomId);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 sm:p-6 md:p-10 space-y-12">
      {/* ヒーローセクション */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-purple-950/40 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Ver 1.1 公式ルール完全準拠サンドボックス</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white mb-4">
            UNION ARENA <br />
            <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-purple-400 bg-clip-text text-transparent">
              Web Simulator
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8 max-w-2xl">
            カードの登場・レイド重ね・エナジー発生・トリガーチェック・バトル演出からP2Pオンライン対戦まで。
            公式ルール Ver 1.1 に準拠したWebブラウザ完結の本格TCGシミュレータです。
          </p>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              onClick={onStartSolo}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
              title="1台のPCでPlayer 1とPlayer 2の両方を操作して一人回し練習"
            >
              <Play className="w-4 h-4 fill-white" />
              🎮 ソロプレイ（一人回し）
            </button>

            <button
              onClick={onHostGame}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm sm:text-base shadow-lg shadow-emerald-700/30 transition transform hover:-translate-y-0.5"
              title="ルームコードを友達に送ってブラウザ同士でリアルタイム対戦"
            >
              <Users className="w-4 h-4 text-emerald-200" />
              🌐 P2P部屋を作成（Host）
            </button>

            <button
              onClick={onOpenDeckBuilder}
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 font-semibold text-sm sm:text-base shadow transition transform hover:-translate-y-0.5"
            >
              <Layers className="w-4 h-4 text-sky-400" />
              デッキを構築する
            </button>

            <button
              onClick={() => document.getElementById('spectate-room')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-sky-950/80 hover:bg-sky-900 border border-sky-700/70 text-sky-200 font-semibold text-sm sm:text-base shadow transition transform hover:-translate-y-0.5"
            >
              <Eye className="w-4 h-4" />
              観戦する
            </button>
          </div>
        </div>
      </section>

      {/* 3大メインアクションカード (shadowverse-evolve-app スタイル) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-bold tracking-tight text-white">主な機能を選択</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. デッキビルダー */}
          <div className="bg-slate-900/80 border border-slate-800 hover:border-sky-500/50 rounded-2xl p-6 transition flex flex-col justify-between group shadow-lg hover:shadow-sky-500/10">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-110 transition">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition">
                デッキビルダー
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                全カードプールからキーワード検索や作品別絞り込みが可能。公式デッキ構築ルール（50枚、同名4枚、各上限判定）をリアルタイム自動検証。
              </p>
              <ul className="text-xs text-slate-300 space-y-1 pt-2">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>ギアス・HxH・呪術廻戦対応</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>50枚公式ルール完全自動判定</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>JSONインポート / エクスポート</span>
                </li>
              </ul>
            </div>
            <button
              onClick={onOpenDeckBuilder}
              className="mt-6 w-full py-3 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 border border-sky-500/40 text-sky-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <Layers className="w-4 h-4" />
              <span>デッキを作る</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 2. P2P通信対戦（部屋作成） */}
          <div className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 transition flex flex-col justify-between group shadow-lg hover:shadow-emerald-500/10">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition">
                P2P部屋を作成（Host）
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                PeerJSによるサーバーレス通信。部屋を作成して発行された6文字のルームコードを共有すると、ブラウザ同士で対戦できます。
              </p>
              <ul className="text-xs text-slate-300 space-y-1 pt-2">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>ログイン不要・ルームコードで合流</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>盤面カード・ライフ・APを完全同期</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>チャット ＆ 定型文ピッカー完備</span>
                </li>
              </ul>
            </div>
            <button
              onClick={onHostGame}
              className="mt-6 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20"
            >
              <Users className="w-4 h-4" />
              <span>部屋を作成して対戦</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 3. ソロプレイ（一人回し） */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-slate-950 border-2 border-indigo-500/50 hover:border-indigo-400 rounded-2xl p-6 transition flex flex-col justify-between group shadow-xl relative overflow-hidden">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition">
                  <Play className="w-6 h-6 fill-indigo-400" />
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                  おすすめ・一人回し練習
                </span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition">
                ソロプレイ（一人回し）
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                1台のPCで<strong>Player 1（先攻）とPlayer 2（後攻）を交互に手動切替</strong>しながら操作。初手事故率やレイドコンボの検証に最適です。
              </p>
              <ul className="text-xs text-slate-300 space-y-1 pt-2">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>相手がいなくてもワンクリックで開始</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>右上の操作視点で手番を自由切替</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Undo巻き戻しで分岐プレイを検証</span>
                </li>
              </ul>
            </div>
            <button
              onClick={onStartSolo}
              className="mt-6 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 transform group-hover:scale-[1.01]"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>ソロプレイを開始</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 部屋に参加する (Join Room) 直接入力カード (shadowverse-evolve-app スタイル) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-700/60 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400">
            <LogIn className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">友達の部屋に参加する (Join Room)</h2>
            <p className="text-xs text-slate-400 mt-1">
              ホストから共有された6文字のルームコードで参加できます。
            </p>
          </div>

          <form onSubmit={handleJoinSubmit} className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <label htmlFor="join-room-id" className="sr-only">対戦ルームコード</label>
            <input
              id="join-room-id"
              type="text"
              value={joinRoomInput}
              onChange={(e) => {
                setJoinRoomInput(e.target.value);
                setJoinRoomError(null);
              }}
              placeholder="ルームID（例: ABC123）"
              maxLength={6}
              aria-invalid={joinRoomError ? 'true' : undefined}
              aria-describedby={joinRoomError ? 'join-room-error' : undefined}
              className="flex-1 px-4 py-3 bg-slate-950/80 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
            <button
              type="submit"
              disabled={!joinRoomInput.trim()}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 shrink-0"
            >
              <LogIn className="w-4 h-4" />
              <span>対戦に参加</span>
            </button>
          </form>
          {joinRoomError && (
            <p id="join-room-error" role="alert" className="text-left text-xs text-rose-300">
              {joinRoomError}
            </p>
          )}
        </div>

        <div id="spectate-room" className="bg-sky-950/30 border border-sky-800/70 hover:border-sky-600 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-4 scroll-mt-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-sky-600/20 border border-sky-500/30 text-sky-300">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">対戦を観戦する</h2>
            <p className="text-xs text-slate-400 mt-1">
              対戦参加と同じ6文字のルームコードで観戦できます。
            </p>
          </div>

          <form onSubmit={handleSpectateSubmit} className="space-y-2.5 pt-2">
            <label htmlFor="spectator-room-code" className="sr-only">観戦ルームコード</label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id="spectator-room-code"
                type="text"
                value={spectatorRoomInput}
                onChange={(e) => {
                  setSpectatorRoomInput(e.target.value);
                  setSpectatorRoomError(null);
                }}
                placeholder="ルームID（例: ABC123）"
                maxLength={6}
                aria-invalid={spectatorRoomError ? 'true' : undefined}
                aria-describedby={spectatorRoomError ? 'spectator-room-error' : undefined}
                className="flex-1 px-4 py-3 bg-slate-950/80 border border-sky-900 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
              />
              <button
                type="submit"
                disabled={!spectatorRoomInput.trim()}
                className="px-6 py-3 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-40 disabled:hover:bg-sky-700 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-sky-700/20 shrink-0"
              >
                <Eye className="w-4 h-4" />
                <span>観戦を開始</span>
              </button>
            </div>
            {spectatorRoomError && (
              <p id="spectator-room-error" role="alert" className="text-left text-xs text-rose-300">
                {spectatorRoomError}
              </p>
            )}
          </form>
        </div>
      </section>

      {/* プリセットデッキ選択（ワンクリックスタート） */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">クイックスタート（プリセットデッキ）</h2>
          </div>
          <span className="text-xs text-slate-400">公式ルール合致済みのデッキを選んですぐに遊べます</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {presetDecks === null
            ? Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  aria-hidden="true"
                  className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60"
                />
              ))
            : presetDecks.map((preset: PresetDeckInfo) => (
            <div
              key={preset.id}
              className={`rounded-2xl border p-5 transition flex flex-col justify-between shadow-lg ${preset.colorClass}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300">
                    {preset.title}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">50枚デッキ</span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">{preset.deckName}</h3>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{preset.description}</p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-semibold text-slate-400">主な特徴:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {preset.keyFeatures.map((feat, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700 text-slate-200"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <span className="text-xs font-semibold text-slate-300">
                  主力: <strong className="text-white">{preset.leadCardName}</strong>
                </span>
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      onSelectPresetDeck(preset.deck, 'solo');
                    }}
                    className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-1 shadow"
                    title="このデッキを選んでソロプレイ（一人回し）を開始"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    ソロで試す
                  </button>
                  <button
                    onClick={() => {
                      onSelectPresetDeck(preset.deck, 'p2p');
                    }}
                    className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs transition flex items-center justify-center gap-1 shadow"
                    title="このデッキを選んでP2P通信対戦の部屋を作成"
                  >
                    <Users className="w-3 h-3" />
                    P2P対戦
                  </button>
                </div>
              </div>
            </div>
            ))}
        </div>
      </section>

      {/* オフィシャルルール Ver 1.1 インタラクティブガイド */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">オフィシャルルール Ver 1.1 ガイド</h2>
          </div>
          <a
            href="https://www.unionarena-tcg.com/jp/pdf/rule_manual.pdf?20230818"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition"
          >
            <span>公式ルールマニュアル (PDF)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* ルールタブ切り替え */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800/60 text-xs">
          <button
            onClick={() => setActiveRuleTab('basics')}
            className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 ${
              activeRuleTab === 'basics'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            基本ルール & 初期配置
          </button>
          <button
            onClick={() => setActiveRuleTab('phases')}
            className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 ${
              activeRuleTab === 'phases'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            ターンの流れとフェイズ
          </button>
          <button
            onClick={() => setActiveRuleTab('raid')}
            className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 ${
              activeRuleTab === 'raid'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            レイド（RAID）の仕組み
          </button>
          <button
            onClick={() => setActiveRuleTab('battle')}
            className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 ${
              activeRuleTab === 'battle'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            バトル・トリガー・勝利条件
          </button>
        </div>

        {/* タブコンテンツ */}
        <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-4">
          {activeRuleTab === 'basics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> 勝利条件
                  </h4>
                  <p className="text-xs text-slate-300">
                    相手のライフ7枚をすべて削り切り、ライフが0枚の相手プレイヤーにバトルまたは効果でダメージを与えることで勝利となります。
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-sky-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" /> デッキ構築条件
                  </h4>
                  <p className="text-xs text-slate-300">
                    ちょうど50枚。同一カード番号は最大4枚まで。同一の作品コード（CGHやHTRなど）で統一。SPECIAL・COLOR・FINALトリガーは各最大4枚まで。
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-emerald-300">初期準備フロー</h4>
                <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300">
                  <li>ダイスやじゃんけんで先攻・後攻を決定</li>
                  <li>山札の上から7枚を手札として引く</li>
                  <li><strong>マリガン（引き直し）</strong>：手札が気に入らない場合、1回だけ手札7枚を横に置き、新たに山札から7枚引いてから、横の7枚を山札に戻してシャッフル</li>
                  <li>マリガン終了後、山札の上から7枚を裏向きで「ライフ」にセット</li>
                  <li>準備完了でお互いにゲーム開始</li>
                </ol>
              </div>
            </div>
          )}

          {activeRuleTab === 'phases' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <h4 className="font-bold text-indigo-300 text-xs sm:text-sm">1. スタートフェイズ</h4>
                <p className="text-xs text-slate-300">
                  ・<strong>リロールステップ</strong>：自分の場のレスト状態のキャラ・フィールドをすべてアクティブにする。<br />
                  ・<strong>ドローステップ</strong>：山札からカードを1枚引く（※先攻の第1ターンのみドローなし）。<br />
                  ・<strong>APステップ</strong>：APを全回復する（1ターン目: 1AP, 2ターン目: 2AP, 3ターン目以降: 3AP）。
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <h4 className="font-bold text-sky-300 text-xs sm:text-sm">2. 移動フェイズ</h4>
                <p className="text-xs text-slate-300">
                  エナジーラインにいるキャラを、フロントラインの空いている枠に移動させることができます（AP消費なし・1枠につき1ターン1回まで）。
                  ※原則としてフロントラインからエナジーラインへの移動はできません（特徴「ステップ」を持つキャラのみ可能）。
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <h4 className="font-bold text-amber-300 text-xs sm:text-sm">3. メインフェイズ</h4>
                <p className="text-xs text-slate-300">
                  APと必要エナジーを消費して、以下の行動を自由な順番・回数で行えます：<br />
                  ・<strong>キャラ登場</strong>：必要エナジーを満たして手札から配置（通常は<strong>レスト状態で配置</strong>）。<br />
                  ・<strong>レイド登場</strong>：指定されたキャラの上に重ねて配置（<strong>アクティブ状態で配置</strong>）。<br />
                  ・<strong>イベント・フィールド使用</strong>：効果を発揮。<br />
                  ・<strong>アタック宣言</strong>：フロントラインのアクティブキャラをレストにしてアタック。<br />
                  ・<strong>エクストラドロー</strong>：1APを消費して山札から1枚引く。
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <h4 className="font-bold text-purple-300 text-xs sm:text-sm">4. エンドフェイズ</h4>
                <p className="text-xs text-slate-300">
                  「ターン終了時」に有効な効果を処理し、相手プレイヤーにターンが移ります。
                </p>
              </div>
            </div>
          )}

          {activeRuleTab === 'raid' && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <h4 className="font-bold text-rose-300 text-sm">レイド（RAID）の基本ルール</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                【レイド】を持つキャラクターは、指定された名称のキャラ（レイドベース）の上に重ねて登場させることができます。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <strong className="text-indigo-300">① アクティブで登場</strong>
                  <p className="text-slate-400">
                    通常キャラクターはレスト状態で登場しますが、レイドキャラは元のキャラの状態に関わらず<strong>アクティブ状態で登場</strong>し、そのターン中にすぐアタックできます！
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <strong className="text-indigo-300">② エナジーLからフロントLへ</strong>
                  <p className="text-slate-400">
                    エナジーラインにいる対象キャラに重ねて、そのままフロントラインの空き枠に登場させる奇襲が可能です。
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <strong className="text-indigo-300">③ 退場時の処理</strong>
                  <p className="text-slate-400">
                    レイドキャラがバトルや効果で退場するとき、下に重ねられていたカード（レイド元）も一緒に場外へ送られます。
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <strong className="text-indigo-300">④ 通常登場も可能</strong>
                  <p className="text-slate-400">
                    レイド元が場にいない場合でも、必要エナジーとAPを満たせば通常のキャラクターとして登場させることができます（その場合は通常通りレストで登場）。
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeRuleTab === 'battle' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-amber-300 text-sm">バトルとBP判定のルール</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  フロントラインのアクティブなキャラをレストにすることでアタックを宣言できます。
                  対象は「相手プレイヤー」または「相手のレスト状態のキャラ」です。
                </p>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1 text-slate-300">
                  <p><strong>BP比較</strong>：アタック側のBPがブロック/対象キャラのBP「以上」であればアタック側が勝利し、敗北したキャラは退場（場外送り）となります。</p>
                  <p className="text-slate-400">※同BPの場合はアタック側が勝利します（公式ルール準拠）。</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-indigo-300 text-sm">トリガーチェック</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  プレイヤーにアタックが通るとライフが1減少し、ライフのカードを公開して「トリガー」を確認します：
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-sky-300">DRAW</strong>
                    <p className="text-[11px] text-slate-400">カードを1枚引く</p>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-emerald-300">GET</strong>
                    <p className="text-[11px] text-slate-400">めくったカードを手札へ</p>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-amber-300">ACTIVE</strong>
                    <p className="text-[11px] text-slate-400">場のキャラ1体をアクティブ</p>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-purple-300">RAID</strong>
                    <p className="text-[11px] text-slate-400">手札からレイド即時登場</p>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-indigo-300">COLOR</strong>
                    <p className="text-[11px] text-slate-400">色固有の強力効果</p>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-rose-300">SPECIAL</strong>
                    <p className="text-[11px] text-slate-400">相手キャラ強制退場など</p>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 col-span-2">
                    <strong className="text-yellow-300">FINAL</strong>
                    <p className="text-[11px] text-slate-400">APカードをアクティブ（回復）</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* よくある質問 (FAQ) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-bold tracking-tight text-white">よくある質問 & 操作ヒント</h2>
        </div>

        <div className="space-y-2">
          {[
            {
              q: 'ソロプレイで相手の動きも自分でテストできますか？',
              a: 'はい！ヘッダー右上の「操作プレイヤー: [Player 1] / [Player 2]」を切り替えることで、1台のPCで先攻・後攻両方の手札や盤面を切り替えながら一人回し検証が可能です。',
            },
            {
              q: 'P2P通信対戦で友達と対戦するには？',
              a: '「P2Pオンライン対戦」ボタンから「部屋を作成する（Host）」を押し、発行された6文字のルームコードを対戦相手に共有します。相手がホーム画面でコードを入力すると盤面がリアルタイム同期されます。',
            },
            {
              q: '山札から好きなカードを探したり、トップを確認するには？',
              a: '盤面右上の山札（DECK）エリアにある「上を見る（1〜5枚）」ボタンでルルーシュ等の効果を再現できます。また「探す」ボタンで山札全体から特定カードを手札や場外に移動できます。',
            },
            {
              q: '間違えてカードを移動させてしまった場合は戻せますか？',
              a: 'ツールバーの「Undo」ボタンを押すことで、直近30手までの操作をいつでも一手前に安全に巻き戻すことができます。',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden transition"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full flex items-center justify-between p-4 text-left font-bold text-xs sm:text-sm text-slate-200 hover:text-white"
              >
                <span>{item.q}</span>
                {expandedFaq === idx ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>
              {expandedFaq === idx && (
                <div className="p-4 pt-0 text-xs text-slate-400 border-t border-slate-800/40 leading-relaxed bg-slate-950/30">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* フッター */}
      <footer className="pt-8 border-t border-slate-800/80 text-center text-xs text-slate-400 space-y-2">
        <p>UNION ARENA Web Simulator - A Fan-made Sandbox Simulator</p>
        <p className="text-[11px] text-slate-400">
          ※本シミュレータはファンによる非公式のオープンソースプロジェクトであり、株式会社バンダイ様および各版権元様とは一切関係ありません。
        </p>
      </footer>
    </div>
  );
};
