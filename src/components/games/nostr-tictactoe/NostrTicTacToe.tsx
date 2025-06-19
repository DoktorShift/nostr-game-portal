import { useState, useEffect, useCallback, useRef } from 'react';
import { SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { decode } from 'nostr-tools/nip19';
import { bytesToHex } from '@noble/hashes/utils';
import { generateSecretKey } from 'nostr-tools/pure';
import {
  RefreshCw,
  User as BrowserIcon,
  Key,
  AlertTriangle,
  Trophy,
  Equal,
  RotateCcw,
  LogOut,
  Share,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
} from 'lucide-react';

declare global {
    interface Window {
        nostr: any;
    }
}

interface GameState {
  board: (string | null)[];
  currentPlayer: string;
  winner: string | null;
  winningCells: number[];
  version: number;
  xWins: number;
  oWins: number;
  playerX: string | null;
  playerO: string | null;
  gameReady: boolean;
  creatorPubkey: string | null;
}

export function NostrTicTacToe() {
  // Game State
  const [relayUrl, setRelayUrl] = useState('wss://relay.damus.io');
  const [gameId, setGameId] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'extension' | 'key'>('extension');
  const [nsec, setNsec] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Nostr Connection
  const pool = useRef(new SimplePool());
  const sub = useRef<any>(null);
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<Uint8Array | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Game Logic
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [winner, setWinner] = useState<string | null>(null);
  const [winningCells, setWinningCells] = useState<number[]>([]);
  const gameStateVersion = useRef(0);
  const [xWins, setXWins] = useState(0);
  const [oWins, setOWins] = useState(0);
  const [playerX, setPlayerX] = useState<string | null>(null);
  const [playerO, setPlayerO] = useState<string | null>(null);
  const [gameReady, setGameReady] = useState(false);
  const [creatorPubkey, setCreatorPubkey] = useState<string | null>(null);

  // UI State
  const [showConnectionToast, setShowConnectionToast] = useState(false);
  const [connectionToastMessage, setConnectionToastMessage] = useState('');
  const [connectionToastType, setConnectionToastType] = useState<'info' | 'success' | 'error'>('info');
  const ConnectionToastIcon =
    connectionToastType === 'success' ? CheckCircle :
    connectionToastType === 'error' ? XCircle : Wifi;


  // Computed Properties
  const isDraw = board.every(cell => cell !== null) && !winner;
  const connectedPlayers = (playerX ? 1 : 0) + (playerO ? 1 : 0);
  const isRoomCreator = creatorPubkey === pubkey;
  const mySymbol = playerX === pubkey ? 'X' : playerO === pubkey ? 'O' : null;
  const isMyTurn = mySymbol === currentPlayer;


  const getPlayerBySlot = (slot: number) => {
    return slot === 1 ? playerX : playerO;
  };

  const generateNewGameId = () => {
    setGameId(bytesToHex(generateSecretKey()).slice(0, 8).toUpperCase());
  };

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info', duration = 3000) => {
    setConnectionToastMessage(message);
    setConnectionToastType(type);
    setShowConnectionToast(true);

    setTimeout(() => {
      setShowConnectionToast(false);
    }, duration);
  };

  const publishGameState = useCallback(async (stateToPublish?: Partial<GameState>) => {
    if (!pubkey || !isConnected) return;

    const currentState = {
        board,
        currentPlayer,
        winner,
        winningCells,
        version: gameStateVersion.current + 1,
        xWins,
        oWins,
        playerX,
        playerO,
        gameReady,
        creatorPubkey,
        ...stateToPublish
    };
    gameStateVersion.current = currentState.version;

    const event = {
      kind: 31337,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['d', gameId]],
      pubkey,
      content: JSON.stringify(currentState)
    };

    try {
      const signedEvent = loginMethod === 'key' && secretKey
        ? finalizeEvent(event, secretKey)
        : await window.nostr.signEvent(event);

      await Promise.allSettled(pool.current.publish([relayUrl], signedEvent));
    } catch (error) {
      console.error('Failed to publish game state:', error);
      showToast('Failed to sync game state', 'error');
    }
  }, [pubkey, isConnected, gameId, loginMethod, secretKey, board, currentPlayer, winner, winningCells, xWins, oWins, playerX, playerO, gameReady, creatorPubkey, relayUrl]);


  const handleGameEvent = useCallback((event: any) => {
    try {
      const incomingState: GameState = JSON.parse(event.content);

      if (incomingState.version > gameStateVersion.current) {
        gameStateVersion.current = incomingState.version;
        setBoard(incomingState.board);
        setCurrentPlayer(incomingState.currentPlayer);
        setWinner(incomingState.winner);
        setWinningCells(incomingState.winningCells || []);
        setXWins(incomingState.xWins || 0);
        setOWins(incomingState.oWins || 0);
        setPlayerX(incomingState.playerX);
        setPlayerO(incomingState.playerO);
        setGameReady(incomingState.gameReady || false);
        setCreatorPubkey(incomingState.creatorPubkey);

        if (incomingState.gameReady && event.pubkey !== pubkey && !incomingState.winner) {
           const myCurrSymbol = incomingState.playerX === pubkey ? 'X' : incomingState.playerO === pubkey ? 'O' : null;
           if(incomingState.currentPlayer === myCurrSymbol) {
             showToast("Opponent moved - your turn!", 'info', 2000);
           }
        }
      }
    } catch (error) {
      console.error('Failed to parse game event:', error);
    }
  }, [pubkey]);

  const handleSubscriptionEnd = useCallback(async () => {
    if (pubkey) {
        let joined = false;
        let pX = playerX;
        let pO = playerO;
        let cPub = creatorPubkey;

        if (!pX) {
            pX = pubkey;
            cPub = pubkey;
            setPlayerX(pubkey);
            setCreatorPubkey(pubkey);
            showToast('You joined as Player X!', 'success');
            joined = true;
        } else if (!pO && pX !== pubkey) {
            pO = pubkey;
            setPlayerO(pubkey);
            showToast('You joined as Player O!', 'success');
            joined = true;
        }

        if (joined) {
            await publishGameState({
                playerX: pX,
                playerO: pO,
                creatorPubkey: cPub
            });
        }
    }
  }, [playerX, playerO, pubkey, publishGameState, creatorPubkey]);

  const connectToRelay = useCallback(async () => {
    try {
      if (sub.current) sub.current.close();

      const filters = [{ kinds: [31337], '#d': [gameId] }];
      sub.current = pool.current.subscribeMany([relayUrl], filters, {
        onevent: handleGameEvent,
        oneose: handleSubscriptionEnd,
        onclose: () => handleConnectionClose(),
      });

      setIsConnected(true);
      reconnectAttempts.current = 0;

    } catch (error) {
      console.error('Failed to connect to relay:', error);
      setIsConnected(false);
      attemptReconnect();
    }
  }, [gameId, relayUrl, handleGameEvent, handleSubscriptionEnd]);

  const startGame = async () => {
    if (!gameId || !relayUrl) {
      showToast('Please provide relay URL and game ID', 'error');
      return;
    }

    try {
      setLoading(true);
      let pk;
      if (loginMethod === 'key') {
        if (!nsec) {
          throw new Error('Please enter your private key');
        }
        const decoded = decode(nsec.trim());
        if (decoded.type !== 'nsec') {
          throw new Error('Invalid nsec format');
        }
        const sk = decoded.data;
        pk = getPublicKey(sk);
        setSecretKey(sk);
        setPubkey(pk);
      } else {
        if (!window.nostr) {
          throw new Error('Nostr extension not found. Please install a Nostr browser extension.');
        }
        pk = await window.nostr.getPublicKey();
        setPubkey(pk);
      }

      await connectToRelay();
      setGameStarted(true);
      showToast('Connected to game room!', 'success');

    } catch (error) {
      console.error('Failed to start game:', error);
      showToast(error instanceof Error ? error.message : 'Failed to start game', 'error');
    } finally {
      setLoading(false);
    }
  };


  const handleConnectionClose = () => {
    setIsConnected(false);
    showToast('Connection lost, attempting to reconnect...', 'error');
    attemptReconnect();
  };

  const attemptReconnect = () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      showToast('Failed to reconnect. Please refresh the page.', 'error', 5000);
      return;
    }

    reconnectAttempts.current++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);

    setTimeout(() => {
      if (gameStarted && !isConnected) {
        connectToRelay();
      }
    }, delay);
  };

  const startGameRound = () => {
    if (!isRoomCreator || connectedPlayers < 2) return;

    const newState = {
        gameReady: true,
        board: Array(9).fill(null),
        currentPlayer: 'X',
        winner: null,
        winningCells: [],
    };
    setGameReady(newState.gameReady);
    setBoard(newState.board);
    setCurrentPlayer(newState.currentPlayer);
    setWinner(newState.winner);
    setWinningCells(newState.winningCells);
    publishGameState(newState);
    showToast('Game started!', 'success');
  };

  const makeMove = async (index: number) => {
    if (!isMyTurn || board[index] || winner || isDraw || !gameReady) {
      return;
    }

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);

    let newWinner: string | null = null;
    let newWinningCells: number[] = [];

    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
        newWinner = newBoard[a];
        newWinningCells = pattern;
        break;
      }
    }

    if (newWinner) {
        setWinner(newWinner);
        setWinningCells(newWinningCells);
        if (newWinner === 'X') {
            setXWins(prev => prev + 1);
        } else {
            setOWins(prev => prev + 1);
        }
    }

    const nextPlayer = currentPlayer === 'X' ? 'O' : 'X';
    setCurrentPlayer(nextPlayer);

    await publishGameState({
        board: newBoard,
        currentPlayer: nextPlayer,
        winner: newWinner,
        winningCells: newWinningCells,
        xWins: newWinner === 'X' ? xWins + 1 : xWins,
        oWins: newWinner === 'O' ? oWins + 1 : oWins,
    });
  };


  const resetGame = async () => {
    const newState = {
        board: Array(9).fill(null),
        currentPlayer: 'X',
        winner: null,
        winningCells: [],
    };
    setBoard(newState.board);
    setCurrentPlayer(newState.currentPlayer);
    setWinner(newState.winner);
    setWinningCells(newState.winningCells);
    await publishGameState(newState);
    showToast('New round started!', 'info');
  };

  const leaveGame = () => {
    if (sub.current) sub.current.close();
    setGameStarted(false);
    setIsConnected(false);

    // Reset game state
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setWinner(null);
    setWinningCells([]);
    gameStateVersion.current = 0;
    setXWins(0);
    setOWins(0);
    setPlayerX(null);
    setPlayerO(null);
    setGameReady(false);
    setCreatorPubkey(null);
  };

  const shareRoom = async () => {
    const shareUrl = `${window.location.origin}/games/nostr-tictactoe?room=${gameId}&relay=${encodeURIComponent(relayUrl)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Tic-Tac-Toe game!',
          text: 'Play Tic-Tac-Toe with me on Nostr',
          url: shareUrl
        });
      } catch (error) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        showToast('Room link copied to clipboard!', 'success');
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Room link copied to clipboard!', 'success');
    }
  };

  useEffect(() => {
    generateNewGameId();

    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const relayParam = urlParams.get('relay');

    if (roomParam) setGameId(roomParam);
    if (relayParam) setRelayUrl(decodeURIComponent(relayParam));

    return () => {
      if (sub.current) sub.current.close();
      pool.current.close([relayUrl]);
    };
  }, [relayUrl]);

  useEffect(() => {
    if (isConnected && gameStarted) {
      showToast('Reconnected to game room', 'success', 2000);
    }
  }, [isConnected, gameStarted]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Game Setup Panel */}
      {!gameStarted ? (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">🎯 Nostr Tic-Tac-Toe</h2>
            <p className="text-slate-600">Challenge friends in real-time multiplayer</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Nostr Relay URL</label>
              <input
                value={relayUrl}
                onChange={(e) => setRelayUrl(e.target.value)}
                type="url"
                className="w-full p-2 border border-slate-300 rounded-lg"
                placeholder="wss://relay.damus.io"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Game Room ID</label>
              <div className="flex space-x-2">
                <input
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  type="text"
                  className="flex-1 p-2 border border-slate-300 rounded-lg"
                  placeholder="Enter or generate room ID"
                />
                <button
                  onClick={generateNewGameId}
                  className="p-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Generate new ID"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <div className="flex bg-slate-100 rounded-lg p-1 mb-4">
                <button
                  onClick={() => setLoginMethod('extension')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-all ${
                    loginMethod === 'extension' ? 'bg-white shadow-sm text-blue-600' : ''
                  }`}
                >
                  <BrowserIcon className="w-4 h-4" />
                  <span>Extension</span>
                </button>
                <button
                  onClick={() => setLoginMethod('key')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-all ${
                    loginMethod === 'key' ? 'bg-white shadow-sm text-blue-600' : ''
                  }`}
                >
                  <Key className="w-4 h-4" />
                  <span>Private Key</span>
                </button>
              </div>

              {loginMethod === 'key' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Nostr Private Key (nsec)</label>
                    <input
                      value={nsec}
                      onChange={(e) => setNsec(e.target.value)}
                      type="password"
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      placeholder="nsec1..."
                    />
                  </div>
                  <div className="flex items-center space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Use browser extensions for better security</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={startGame}
              disabled={loading}
              className="w-full py-3 flex items-center justify-center space-x-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading && (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{loading ? 'Connecting...' : 'Join Game Room'}</span>
            </button>
          </div>
        </div>
      ) : !gameReady ? (
      /* Waiting Room */
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">🎯 Waiting for Opponent</h2>
            <p className="text-slate-600">Room: {gameId}</p>
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    getPlayerBySlot(i)
                      ? 'border-solid border-green-300 bg-green-50'
                      : 'border-dashed border-slate-200'
                  } ${getPlayerBySlot(i) === pubkey ? '!border-blue-300 !bg-blue-50' : ''}`}
                >
                  {getPlayerBySlot(i) ? (
                    <div className="space-y-2">
                      <div
                        className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white font-bold text-xl ${
                          i === 1 ? 'bg-blue-600' : 'bg-red-600'
                        }`}
                      >
                        {i === 1 ? 'X' : 'O'}
                      </div>
                      <div className="font-medium text-slate-900">
                        {getPlayerBySlot(i) === pubkey ? 'You' : `Player ${i}`}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-slate-200 text-slate-400 font-bold">
                        ?
                      </div>
                      <div className="text-slate-500">Waiting...</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center space-y-4">
              <div className="text-lg font-semibold text-slate-900">
                {connectedPlayers} / 2 players joined
              </div>

              {connectedPlayers === 2 ? (
                <div className="space-y-3">
                  <div className="text-green-600 font-medium">Both players connected!</div>
                  {isRoomCreator ? (
                    <button
                      onClick={startGameRound}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Start Game
                    </button>
                  ) : (
                    <div className="text-slate-600">
                      Waiting for room creator to start the game...
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-amber-600">Need 1 more player to start</div>
              )}
            </div>

            <div className="flex justify-center space-x-3">
              <button
                onClick={shareRoom}
                className="flex items-center space-x-2 px-4 py-2 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Share className="w-4 h-4" />
                <span>Share Room</span>
              </button>
              <button
                onClick={leaveGame}
                className="flex items-center space-x-2 px-4 py-2 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Leave Room</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
      /* Game Board */
        <div className="space-y-6">
          {/* Game Header */}
          <div className="flex justify-between items-center p-4 bg-white rounded-lg shadow-sm">
            <div className='flex items-center gap-4'>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-600 text-sm">Room:</span>
                  <span className="font-mono font-bold text-blue-600">{gameId}</span>
                </div>
                 <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                        <span className="font-bold text-lg text-blue-600">X</span>
                        <span className="font-bold">{xWins}</span>
                    </div>
                    <div className="text-slate-400">-</div>
                    <div className="flex items-center space-x-1">
                        <span className="font-bold text-lg text-red-600">O</span>
                        <span className="font-bold">{oWins}</span>
                    </div>
                </div>
            </div>
            <div className={`flex items-center space-x-2 text-sm ${isConnected ? 'text-green-600' : 'text-slate-500'}`}>
              <div className="w-2 h-2 rounded-full bg-current" />
              <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
            </div>
          </div>

          {/* Turn Indicator */}
          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
            {winner ? (
              <div className="flex items-center justify-center space-x-2 text-lg font-bold text-green-600">
                <Trophy className="w-6 h-6" />
                <span>{winner} Wins! 🎉</span>
              </div>
            ) : isDraw ? (
              <div className="flex items-center justify-center space-x-2 text-lg font-bold text-amber-600">
                <Equal className="w-6 h-6" />
                <span>It's a Draw!</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-lg ${
                    currentPlayer === 'X' ? 'bg-blue-600' : 'bg-red-600'
                  }`}
                >
                  {currentPlayer}
                </div>
                <span className="text-slate-700">
                  {isMyTurn ? "Your turn" : "Opponent's turn"}
                </span>
              </div>
            )}
          </div>

          {/* Tic-Tac-Toe Board */}
          <div
            className={`grid grid-cols-3 gap-2 max-w-sm mx-auto ${
              !isMyTurn || winner || isDraw ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            {board.map((cell, index) => (
              <div
                key={index}
                onClick={() => makeMove(index)}
                className={`aspect-square bg-white border-2 rounded-lg flex items-center justify-center text-4xl font-bold cursor-pointer transition-all hover:border-blue-300 hover:shadow-md ${
                  cell === 'X'
                    ? 'text-blue-600 border-blue-300 bg-blue-50'
                    : cell === 'O'
                    ? 'text-red-600 border-red-300 bg-red-50'
                    : 'border-slate-200'
                } ${winningCells.includes(index) ? '!bg-green-100 !border-green-400' : ''}`}
              >
                {cell && (
                  <span className="block animate-cell-fill">
                    {cell}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Game Controls */}
          <div className="flex justify-center space-x-3">
            <button
              onClick={resetGame}
              className="flex items-center space-x-2 px-4 py-2 border rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>New Round</span>
            </button>
            <button
              onClick={leaveGame}
              className="flex items-center space-x-2 px-4 py-2 border rounded-lg hover:bg-slate-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave Room</span>
            </button>
            <button
              onClick={shareRoom}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Share className="w-4 h-4" />
              <span>Share Room</span>
            </button>
          </div>
        </div>
      )}

      {/* Connection Status Toast */}
      {showConnectionToast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white transition-transform duration-300 ${
            connectionToastType === 'info' ? 'bg-blue-500' :
            connectionToastType === 'success' ? 'bg-green-500' : 'bg-red-500'
          } ${showConnectionToast ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="flex items-center space-x-2">
            <ConnectionToastIcon className="w-5 h-5" />
            <span>{connectionToastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
