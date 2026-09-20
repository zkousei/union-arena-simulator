import { useState, useEffect } from 'react';
import { useGame } from './hooks/useGame';
import { Board } from './components/board/Board';
import { ActionToolbar } from './components/controls/ActionToolbar';
import { PreGameBar } from './components/controls/PreGameBar';
import { GameLog } from './components/log/GameLog';
import { PeerModal } from './components/peer/PeerModal';
import { DeckBuilderPage } from './pages/DeckBuilder';
import { HomePage } from './pages/Home';
import { generateSampleDeck } from './data/sampleDeck';
import { UserDeck, flattenDeckToCards } from './domain/deckValidation';
import { Swords, Layers, UserCheck, HelpCircle, ChevronRight, ChevronLeft, Home, Volume2, VolumeX, Users, Wifi } from 'lucide-react';
import { sound } from './utils/audio';

export function App() {
  const {
    gameState,
    myPlayerId,
    setMyPlayerId,
    dispatchAction,
    undo,
    canUndo,
    peer,
    createRoom,
    joinRoom,
  } = useGame();

  const [currentView, setCurrentView] = useState<'home' | 'game' | 'deckBuilder'>('home');
  const [isPeerModalOpen, setIsPeerModalOpen] = useState(false);
  const [isLogCollapsed, setIsLogCollapsed] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const handleToggleSound = () => {
    const enabled = sound.toggleSound();
    setSoundEnabled(enabled);
  };

  // URLに ?room=xxx が含まれているか確認して自動入力
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && peer.status === 'disconnected') {
      setIsPeerModalOpen(true);
    }
  }, [peer.status]);

  const playerIds = Object.keys(gameState.players);
  const opponentPlayerId = playerIds.find((id) => id !== myPlayerId) || 'player-2';
  const myPlayer = gameState.players[myPlayerId];
  const opponentPlayer = gameState.players[opponentPlayerId];

  // サンプルデッキ展開
  const handleSetupDeck = (targetPlayerId: string = myPlayerId) => {
    const sampleCards = generateSampleDeck(targetPlayerId);
    dispatchAction({
      type: 'SETUP_GAME',
      payload: {
        playerId: targetPlayerId,
        deckCards: sampleCards,
        apCards: [],
      },
    });
  };

  // デッキビルダーから「このデッキで対戦する」を受け取った時の処理
  const handlePlayWithCustomDeck = (deck: UserDeck) => {
    const customCards = flattenDeckToCards(deck, myPlayerId);
    dispatchAction({
      type: 'SETUP_GAME',
      payload: {
        playerId: myPlayerId,
        deckCards: customCards,
        apCards: [],
      },
    });
    // GameBoard 画面へ切り替え
    setCurrentView('game');
  };

  // 全アクティブ（リロール）
  const handleSetAllActive = () => {
    dispatchAction({
      type: 'SET_ALL_ACTIVE',
      payload: { playerId: myPlayerId },
    });
  };

  // AP全回復
  const handleRecoverAp = () => {
    dispatchAction({
      type: 'RECOVER_AP',
      payload: { playerId: myPlayerId },
    });
  };

  // 1ドロー
  const handleDrawCard = () => {
    dispatchAction({
      type: 'DRAW_CARD',
      payload: { playerId: myPlayerId, count: 1 },
    });
  };

  // ダイスロール
  const handleRollDice = () => {
    dispatchAction({
      type: 'ROLL_DICE',
      payload: { playerId: myPlayerId },
    });
  };

  // マリガン
  const handleMulligan = (targetPlayerId: string = myPlayerId) => {
    dispatchAction({
      type: 'MULLIGAN',
      payload: { playerId: targetPlayerId },
    });
  };

  // 手札キープ
  const handleKeepHand = (targetPlayerId: string = myPlayerId) => {
    dispatchAction({
      type: 'KEEP_HAND',
      payload: { playerId: targetPlayerId },
    });
  };

  // 初期ライフ配置 (マリガン後に山札上から7枚)
  const handlePlaceInitialLife = (targetPlayerId: string = myPlayerId) => {
    dispatchAction({
      type: 'PLACE_INITIAL_LIFE',
      payload: { playerId: targetPlayerId, count: 7 },
    });
  };

  // Readyトグル
  const handleToggleReady = (targetPlayerId: string = myPlayerId) => {
    const p = gameState.players[targetPlayerId];
    if (!p) return;
    dispatchAction({
      type: 'SET_READY',
      payload: { playerId: targetPlayerId, isReady: !p.isReady },
    });
  };

  // 先攻プレイヤー設定
  const handleSetFirstPlayer = (firstPlayerId: string) => {
    dispatchAction({
      type: 'SET_FIRST_PLAYER',
      payload: { firstPlayerId },
    });
  };

  // ゲーム開始
  const handleStartGame = () => {
    dispatchAction({ type: 'START_GAME' });
  };

  // ゲームリセット
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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* トップヘッダー */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div
            onClick={() => setCurrentView('home')}
            className="flex items-center gap-2 cursor-pointer group"
            title="ホームへ移動"
          >
            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-md shadow-indigo-500/30 group-hover:bg-indigo-500 transition">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm sm:text-base tracking-wide bg-gradient-to-r from-indigo-300 via-sky-300 to-indigo-100 bg-clip-text text-transparent group-hover:brightness-125 transition">
                UNION ARENA Web Simulator
              </h1>
              <span className="text-[10px] text-slate-400">Ver 1.1 公式ルール準拠</span>
            </div>
          </div>

          {/* ナビゲーションタブ (ホーム ⇔ 対戦盤面 ⇔ デッキ構築) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 ml-2 sm:ml-4">
            <button
              onClick={() => setCurrentView('home')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition ${
                currentView === 'home'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              ホーム
            </button>
            <button
              onClick={() => setCurrentView('game')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition ${
                currentView === 'game'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              対戦盤面
            </button>
            <button
              onClick={() => setCurrentView('deckBuilder')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition ${
                currentView === 'deckBuilder'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              デッキ構築
            </button>
          </div>
        </div>

        {/* ソロプレイ用視点切り替え & サウンド & ヘルプ */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* グローバルサウンドトグル */}
          <button
            onClick={handleToggleSound}
            className={`p-1.5 rounded-lg border text-xs transition ${
              soundEnabled
                ? 'bg-indigo-950/40 border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/50'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
            }`}
            title={soundEnabled ? '効果音: ON (クリックでミュート)' : '効果音: OFF (クリックで有効化)'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {currentView === 'game' && (
            <div className="flex items-center gap-2">
              {/* 現在のモード表示バッジ */}
              {peer.status === 'connected' ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-700/60 text-emerald-300 text-[11px] font-bold">
                  <Wifi className="w-3 h-3" />
                  <span>P2P接続中</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/50 border border-indigo-700/60 text-indigo-300 text-[11px] font-bold">
                    <span>🎮</span>
                    <span>ソロプレイ</span>
                  </div>
                  <button
                    onClick={() => setIsPeerModalOpen(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/40 border border-emerald-700/50 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/40 text-[11px] font-bold transition"
                    title="P2Pオンライン対戦に切り替える"
                  >
                    <Users className="w-3 h-3" />
                    <span>P2P接続</span>
                  </button>
                </>
              )}

              {/* ソロプレイ用視点切り替え */}
              {peer.status !== 'connected' && (
                <div className="flex items-center bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs">
                  <span className="text-slate-400 mr-2 flex items-center gap-1 text-[11px]">
                    <UserCheck className="w-3 h-3 text-indigo-400" /> 操作プレイヤー:
                  </span>
                  <button
                    onClick={() => setMyPlayerId('player-1')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      myPlayerId === 'player-1'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Player 1
                  </button>
                  <button
                    onClick={() => setMyPlayerId('player-2')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      myPlayerId === 'player-2'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Player 2
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setShowHelpModal(true)}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
            title="使い方ガイド"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 表示ビューの切り替え (ホーム / デッキビルダー / 対戦盤面) */}
      {currentView === 'home' ? (
        <HomePage
          onStartGame={() => setCurrentView('game')}
          onOpenDeckBuilder={() => setCurrentView('deckBuilder')}
          onOpenPeerModal={() => setIsPeerModalOpen(true)}
          onSelectPresetDeck={handlePlayWithCustomDeck}
        />
      ) : currentView === 'deckBuilder' ? (
        <DeckBuilderPage onPlayWithDeck={handlePlayWithCustomDeck} />
      ) : (
        <>
          {/* 試合前準備バー or 対戦中クイックアクションバー */}
          {gameState.status === 'PREPARING' && myPlayer && opponentPlayer ? (
            <PreGameBar
              myPlayer={myPlayer}
              opponentPlayer={opponentPlayer}
              firstPlayerId={gameState.firstPlayerId}
              onSetFirstPlayer={handleSetFirstPlayer}
              onSetupDeck={() => handleSetupDeck(myPlayerId)}
              onMulligan={() => handleMulligan(myPlayerId)}
              onKeepHand={() => handleKeepHand(myPlayerId)}
              onPlaceLife={() => handlePlaceInitialLife(myPlayerId)}
              onToggleReady={() => handleToggleReady(myPlayerId)}
              onStartGame={handleStartGame}
              onRollDice={handleRollDice}
            />
          ) : (
            <ActionToolbar
              onSetupDeck={() => handleSetupDeck(myPlayerId)}
              onDrawCard={handleDrawCard}
              onSetAllActive={handleSetAllActive}
              onRecoverAp={handleRecoverAp}
              onRollDice={handleRollDice}
              onResetGame={handleResetGame}
              onUndo={undo}
              canUndo={canUndo}
              soundEnabled={soundEnabled}
              onToggleSound={handleToggleSound}
              onOpenPeerModal={() => setIsPeerModalOpen(true)}
              peerStatus={peer.status}
              isHost={peer.isHost}
            />
          )}

          {/* メイン対戦盤面 & ログパネル */}
          <main className="flex-1 flex overflow-hidden relative">
            {/* ボード領域 */}
            <div className="flex-1 h-full overflow-y-auto">
              <Board
                gameState={gameState}
                myPlayerId={myPlayerId}
                dispatchAction={dispatchAction}
              />
            </div>

            {/* 対戦行動ログサイドバー */}
            <div
              className={`transition-all duration-300 ease-in-out border-l border-slate-800 bg-slate-900/95 flex flex-col h-full ${
                isLogCollapsed ? 'w-10' : 'w-72 sm:w-80 md:w-96'
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
                onSendChat={(text) => {
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
        </>
      )}

      {/* P2P通信対戦モーダル */}
      <PeerModal
        peer={peer}
        isOpen={isPeerModalOpen}
        onClose={() => setIsPeerModalOpen(false)}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
      />

      {/* 使い方ヘルプモーダル */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-indigo-300">オフィシャルルール Ver 1.1 操作ガイド</h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded"
              >
                閉じる
              </button>
            </div>
            <div className="space-y-2 text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <p><strong>1. デッキ構築 (DeckBuilder):</strong> ヘッダーのタブからデッキ構築画面へ移動し、カードプールから50枚デッキを作成・保存できます。「このデッキで対戦する」を押すとそのまま対戦盤面に持ち込めます。</p>
              <p><strong>2. 試合前フロー:</strong> 手番（先攻・後攻）を決め、「デッキセット」を押すとライフ7枚・初手7枚が配られます。必要に応じて「マリガン（手札7枚引き直し、1回のみ）」を行い、「準備完了（Ready）」を押して「対戦開始」します。</p>
              <p><strong>3. 山札サーチ & トップ確認:</strong> 山札エリアの「上を見る」「探す」ボタンから、ルルーシュ効果等の山札操作や特定カードの手札回収が可能です。</p>
              <p><strong>4. Undo & サウンド:</strong> ツールバーの「Undo」で1手前の盤面に戻せます。スピーカーアイコンでSEのON/OFFが可能です。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
