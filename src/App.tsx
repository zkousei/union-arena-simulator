import React, { Suspense, lazy, useState, useEffect, useRef, useCallback } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Routes, Route, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from './hooks/useGame';
import { ActionToolbar } from './components/controls/ActionToolbar';
import { PreGameBar } from './components/controls/PreGameBar';
import { GameLog } from './components/log/GameLog';
import { PeerModal } from './components/peer/PeerModal';
import { RestoreSessionModal } from './components/modals/RestoreSessionModal';
import { HomePage } from './pages/Home';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import type { UserDeck } from './domain/deckValidation';
import { loadSavedHostSession, clearHostSession, type SavedHostSession } from './domain/hostSessionStorage';
import { normalizeRoomId } from './domain/roomId';
import {
  Swords,
  Layers,
  UserCheck,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Home,
  Volume2,
  VolumeX,
  Users,
  Wifi,
  ChevronDown,
  Play,
  Copy,
  Check,
  LogOut,
  LogIn,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { sound } from './utils/audio';
import { isSoloGameRoute } from './utils/gameMode';
import {
  redactVercelAnalyticsEvent,
  shouldEnableVercelAnalytics,
} from './utils/vercelAnalytics';

const Board = lazy(() =>
  import('./components/board/Board').then((module) => ({ default: module.Board }))
);
const DeckBuilderPage = lazy(() =>
  import('./pages/DeckBuilder').then((module) => ({ default: module.DeckBuilderPage }))
);
const SavedDeckPickerModal = lazy(() =>
  import('./components/modals/SavedDeckPickerModal').then((module) => ({
    default: module.SavedDeckPickerModal,
  }))
);

// ヘッダーナビゲーション (shadowverse-evolve-app の AppNavigation を参考)
interface AppNavigationProps {
  onSoloPlay: () => void;
  onHostGame: () => Promise<void>;
  onJoinGame: (roomId: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenHelp: () => void;
  onOpenPeerModal: () => void;
  peer: ReturnType<typeof useGame>['peer'];
  isHost: boolean;
  isHosting?: boolean;
  currentRoomId: string | null;
  activePlayerId?: string;
  activePlayerName?: string;
}

function AppNavigation({
  onSoloPlay,
  onHostGame,
  onJoinGame,
  soundEnabled,
  onToggleSound,
  onOpenHelp,
  onOpenPeerModal,
  peer,
  isHost,
  isHosting = false,
  currentRoomId,
  activePlayerId,
  activePlayerName,
}: AppNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const isDeckBuilder = location.pathname === '/deck-builder';
  const isGame = location.pathname === '/game';

  const playMenuRef = useRef<HTMLDivElement | null>(null);
  const [isPlayMenuOpen, setIsPlayMenuOpen] = useState(false);
  const [navJoinId, setNavJoinId] = useState('');
  const [copied, setCopied] = useState(false);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!isPlayMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (playMenuRef.current && !playMenuRef.current.contains(event.target as Node)) {
        setIsPlayMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPlayMenuOpen(false);
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlayMenuOpen]);

  // 画面遷移時にメニューを閉じる
  useEffect(() => {
    setIsPlayMenuOpen(false);
    setNavJoinId('');
  }, [location.pathname, location.search]);

  const handleNavJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = navJoinId.trim();
    if (!trimmed) return;

    const roomId = normalizeRoomId(trimmed);
    if (!roomId) return;
    setIsPlayMenuOpen(false);
    onJoinGame(roomId);
  };

  const handleDisconnect = () => {
    if (currentRoomId) {
      clearHostSession(currentRoomId);
    }
    peer.endSession();
    navigate('/game?mode=solo', { replace: true });
  };

  const handleCopyRoomCode = () => {
    if (!currentRoomId) return;
    navigator.clipboard.writeText(currentRoomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="flex items-center justify-between px-2 sm:px-4 py-2 bg-slate-900 border-b border-slate-800 shadow-md z-40">
      <div className="flex items-center gap-1 sm:gap-4 min-w-0">
        {/* ロゴ / タイトル */}
        <Link
          to="/"
          className="flex items-center gap-2 group text-decoration-none"
          title="ホームへ移動"
        >
          <div className="bg-indigo-600 p-1.5 rounded-lg shadow-md shadow-indigo-500/30 group-hover:bg-indigo-500 transition">
            <Swords className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-extrabold text-xs sm:text-sm tracking-wide bg-gradient-to-r from-indigo-300 via-sky-300 to-indigo-100 bg-clip-text text-transparent group-hover:brightness-125 transition">
              UNION ARENA Web Simulator
            </h1>
            <span className="text-[10px] text-slate-400">Ver 1.1 公式準拠</span>
          </div>
        </Link>

        {/* ナビゲーションリンク */}
        <nav className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <Link
            to="/"
            aria-label="ホーム"
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg font-bold transition ${
              isHome
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">ホーム</span>
          </Link>
          <Link
            to="/deck-builder"
            aria-label="デッキ構築"
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg font-bold transition ${
              isDeckBuilder
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">デッキ構築</span>
          </Link>
          <Link
            to="/game?mode=solo"
            aria-label="対戦盤面"
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg font-bold transition ${
              isGame
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">対戦盤面</span>
          </Link>
        </nav>

        {/* Play (対戦) ドロップダウンメニュー (shadowverse-evolve-app スタイル) */}
        <div ref={playMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsPlayMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isPlayMenuOpen}
            aria-label="対戦メニュー"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition"
          >
            <Play className="w-3 h-3 fill-white" />
            <span className="hidden xl:inline">対戦メニュー</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isPlayMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isPlayMenuOpen && (
            <div
              role="menu"
              className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl p-3 space-y-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="text-[10px] font-bold text-slate-400 px-1 uppercase tracking-wider">
                対戦モードを選択
              </div>

              {/* 1. ソロプレイ */}
              <button
                type="button"
                onClick={() => {
                  setIsPlayMenuOpen(false);
                  onSoloPlay();
                }}
                className="w-full p-2.5 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-700/40 text-left transition flex items-center gap-2.5 text-xs text-indigo-200 font-bold group"
              >
                <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
                <div>
                  <div className="text-white">🎮 ソロプレイ（一人回し）</div>
                  <div className="text-[10px] text-slate-400 font-normal">1台2役で先攻・後攻を交互に操作</div>
                </div>
              </button>

              {/* 2. 部屋作成 (Host) */}
              <button
                type="button"
                disabled={isHosting}
                onClick={async () => {
                  setIsPlayMenuOpen(false);
                  await onHostGame();
                }}
                className="w-full p-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-700/40 text-left transition flex items-center gap-2.5 text-xs text-emerald-200 font-bold group disabled:opacity-60"
              >
                <div className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition">
                  {isHosting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <div className="text-white">
                    {isHosting ? '🌐 部屋を作成中...' : '🌐 部屋を作成 (Host)'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    {isHosting ? '接続を確立しています...' : 'ルームコードを共有して通信対戦'}
                  </div>
                </div>
              </button>

              {/* 3. 部屋参加 (Join) */}
              <form onSubmit={handleNavJoinSubmit} className="pt-2 border-t border-slate-800 space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <LogIn className="w-3 h-3 text-emerald-400" />
                  <span>部屋に参加 (Join)</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={navJoinId}
                    onChange={(e) => setNavJoinId(e.target.value)}
                    placeholder="ルームID（例: ABC123）"
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!navJoinId.trim()}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition shrink-0"
                  >
                    参加
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* 右側: ゲーム中ステータス & サウンド & ヘルプ */}
      <div className="flex items-center gap-1 sm:gap-3">
        {/* ゲーム画面ヘッダー要素 */}
        {isGame && (
          <div className="flex items-center gap-2">
            {/* P2P 接続中 */}
            {peer.status === 'connected' ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-[11px] font-bold">
                  <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span className="hidden xl:inline">P2P接続中 ({isHost ? 'ホスト' : peer.role === 'spectator' ? '観戦' : 'ゲスト'})</span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 text-[11px] font-bold transition"
                  title="P2P接続を切断してソロへ戻る"
                >
                  <LogOut className="w-3 h-3" />
                  <span className="hidden xl:inline">切断</span>
                </button>
              </div>
            ) : isHost ? (
              /* P2P ホスト */
              <div className="flex items-center gap-1.5">
                {currentRoomId ? (
                  <>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-950/50 border border-amber-700/50 text-amber-300 text-[11px] font-semibold animate-pulse">
                      <Radio className="w-3 h-3" />
                      <span className="hidden xl:inline">
                        {peer.status === 'reconnecting' ? '再接続待機中' : '相手待機中'}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyRoomCode}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold shadow transition"
                      title="ゲスト・観戦者用のルームコードをコピー"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span className="hidden xl:inline">{copied ? 'コピー済' : 'コード共有'}</span>
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-700/50 text-emerald-300 text-[11px] font-semibold animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                    <span className="hidden xl:inline">部屋を作成中...</span>
                  </div>
                )}
              </div>
            ) : peer.role === 'guest' || peer.role === 'spectator' ? (
              <button
                onClick={onOpenPeerModal}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-700/60 text-amber-300 text-[11px] font-bold"
              >
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span className="hidden xl:inline">再接続中</span>
              </button>
            ) : (
              /* ソロプレイ中 */
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950/50 border border-indigo-700/60 text-indigo-300 text-[11px] font-bold">
                  <span>🎮</span>
                  <span className="hidden xl:inline">ソロプレイ（反転なし）</span>
                </div>

                {/* 現在手番の表示 */}
                <div className="hidden xl:flex items-center bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-xs gap-1.5">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <UserCheck className="w-3 h-3 text-amber-400" />
                    <span className="hidden md:inline">現在手番:</span>
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                    activePlayerId === 'player-1' ? 'bg-indigo-600 text-white shadow' : 'bg-amber-600 text-white shadow'
                  }`}>
                    {activePlayerName || (activePlayerId === 'player-1' ? 'Player 1 (下)' : 'Player 2 (上)')}
                  </span>
                </div>

                <button
                  onClick={onOpenPeerModal}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/40 border border-emerald-700/50 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/40 text-[11px] font-bold transition"
                  title="P2Pオンライン対戦に切り替える"
                >
                  <Users className="w-3 h-3" />
                  <span className="hidden xl:inline">P2P切替</span>
                </button>
              </div>
            )}
          </div>
        )}

        {isGame && isHost && currentRoomId && (
          <button
            type="button"
            onClick={onOpenPeerModal}
            className="hidden items-center gap-1 rounded-lg border border-sky-700/50 bg-sky-950/50 px-2 py-1 text-[11px] font-bold text-sky-300 hover:bg-sky-900/70 sm:flex"
            title="ルームコードと観戦受付を管理"
          >
            <Users className="h-3 w-3" />
            観戦者 {peer.spectatorCount ?? 0} / {peer.maxSpectatorConnections ?? 8}
          </button>
        )}

        {/* サウンドトグル */}
        <button
          onClick={onToggleSound}
          className={`p-1.5 rounded-lg border text-xs transition ${
            soundEnabled
              ? 'bg-indigo-950/40 border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/50'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
          }`}
          title={soundEnabled ? '効果音: ON (クリックでミュート)' : '効果音: OFF (クリックで有効化)'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* 使い方ヘルプ */}
        <button
          onClick={onOpenHelp}
          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
          title="使い方ガイド"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

// ゲーム画面コンポーネント (URLクエリでソロ/ホスト/ゲストをハンドリング)
interface GameViewProps {
  game: ReturnType<typeof useGame>;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenPeerModal: () => void;
  isHosting?: boolean;
}

function GameView({ game, soundEnabled, onToggleSound, onOpenPeerModal, isHosting = false }: GameViewProps) {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const hostParam = searchParams.get('host');
  const roomParam = searchParams.get('room');
  const spectatorParam = searchParams.get('spectator');
  const {
    gameState,
    myPlayerId,
    dispatchAction,
    undo,
    canUndo,
    peer,
    createRoom,
    joinRoom,
    spectateRoom,
    restoreHostSession,
    setHostSessionPending,
    finishHostSessionDecision,
    isSynchronizing,
    isInteractionLocked,
    syncError,
    retrySynchronization,
  } = game;
  // URLが要求する役割を正とする。役割切替直後は前のpeer.roleが1レンダー残るため、
  // peer.roleを混ぜるとゲストURLでホストを再作成してしまう。
  const isHost = hostParam === 'true';
  const isSpectator = mode !== 'solo' && spectatorParam === 'true';

  const [savedSessionCandidate, setSavedSessionCandidate] = useState<SavedHostSession | null>(null);
  const [isSpectatorViewFlipped, setIsSpectatorViewFlipped] = useState(false);
  const checkedRoomRef = useRef<string | null>(null);

  useEffect(() => {
    if (isHost && roomParam && checkedRoomRef.current !== roomParam) {
      checkedRoomRef.current = roomParam;
      const saved = loadSavedHostSession(roomParam);
      if (saved) {
        setHostSessionPending?.(true);
        setSavedSessionCandidate(saved);
      }
    }
  }, [isHost, roomParam, setHostSessionPending]);

  const handleResumeSession = useCallback(() => {
    if (!savedSessionCandidate) return;
    restoreHostSession(savedSessionCandidate.snapshot);
    setSavedSessionCandidate(null);
  }, [restoreHostSession, savedSessionCandidate]);

  const handleDiscardSession = useCallback(() => {
    if (roomParam) {
      clearHostSession(roomParam);
    }
    finishHostSessionDecision?.();
    setSavedSessionCandidate(null);
  }, [finishHostSessionDecision, roomParam]);

  const navigate = useNavigate();
  const [isLogCollapsed, setIsLogCollapsed] = useState(
    () =>
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(max-width: 1023px)').matches
        : false
  );
  const [isDeckPickerOpen, setIsDeckPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFitMode, setIsFitMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ua_fit_mode');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleFitMode = () => {
    setIsFitMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ua_fit_mode', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // URLにゲスト用roomがある場合、自動的に部屋参加を試行
  useEffect(() => {
    if (roomParam && !isHost && !isSpectator && peer.status === 'disconnected' && !peer.error) {
      void joinRoom(roomParam).catch(() => undefined);
    }
  }, [roomParam, isHost, isSpectator, peer.status, peer.error, joinRoom]);

  useEffect(() => {
    if (roomParam && isSpectator && peer.status === 'disconnected' && !peer.error) {
      void spectateRoom(roomParam).catch(() => undefined);
    }
  }, [roomParam, isSpectator, peer.status, peer.error, spectateRoom]);

  // URLにホスト用roomがあるがPeer未作成の場合、作成を試行
  useEffect(() => {
    if (isHost && !isHosting && peer.status === 'disconnected' && !peer.peerId && !peer.error) {
      void createRoom(roomParam || undefined).catch(() => undefined);
    }
  }, [isHost, isHosting, peer.status, peer.peerId, peer.error, createRoom, roomParam]);

  // mode=solo の場合でPeerが繋がっていれば切断（接続試行中は切断しない）
  useEffect(() => {
    if (mode === 'solo' && peer.role !== null && peer.status !== 'connecting') {
      peer.disconnect();
    }
  }, [mode, peer]);

  const playerIds = Object.keys(gameState.players);
  const opponentPlayerId = playerIds.find((id) => id !== myPlayerId) || 'player-2';
  const myPlayer = gameState.players[myPlayerId];
  const opponentPlayer = gameState.players[opponentPlayerId];

  const handleSelectDeck = async (deck: UserDeck, targetPlayerId: string) => {
    const { flattenDeckToCards } = await import('./domain/deckValidation');
    const cards = flattenDeckToCards(deck, targetPlayerId);
    dispatchAction({
      type: 'SETUP_GAME',
      payload: {
        playerId: targetPlayerId,
        deckCards: cards,
        apCards: [],
      },
    });
    sound.playPlace();
  };

  const isSoloMode = isSoloGameRoute(mode, hostParam, roomParam, peer.role);
  const toolbarTargetPlayerId = isSoloMode ? gameState.activePlayerId : myPlayerId;

  const handleSetAllActive = () => {
    dispatchAction({
      type: 'SET_ALL_ACTIVE',
      payload: { playerId: toolbarTargetPlayerId },
    });
  };

  const handleRecoverAp = () => {
    dispatchAction({
      type: 'RECOVER_AP',
      payload: { playerId: toolbarTargetPlayerId },
    });
  };

  const handleDrawCard = () => {
    dispatchAction({
      type: 'DRAW_CARD',
      payload: { playerId: toolbarTargetPlayerId, count: 1 },
    });
  };

  const handleRollDice = () => {
    dispatchAction({
      type: 'ROLL_DICE',
      payload: { playerId: toolbarTargetPlayerId },
    });
  };

  const handleMulligan = (targetPlayerId: string = myPlayerId) => {
    dispatchAction({
      type: 'MULLIGAN',
      payload: { playerId: targetPlayerId },
    });
  };

  const handleKeepHand = (targetPlayerId: string = myPlayerId) => {
    dispatchAction({
      type: 'KEEP_HAND',
      payload: { playerId: targetPlayerId },
    });
  };

  const handlePlaceInitialLife = (targetPlayerId: string = myPlayerId) => {
    dispatchAction({
      type: 'PLACE_INITIAL_LIFE',
      payload: { playerId: targetPlayerId, count: 7 },
    });
  };

  const handleToggleReady = (targetPlayerId: string = myPlayerId) => {
    const p = gameState.players[targetPlayerId];
    if (!p) return;
    dispatchAction({
      type: 'SET_READY',
      payload: { playerId: targetPlayerId, isReady: !p.isReady },
    });
  };

  const handleSetFirstPlayer = (firstPlayerId: string) => {
    dispatchAction({
      type: 'SET_FIRST_PLAYER',
      payload: { firstPlayerId },
    });
  };

  const handleStartGame = () => {
    dispatchAction({ type: 'START_GAME' });
  };

  const handleResetGame = () => {
    if (window.confirm('ゲーム盤面を初期状態にリセットしますか？')) {
      dispatchAction({
        type: 'INIT_GAME',
        payload: {
          player1Id: 'player-1',
          player1Name: 'Player 1',
          player2Id: 'player-2',
          player2Name: 'Player 2',
          activePlayerId: 'player-1',
        },
      });
    }
  };

  const copyRoomCode = () => {
    const roomId = peer.peerId || roomParam;
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEndPeerSession = () => {
    if (roomParam) {
      clearHostSession(roomParam);
    }
    peer.endSession();
    navigate('/game?mode=solo', { replace: true });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* P2Pホスト用の対戦・観戦招待導線 */}
      {isHost && (peer.peerId || roomParam) && (
        <div className="z-20 flex flex-col gap-2 border-b border-sky-700/40 bg-gradient-to-r from-emerald-950/70 via-slate-900/95 to-sky-950/70 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 font-semibold text-slate-200">
            <Radio className={`h-4 w-4 shrink-0 ${peer.status === 'waiting' ? 'animate-pulse text-amber-400' : 'text-emerald-400'}`} />
            <span className="truncate">
              {peer.status === 'waiting' ? '対戦相手を待機中' : 'P2P対戦ルーム'}
            </span>
            <span className="shrink-0 rounded border border-slate-600 bg-slate-950/70 px-2 py-0.5 font-mono text-[11px] tracking-widest text-white">
              ルームID {peer.peerId || roomParam}
            </span>
            <button
              type="button"
              onClick={onOpenPeerModal}
              className="shrink-0 rounded-full border border-sky-700/60 bg-sky-950/70 px-2 py-0.5 text-[10px] font-bold text-sky-300 hover:bg-sky-900"
            >
              観戦者 {peer.spectatorCount} / {peer.maxSpectatorConnections}
            </button>
          </div>
          <div className="flex">
            <button
              onClick={copyRoomCode}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 font-bold text-white shadow transition hover:bg-emerald-600"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'ルームコードをコピー済み' : 'ルームコードをコピー'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 試合前準備バー or 対戦中クイックアクションバー */}
      {isSpectator ? (
        <div className="flex items-center justify-center gap-3 border-b border-sky-700/40 bg-sky-950/50 px-4 py-2 text-xs font-bold text-sky-200">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            観戦中 — Player 1 / Player 2 の公開盤面を表示しています
          </span>
          <button
            type="button"
            onClick={() => setIsSpectatorViewFlipped((current) => !current)}
            className="rounded-lg border border-sky-600/60 bg-sky-900/60 px-2 py-1 text-[11px] text-sky-100 hover:bg-sky-800/70"
          >
            視点を反転
          </button>
        </div>
      ) : gameState.status === 'PREPARING' && myPlayer && opponentPlayer ? (
        <PreGameBar
          myPlayer={myPlayer}
          opponentPlayer={opponentPlayer}
          firstPlayerId={gameState.firstPlayerId}
          onSetFirstPlayer={handleSetFirstPlayer}
          onOpenDeckPicker={() => setIsDeckPickerOpen(true)}
          onMulligan={(targetPlayerId) => handleMulligan(targetPlayerId || myPlayerId)}
          onKeepHand={(targetPlayerId) => handleKeepHand(targetPlayerId || myPlayerId)}
          onPlaceLife={(targetPlayerId) => handlePlaceInitialLife(targetPlayerId || myPlayerId)}
          onToggleReady={(targetPlayerId) => handleToggleReady(targetPlayerId || myPlayerId)}
          onStartGame={handleStartGame}
          onRollDice={handleRollDice}
          isSoloMode={isSoloMode}
        />
      ) : (
        <ActionToolbar
          onSetupDeck={() => setIsDeckPickerOpen(true)}
          onDrawCard={handleDrawCard}
          onSetAllActive={handleSetAllActive}
          onRecoverAp={handleRecoverAp}
          onRollDice={handleRollDice}
          onResetGame={handleResetGame}
          onUndo={undo}
          canUndo={canUndo}
          soundEnabled={soundEnabled}
          onToggleSound={onToggleSound}
          onOpenPeerModal={onOpenPeerModal}
          peerStatus={peer.status}
          isHost={peer.isHost}
          isFitMode={isFitMode}
          onToggleFitMode={handleToggleFitMode}
        />
      )}

      {/* メイン対戦盤面 & ログパネル */}
      <main className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* ボード領域 */}
        <div className="flex-1 min-w-0 h-full overflow-y-auto">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                盤面を読み込んでいます...
              </div>
            }
          >
            <Board
              gameState={gameState}
              myPlayerId={myPlayerId}
              dispatchAction={dispatchAction}
              onOpenDeckPicker={() => setIsDeckPickerOpen(true)}
              isSoloMode={isSoloMode}
              isSpectator={isSpectator}
              spectatorFlipped={isSpectatorViewFlipped}
              isFitMode={isFitMode}
              onUndo={undo}
              canUndo={canUndo}
            />
          </Suspense>
        </div>

        {/* 対戦行動ログサイドバー */}
        <div
          className={`inset-y-0 right-0 z-30 transition-all duration-300 ease-in-out border-l border-slate-800 bg-slate-900/95 flex flex-col h-full ${
            isLogCollapsed
              ? 'relative w-10 shrink-0'
              : 'absolute lg:relative w-[min(20rem,calc(100vw-2rem))] lg:w-96 shadow-2xl lg:shadow-none'
          }`}
        >
          <div className="flex items-center justify-between p-2 border-b border-slate-800">
            <button
              onClick={() => setIsLogCollapsed(!isLogCollapsed)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
              title={isLogCollapsed ? 'ログを開く' : 'ログを閉じる'}
            >
              {isLogCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {!isLogCollapsed && (
              <span className="text-[11px] font-bold text-slate-400">行動ログ</span>
            )}
          </div>
          {!isLogCollapsed && (
            <div className="flex-1 overflow-hidden p-2">
              <GameLog
                logs={gameState.logs}
                myPlayerId={myPlayerId}
                myPlayerName={myPlayer?.name || 'あなた'}
                onSendChat={isSpectator ? undefined : (text) => {
                  dispatchAction({
                    type: 'CHAT_MESSAGE',
                    payload: {
                      senderId: myPlayerId,
                      senderName: myPlayer?.name || 'あなた',
                      text,
                    },
                  });
                }}
              />
            </div>
          )}
        </div>
      </main>

      {isInteractionLocked && peer.role !== null && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-600/50 bg-slate-900 p-5 text-center shadow-2xl">
            <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-amber-400" />
            <h2 className="text-base font-bold text-white">
              {isSynchronizing
                ? isSpectator ? '観戦盤面を同期しています' : '盤面を再同期しています'
                : peer.role === 'host' && peer.status === 'connecting'
                  ? '対戦部屋を作成しています'
                  : isSpectator ? '観戦ルームへ再接続しています' : '対戦相手との接続を復旧しています'}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {peer.role === 'host' && peer.status === 'connecting'
                ? 'シグナリングサーバーと接続しています。しばらくお待ちください。'
                : isSpectator
                  ? '最新の公開盤面を取得しています。画面を閉じずにお待ちください。'
                  : '同期が完了するまでゲーム操作を一時停止します。画面を閉じずにお待ちください。'}
            </p>
            {(peer.error || syncError) && (
              <p className="mt-3 rounded-lg border border-rose-800/60 bg-rose-950/50 p-2 text-xs text-rose-300">
                {syncError || peer.error}
              </p>
            )}
            <div className="mt-4 flex justify-center gap-2">
              {(peer.role === 'guest' || peer.role === 'spectator') && (
                <button
                  type="button"
                  onClick={() => void retrySynchronization()}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500"
                >
                  再試行
                </button>
              )}
              <button
                type="button"
                onClick={handleEndPeerSession}
                className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
              >
                {isSpectator ? '観戦を終了' : '対戦を終了'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* デッキ選択モーダル（保存済みマイデッキ & 公式プリセット） */}
      <Suspense fallback={null}>
        <SavedDeckPickerModal
          isOpen={isDeckPickerOpen}
          onClose={() => setIsDeckPickerOpen(false)}
          onSelectDeck={handleSelectDeck}
          myPlayerId={myPlayerId}
          isSoloMode={isSoloMode}
          player1Name={gameState.players['player-1']?.name || 'Player 1'}
          player2Name={gameState.players['player-2']?.name || 'Player 2'}
          onNavigateToDeckBuilder={() => navigate('/deck-builder')}
        />
      </Suspense>

      {/* 対戦セッション復元モーダル */}
      {savedSessionCandidate && (
        <RestoreSessionModal
          session={savedSessionCandidate}
          onResume={handleResumeSession}
          onDiscard={handleDiscardSession}
        />
      )}
    </div>
  );
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const game = useGame();
  const {
    myPlayerId,
    dispatchAction,
    peer,
    createRoom,
    joinRoom,
    spectateRoom,
  } = game;

  const [isPeerModalOpen, setIsPeerModalOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const handleToggleSound = () => {
    const enabled = sound.toggleSound();
    setSoundEnabled(enabled);
  };

  // URLに ?room=xxx が含まれている場合に自動で /game?host=false&room=xxx へリダイレクト
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    const host = params.get('host');
    if (room && host !== 'true' && location.pathname !== '/game') {
      navigate(`/game?host=false&room=${encodeURIComponent(room)}`);
    }
  }, [location, navigate]);

  const [isHosting, setIsHosting] = useState(false);

  // ルーム作成（ホスト）
  const handleHostGame = useCallback(async () => {
    if (peer.role === 'host' && peer.peerId) {
      navigate(`/game?host=true&room=${encodeURIComponent(peer.peerId)}`);
      return;
    }

    try {
      setIsHosting(true);
      navigate('/game?host=true');
      const roomId = await createRoom();
      navigate(`/game?host=true&room=${encodeURIComponent(roomId)}`, { replace: true });
    } catch (err) {
      console.error('Failed to create room:', err);
      setIsPeerModalOpen(true);
    } finally {
      setIsHosting(false);
    }
  }, [peer.role, peer.peerId, createRoom, navigate]);

  // ルーム参加（ゲスト）
  const handleJoinGame = useCallback((roomId: string) => {
    if (peer.role !== null) {
      peer.endSession();
    }
    navigate(`/game?host=false&room=${encodeURIComponent(roomId)}`);
    void joinRoom(roomId).catch(() => undefined);
  }, [joinRoom, navigate, peer]);

  const handleSpectateGame = useCallback((roomId: string) => {
    if (peer.role !== null) {
      peer.endSession();
    }
    navigate(`/game?spectator=true&room=${encodeURIComponent(roomId)}`);
    void spectateRoom(roomId).catch(() => undefined);
  }, [navigate, peer, spectateRoom]);

  // ソロプレイ開始
  const handleSoloPlay = useCallback(() => {
    const activeRoom = peer.peerId || peer.lastRoomId || new URLSearchParams(window.location.search).get('room');
    if (activeRoom) {
      clearHostSession(activeRoom);
    }
    if (peer.role !== null) {
      peer.endSession();
    }
    navigate('/game?mode=solo');
  }, [peer, navigate]);

  // デッキ選択してゲーム開始
  const handlePlayWithCustomDeck = useCallback(
    async (deck: UserDeck, targetMode: 'solo' | 'p2p' = 'solo') => {
      const { flattenDeckToCards } = await import('./domain/deckValidation');
      const customCards = flattenDeckToCards(deck, myPlayerId);
      dispatchAction({
        type: 'SETUP_GAME',
        payload: {
          playerId: myPlayerId,
          deckCards: customCards,
          apCards: [],
        },
      });
      if (targetMode === 'p2p') {
        handleHostGame();
      } else {
        handleSoloPlay();
      }
    },
    [dispatchAction, myPlayerId, handleHostGame, handleSoloPlay]
  );

  // 現在の部屋コード取得
  const [searchParams] = useSearchParams();
  const currentRoomId = peer.peerId || searchParams.get('room');
  const isHost = searchParams.get('host') === 'true';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* 統一グローバルナビゲーションバー */}
      <AppNavigation
        onSoloPlay={handleSoloPlay}
        onHostGame={handleHostGame}
        onJoinGame={handleJoinGame}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenHelp={() => setShowHelpModal(true)}
        onOpenPeerModal={() => setIsPeerModalOpen(true)}
        peer={peer}
        isHost={isHost}
        isHosting={isHosting}
        currentRoomId={currentRoomId}
        activePlayerId={game.gameState.activePlayerId}
        activePlayerName={game.gameState.players[game.gameState.activePlayerId]?.name || (game.gameState.activePlayerId === 'player-1' ? 'Player 1' : 'Player 2')}
      />

      {/* URLルーティング (React Router) */}
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              onStartSolo={handleSoloPlay}
              onHostGame={handleHostGame}
              onJoinGame={handleJoinGame}
              onSpectateGame={handleSpectateGame}
              onOpenDeckBuilder={() => navigate('/deck-builder')}
              onSelectPresetDeck={handlePlayWithCustomDeck}
            />
          }
        />
        <Route
          path="/deck-builder"
          element={
            <RouteErrorBoundary>
              <Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                    デッキビルダーを読み込んでいます...
                  </div>
                }
              >
                <DeckBuilderPage onPlayWithDeck={handlePlayWithCustomDeck} />
              </Suspense>
            </RouteErrorBoundary>
          }
        />
        <Route
          path="/game"
          element={
            <GameView
              game={game}
              soundEnabled={soundEnabled}
              onToggleSound={handleToggleSound}
              onOpenPeerModal={() => setIsPeerModalOpen(true)}
              isHosting={isHosting}
            />
          }
        />
      </Routes>

      {/* P2P通信対戦モーダル（詳細設定・QR/URLコピー用） */}
      <PeerModal
        peer={peer}
        isOpen={isPeerModalOpen}
        onClose={() => setIsPeerModalOpen(false)}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onDisconnect={() => {
          peer.endSession();
          if (location.pathname === '/game') {
            navigate('/game?mode=solo', { replace: true });
          }
        }}
      />

      {/* 使い方ヘルプモーダル */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-indigo-300">オフィシャルルール Ver 1.1 ガイド</h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded"
              >
                閉じる
              </button>
            </div>
            <div className="space-y-2 text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <p>
                <strong>1. 画面の遷移:</strong> 上部ヘッダーの「対戦メニュー」からいつでも
                「ソロプレイ」「部屋を作成」「部屋に参加」に1クリックで移動できます。
              </p>
              <p>
                <strong>2. デッキ構築:</strong> ヘッダーの「デッキ構築」からカードプールを検索し、50枚デッキを作成・保存できます。完成したデッキですぐに対戦盤面へ持ち込めます。
              </p>
              <p>
                <strong>3. 試合前フロー:</strong> 手番（先攻・後攻）を決め、「デッキセット」で初手7枚を引きます。必要に応じて「マリガン（手札7枚引き直し、1回のみ）」を行ったあと、山札の上からライフ7枚を配置し、「準備完了（Ready）」を押して「対戦開始」します。
              </p>
              <p>
                <strong>4. 山札サーチ & トップ確認:</strong> 山札エリアの「上を見る」「探す」ボタンから、ルルーシュ効果等の山札操作や特定カードの手札回収が可能です。
              </p>
              <p>
                <strong>5. Undo & サウンド:</strong> ツールバーの「Undo」で1手前の盤面に戻せます。スピーカーアイコンでSEのON/OFFが可能です。
              </p>
            </div>
          </div>
        </div>
      )}

      {shouldEnableVercelAnalytics(import.meta.env) && (
        <Analytics beforeSend={redactVercelAnalyticsEvent} debug={false} />
      )}
    </div>
  );
}

export default App;
