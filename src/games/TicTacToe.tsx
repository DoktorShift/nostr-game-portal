import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RefreshCwIcon, UserIcon as BrowserIcon, KeyIcon, AlertTriangleIcon, TrophyIcon, EqualIcon, RotateCcwIcon, LogOutIcon, ShareIcon, WifiIcon, WifiOffIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';
import { bytesToHex } from '@noble/hashes/utils';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';
import { decode } from 'nostr-tools/nip19';

// Import your CSS file
import './NostrTicTacToe.css';

const TicTacToe = ({ onScoreUpdate, onGameOver }) => {
  // Game State (useState equivalents of Vue refs)
  const [relayUrl, setRelayUrl] = useState('wss://relay.damus.io');
  const [gameId, setGameId] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [loginMethod, setLoginMethod] = useState('extension');
  const [nsec, setNsec] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Nostr Connection (using useRef for mutable values that don't trigger re-renders, or useState if they do)
  const pool = useMemo(() => new SimplePool(), []); // Memoize the pool instance
  const subRef = useRef(null); // useRef for the subscription object
  const pubkeyRef = useRef(null);
  const secretKeyRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const hasReceivedGameStateRef = useRef(false);

  // Game Logic State
  const [board, setBoard] = useState(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [winner, setWinner] = useState(null);
  const [winningCells, setWinningCells] = useState([]);
  const [gameStateVersion, setGameStateVersion] = useState(0);
  const [xWins, setXWins] = useState(0);
  const [oWins, setOWins] = useState(0);
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [playerX, setPlayerX] = useState(null);
  const [playerO, setPlayerO] = useState(null);
  const [gameReady, setGameReady] = useState(false);
  const [creatorPubkey, setCreatorPubkey] = useState(null);

  // UI State for Toast
  const [showConnectionToast, setShowConnectionToast] = useState(false);
  const [connectionToastMessage, setConnectionToastMessage] = useState('');
  const [connectionToastType, setConnectionToastType] = useState('info');
  const [connectionToastIcon, setConnectionToastIcon] = useState(() => WifiIcon); // Use a function to set initial state

  // Computed Properties (useMemo equivalents)
  const isDraw = useMemo(() =>
    board.every(cell => cell !== null) && !winner,
    [board, winner]
  );

  const connectedPlayers = useMemo(() => {
    let count = 0;
    if (playerX) count++;
    if (playerO) count++;
    return count;
  }, [playerX, playerO]);

  const isRoomCreator = useMemo(() => {
    const result = creatorPubkey === pubkeyRef.current;
    console.log('isRoomCreator check:', { creatorPubkey, currentPubkey: pubkeyRef.current, result });
    return result;
  }, [creatorPubkey]);

  const getPlayerBySlot = useCallback((slot) => {
    return slot === 1 ? playerX : playerO;
  }, [playerX, playerO]);

  const mySymbol = useMemo(() => {
    if (playerX === pubkeyRef.current) return 'X';
    if (playerO === pubkeyRef.current) return 'O';
    return null;
  }, [playerX, playerO]);

  // Methods (functions)
  const generateNewGameId = useCallback(() => {
    setGameId(bytesToHex(generateSecretKey()).slice(0, 8).toUpperCase());
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    setConnectionToastMessage(message);
    setConnectionToastType(type);
    if (type === 'success') {
      setConnectionToastIcon(() => CheckCircleIcon);
    } else if (type === 'error') {
      setConnectionToastIcon(() => XCircleIcon);
    } else {
      setConnectionToastIcon(() => WifiIcon);
    }
    setShowConnectionToast(true);
    
    setTimeout(() => {
      setShowConnectionToast(false);
    }, duration);
  }, []);

  // Forward declaration for mutual recursion (important for connectToRelay and attemptReconnect)
  const connectToRelay = useCallback(async () => {
    try {
      if (subRef.current) subRef.current.close();
      
      const filters = [{ kinds: [31337], '#d': [gameId] }];
      subRef.current = pool.subscribeMany([relayUrl], filters, {
        onevent: handleGameEvent,
        oneose: handleSubscriptionEnd,
        onclose: handleConnectionClose
      });
      
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      
    } catch (error) {
      console.error('Failed to connect to relay:', error);
      setIsConnected(false);
      attemptReconnect();
    }
  }, [gameId, relayUrl, pool]); // Dependencies for connectToRelay

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      showToast('Failed to reconnect. Please refresh the page.', 'error', 5000);
      return;
    }
    
    reconnectAttemptsRef.current++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
    
    setTimeout(() => {
      if (gameStarted && !isConnected) {
        connectToRelay();
      }
    }, delay);
  }, [gameStarted, isConnected, connectToRelay, showToast]);

  async function publishGameState() {
    if (!pubkeyRef.current) {
      console.warn('publishGameState: pubkeyRef.current missing', pubkeyRef.current);
      return;
    }
    const event = {
      kind: 31337,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['d', gameId]],
      pubkey: pubkeyRef.current,
      content: JSON.stringify({
        board: board,
        currentPlayer: currentPlayer,
        winner: winner,
        winningCells: winningCells,
        version: gameStateVersion,
        xWins: xWins,
        oWins: oWins,
        playerX: playerX,
        playerO: playerO,
        gameReady: gameReady,
        creatorPubkey: creatorPubkey
      })
    };
    console.log('publishGameState', {
      pubkey: pubkeyRef.current,
      secretKey: secretKeyRef.current,
      relayUrl,
      event
    });
    try {
      const signedEvent = loginMethod === 'key'
        ? finalizeEvent(event, secretKeyRef.current)
        : await window.nostr.signEvent(event);
      await Promise.allSettled(pool.publish([relayUrl], signedEvent));
      console.log('publishGameState: published', signedEvent);
    } catch (error) {
      console.error('Failed to publish game state:', error);
      showToast('Failed to sync game state', 'error');
    }
  }

  async function publishGameStateWithValues(stateValues) {
    if (!pubkeyRef.current) {
      console.warn('publishGameStateWithValues: pubkeyRef.current missing', pubkeyRef.current);
      return;
    }
    const event = {
      kind: 31337,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['d', gameId]],
      pubkey: pubkeyRef.current,
      content: JSON.stringify(stateValues)
    };
    console.log('publishGameStateWithValues', {
      pubkey: pubkeyRef.current,
      secretKey: secretKeyRef.current,
      relayUrl,
      event
    });
    try {
      const signedEvent = loginMethod === 'key'
        ? finalizeEvent(event, secretKeyRef.current)
        : await window.nostr.signEvent(event);
      await Promise.allSettled(pool.publish([relayUrl], signedEvent));
      console.log('publishGameStateWithValues: published', signedEvent);
    } catch (error) {
      console.error('Failed to publish game state:', error);
      showToast('Failed to sync game state', 'error');
    }
  }

  const handleGameEvent = useCallback((event) => {
    try {
      const incomingState = JSON.parse(event.content);
      
      if (incomingState.version > gameStateVersion) {
        console.log('Received game state:', incomingState);
        hasReceivedGameStateRef.current = true;
        
        setBoard(incomingState.board);
        setCurrentPlayer(incomingState.currentPlayer);
        setWinner(incomingState.winner);
        setWinningCells(incomingState.winningCells || []);
        setGameStateVersion(incomingState.version);
        setXWins(incomingState.xWins || 0);
        setOWins(incomingState.oWins || 0);
        setPlayerX(incomingState.playerX);
        setPlayerO(incomingState.playerO);
        setGameReady(incomingState.gameReady || false);
        setCreatorPubkey(incomingState.creatorPubkey);
        
        // If we see a game state and we're not a player yet, join as Player O
        if (incomingState.playerX && !incomingState.playerO && 
            incomingState.playerX !== pubkeyRef.current && 
            pubkeyRef.current !== playerX && pubkeyRef.current !== playerO) {
          setPlayerO(pubkeyRef.current);
          showToast('You joined as Player O!', 'success');
          setGameStateVersion(incomingState.version + 1);
          // Publish immediately with the current state values - preserve creatorPubkey
          setTimeout(() => {
            publishGameStateWithValues({
              ...incomingState,
              playerO: pubkeyRef.current,
              version: incomingState.version + 1,
              creatorPubkey: incomingState.creatorPubkey // Explicitly preserve the creator
            });
          }, 100);
        }
        
        if (incomingState.gameReady) {
          // Note: mySymbol needs to be calculated based on the updated state,
          // or passed as a dependency if using an older version.
          // For simplicity here, assuming mySymbol would react to updated playerX/O.
          const currentMySymbol = (playerX === pubkeyRef.current ? 'X' : (playerO === pubkeyRef.current ? 'O' : null));
          setIsMyTurn(incomingState.currentPlayer === currentMySymbol);
          if (event.pubkey !== pubkeyRef.current && !incomingState.winner && !isDraw) {
            showToast("Opponent moved - your turn!", 'info', 2000);
          }
        }
        
        onScoreUpdate(Math.max(incomingState.xWins, incomingState.oWins) * 100);
        
        if (incomingState.winner || isDraw) {
          const isWinner = (incomingState.winner === mySymbol); // mySymbol needs to be current state
          onGameOver({
            score: (isWinner ? 100 : 50),
            win: isWinner,
            duration: Date.now(),
            level: 1
          });
        }
      }
    } catch (error) {
      console.error('Failed to parse game event:', error);
    }
  }, [gameStateVersion, isDraw, mySymbol, onScoreUpdate, onGameOver, showToast, playerX, playerO, publishGameState]);

  const handleSubscriptionEnd = useCallback(() => {
    // Subscription ended - this is just for logging
    console.log('Subscription ended');
  }, [playerX, playerO, showToast, publishGameState]);

  const handleConnectionClose = useCallback(() => {
    setIsConnected(false);
    showToast('Connection lost, attempting to reconnect...', 'error');
    attemptReconnect();
  }, [showToast, attemptReconnect]);

  const startGame = useCallback(async () => {
    if (!gameId || !relayUrl) {
      showToast('Please provide relay URL and game ID', 'error');
      return;
    }

    try {
      setLoading(true);
      
      if (loginMethod === 'key') {
        if (!nsec) {
          throw new Error('Please enter your private key');
        }
        const decoded = decode(nsec.trim());
        if (decoded.type !== 'nsec') {
          throw new Error('Invalid nsec format');
        }
        secretKeyRef.current = decoded.data;
        pubkeyRef.current = getPublicKey(secretKeyRef.current);
      } else {
        if (!window.nostr) {
          throw new Error('Nostr extension not found. Please install a Nostr browser extension.');
        }
        pubkeyRef.current = await window.nostr.getPublicKey();
      }

      await connectToRelay();
      setGameStarted(true);
      showToast('Connected to game room!', 'success');
      
      // Use a more robust approach - check multiple times with shorter intervals
      let checkCount = 0;
      const maxChecks = 8; // Check 8 times over 2 seconds
      
      const checkForExistingGame = () => {
        checkCount++;
        console.log(`Check ${checkCount}: playerX=${playerX?.slice(0,8)}, playerO=${playerO?.slice(0,8)}, creatorPubkey=${creatorPubkey?.slice(0,8)}, hasReceivedGameState=${hasReceivedGameStateRef.current}`);
        
        // Stop checking if we've received any game state from the relay
        if (hasReceivedGameStateRef.current) {
          console.log('Received game state from relay - stopping creator checks');
          return;
        }
        
        if (!playerX && !playerO && !creatorPubkey) {
          if (checkCount >= maxChecks) {
            // After all checks, we're definitely the first player
            console.log('Becoming room creator after', checkCount, 'checks:', pubkeyRef.current);
            setPlayerX(pubkeyRef.current);
            setCreatorPubkey(pubkeyRef.current);
            setGameStateVersion(1);
            showToast('You joined as Player X!', 'success');
            // Publish with explicit values instead of relying on state
            setTimeout(() => {
              publishGameStateWithValues({
                board: Array(9).fill(null),
                currentPlayer: 'X',
                winner: null,
                winningCells: [],
                version: 1,
                xWins: 0,
                oWins: 0,
                playerX: pubkeyRef.current,
                playerO: null,
                gameReady: false,
                creatorPubkey: pubkeyRef.current
              });
            }, 100);
          } else {
            // Check again in 250ms
            setTimeout(checkForExistingGame, 250);
          }
        } else {
          console.log('Found existing game state on check', checkCount, '- not becoming creator');
        }
      };
      
      // Start checking after 250ms
      setTimeout(checkForExistingGame, 250);
      
    } catch (error) {
      console.error('Failed to start game:', error);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [gameId, relayUrl, loginMethod, nsec, showToast, connectToRelay, publishGameState]);

  // Game Logic Functions
  const startGameRound = useCallback(async () => {
    if (!isRoomCreator || connectedPlayers < 2) return;
    
    console.log('Starting game round - setting gameReady to true');
    
    // Create the new game state with gameReady: true
    const newGameState = {
      board: Array(9).fill(null),
      currentPlayer: 'X',
      winner: null,
      winningCells: [],
      version: gameStateVersion + 1,
      xWins: xWins,
      oWins: oWins,
      playerX: playerX,
      playerO: playerO,
      gameReady: true, // This is the key change
      creatorPubkey: creatorPubkey
    };
    
    // Update local state first
    setGameReady(true);
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setWinner(null);
    setWinningCells([]);
    setIsMyTurn(mySymbol === 'X');
    setGameStateVersion(prev => prev + 1);
    
    // Publish the updated state with gameReady: true
    try {
      await publishGameStateWithValues(newGameState);
      showToast('Game started!', 'success');
      console.log('Published game state with gameReady: true', newGameState);
    } catch (error) {
      console.error('Failed to publish game start state:', error);
      showToast('Failed to start game', 'error');
    }
  }, [isRoomCreator, connectedPlayers, mySymbol, gameStateVersion, xWins, oWins, playerX, playerO, creatorPubkey, publishGameStateWithValues, showToast]);

  const makeMove = useCallback(async (index) => {
    if (!isMyTurn || board[index] || winner || isDraw || !gameReady) {
      return;
    }
    
    // Make move locally
    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);
    setIsMyTurn(false);
    
    // Check for winner with the new board
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6] // Diagonals
    ];
    
    let hasWinner = false;
    let winningPattern = [];
    
    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (newBoard[a] && 
          newBoard[a] === newBoard[b] && 
          newBoard[a] === newBoard[c]) {
        setWinner(newBoard[a]);
        setWinningCells(pattern);
        
        // Update win count
        if (newBoard[a] === 'X') {
          setXWins(prev => prev + 1);
        } else {
          setOWins(prev => prev + 1);
        }
        
        hasWinner = true;
        winningPattern = pattern;
        break;
      }
    }
    
    // Switch player if no winner
    if (!hasWinner) {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
    }
    
    // Update version and publish
    setGameStateVersion(prev => prev + 1);
    await publishGameState();
  }, [isMyTurn, board, winner, isDraw, gameReady, currentPlayer, publishGameState]);

  const resetGame = useCallback(async () => {
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setWinner(null);
    setWinningCells([]);
    setIsMyTurn(mySymbol === 'X');
    setGameStateVersion(prev => prev + 1);
    
    await publishGameState();
    showToast('New round started!', 'info');
  }, [mySymbol, publishGameState, showToast]);

  const leaveGame = useCallback(() => {
    if (subRef.current) subRef.current.close();
    setGameStarted(false);
    setIsConnected(false);
    
    // Reset game state
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setWinner(null);
    setWinningCells([]);
    setGameStateVersion(0);
    setXWins(0);
    setOWins(0);
    setIsMyTurn(true);
    setPlayerX(null);
    setPlayerO(null);
    setGameReady(false);
    setCreatorPubkey(null);
  }, []);

  const shareRoom = useCallback(async () => {
    const shareUrl = `${window.location.origin}/games/nostr-tictactoe?room=${gameId}&relay=${encodeURIComponent(relayUrl)}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Tic-Tac-Toe game!',
          text: `Play Tic-Tac-Toe with me on Nostr`,
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
  }, [gameId, relayUrl, showToast]);

  // useEffect for onMounted equivalent
  useEffect(() => {
    generateNewGameId();
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const relayParam = urlParams.get('relay');
    
    if (roomParam) setGameId(roomParam);
    if (relayParam) setRelayUrl(decodeURIComponent(relayParam));

    // Cleanup function for onBeforeUnmount
    return () => {
      if (subRef.current) subRef.current.close();
      pool.close([relayUrl]); // Ensure relayUrl is the final state value before unmount
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  // useEffect for watch(isConnected) equivalent
  useEffect(() => {
    if (isConnected && gameStarted) {
      showToast('Reconnected to game room', 'success', 2000);
    }
  }, [isConnected, gameStarted, showToast]);



  return (
    <div className="nostr-game-container">
      {/* Game Setup Panel */}
      {!gameStarted && (
        <div className="setup-panel">
          <div className="setup-header">
            <h2 className="game-title">💡 Nostr Tic-Tac-Toe</h2>
            <p className="game-subtitle">Challenge friends in real-time multiplayer</p>
          </div>

          <div className="setup-form">
            <div className="input-group">
              <label>Nostr Relay URL</label>
              <input 
                value={relayUrl}
                onChange={(e) => setRelayUrl(e.target.value)}
                type="url" 
                className="input"
                placeholder="wss://relay.damus.io"
              />
            </div>

            <div className="input-group">
              <label>Game Room ID</label>
              <div className="input-with-button">
                <input 
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  type="text" 
                  className="input"
                  placeholder="Enter or generate room ID"
                />
                <button onClick={generateNewGameId} className="btn-icon" title="Generate new ID">
                  <RefreshCwIcon className="w-4 h-4" /> 
                </button>
              </div>
            </div>

            <div className="login-method-selector">
              <div className="method-tabs">
                <button 
                  onClick={() => setLoginMethod('extension')}
                  className={`method-tab ${loginMethod === 'extension' ? 'active' : ''}`} 
                >
                  <BrowserIcon className="w-4 h-4" />
                  Extension
                </button>
                <button 
                  onClick={() => setLoginMethod('key')}
                  className={`method-tab ${loginMethod === 'key' ? 'active' : ''}`} 
                >
                  <KeyIcon className="w-4 h-4" />
                  Private Key
                </button>
              </div>

              {loginMethod === 'key' && ( 
                <div className="key-input-section">
                  <div className="input-group">
                    <label>Nostr Private Key (nsec)</label>
                    <input 
                      value={nsec} 
                      onChange={(e) => setNsec(e.target.value)}
                      type="password" 
                      className="input"
                      placeholder="nsec1..." 
                    />
                  </div>
                  <div className="warning-banner">
                    <AlertTriangleIcon className="w-4 h-4" />
                    <span>Use browser extensions for better security</span>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={startGame} 
              disabled={loading}
              className="btn-primary start-game-btn"
            >
              {loading && <div className="loading-spinner"></div>}
              {loading ? 'Connecting...' : 'Join Game Room'} 
            </button>
          </div>
        </div>
      )}

      {/* Waiting Room */}
      {gameStarted && !gameReady && (
        <div className="waiting-room">
          <div className="waiting-header">
            <h2 className="game-title">💡 Waiting for Opponent</h2>
            <p className="game-subtitle">Room: {gameId}</p> 
          </div>

          <div className="players-waiting">
            <div className="player-slots">
              {[...Array(2)].map((_, i) => ( 
                <div
                  key={i + 1}
                  className={`player-slot ${getPlayerBySlot(i + 1) ? 'filled' : ''} ${getPlayerBySlot(i + 1) === pubkeyRef.current ? 'is-me' : ''}`}
                >
                  {getPlayerBySlot(i + 1) ? (
                    <div className="player-info">
                      <div 
                        className="player-avatar" 
                        style={{ backgroundColor: (i + 1) === 1 ? '#3b82f6' : '#ef4444' }}
                      >
                        {(i + 1) === 1 ? 'X' : 'O'} 
                      </div>
                      <div className="player-name">
                        {getPlayerBySlot(i + 1) === pubkeyRef.current ? 'You' : `Player ${i + 1}`} 
                      </div>
                    </div>
                  ) : (
                    <div className="empty-slot">
                      <div className="empty-avatar">?</div>
                      <div className="empty-text">Waiting...</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="waiting-info">
              <div className="player-count">
                {connectedPlayers} / 2 players joined 
              </div>
              
              {connectedPlayers === 2 ? ( 
                                  <div className="ready-section">
                    <div className="ready-message">Both players connected!</div>
                    {isRoomCreator ? ( 
                      <button 
                        onClick={startGameRound}
                        className="btn-primary"
                      >
                        Start Game
                      </button>
                    ) : (
                      <div className="waiting-message"> 
                        Waiting for room creator to start the game...
                      </div>
                    )}
                  </div>
              ) : (
                <div className="need-more-players"> 
                  Need 1 more player to start
                </div>
              )}
            </div>

            <div className="room-actions">
              <button onClick={shareRoom} className="btn-outline">
                <ShareIcon className="w-4 h-4" />
                Share Room
              </button>
              <button onClick={leaveGame} className="btn-outline">
                <LogOutIcon className="w-4 h-4" />
                Leave Room 
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Board */}
      {gameReady && (
        <div className="game-board-container">
          {/* Game Header */}
          <div className="game-header">
            <div className="game-info">
              <div className="room-info">
                <span className="room-label">Room:</span>
                <span className="room-id">{gameId}</span> 
              </div>
              <div className={`connection-status ${isConnected ? 'connected' : ''}`}> 
                <div className="status-dot"></div>
                {isConnected ? 'Connected' : 'Connecting...'} 
              </div>
            </div>

            <div className="game-stats">
              <div className="score-display">
                <div className="score-item x-score">
                  <span className="score-symbol">X</span>
                  <span className="score-value">{xWins}</span> 
                </div>
                <div className="score-divider">-</div> 
                <div className="score-item o-score">
                  <span className="score-symbol">O</span>
                  <span className="score-value">{oWins}</span> 
                </div>
              </div>
            </div>
          </div>

          {/* Turn Indicator */} 
          <div className="turn-indicator">
            {winner ? ( 
              <div className="game-result winner">
                <TrophyIcon className="w-6 h-6" />
                {winner} Wins! 
              </div>
            ) : isDraw ? ( 
              <div className="game-result draw">
                <EqualIcon className="w-6 h-6" />
                It's a Draw! 
              </div>
            ) : (
              <div className="turn-display">
                <div className={`current-player ${currentPlayer.toLowerCase()}`}>
                  {currentPlayer}
                </div>
                <span className="turn-text">
                  {isMyTurn ? "Your turn" : "Opponent's turn"} 
                </span>
              </div>
            )}
          </div>

          {/* Tic-Tac-Toe Board */}
          <div className={`tic-tac-toe-board ${(!isMyTurn || winner || isDraw) ? 'locked' : ''}`}>
            {board.map((cell, index) => (
              <div
                key={index}
                onClick={() => { makeMove(index); }}
                className={`board-cell ${cell === 'X' ? 'has-x' : ''} ${cell === 'O' ? 'has-o' : ''} ${winningCells.includes(index) ? 'winning-cell' : ''}`} 
              >
                {cell && (
                  <span className="cell-content">{cell}</span> 
                )}
              </div>
            ))}
          </div>

          {/* Game Controls */}
          <div className="game-controls">
            <button onClick={resetGame} className="btn-outline">
              <RotateCcwIcon className="w-4 h-4" />
              New Round
            </button>
            <button onClick={leaveGame} className="btn-outline">
              <LogOutIcon className="w-4 h-4" /> 
              Leave Room
            </button>
            <button onClick={shareRoom} className="btn-primary">
              <ShareIcon className="w-4 h-4" />
              Share Room
            </button>
          </div>
        </div>
      )}

      {/* Connection Status Toast */}
      {showConnectionToast && ( 
        <div className={`connection-toast ${connectionToastType}`}> 
          <div className="toast-content">
            {React.createElement(connectionToastIcon, { className: "w-5 h-5" })}
            <span>{connectionToastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicTacToe;