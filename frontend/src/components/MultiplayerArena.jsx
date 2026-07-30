import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, PUBLIC_BASE } from '../utils/api';
import { getLevel, getUsernameStyle } from '../utils/progression';
import { Users, User, Play, LogOut, ArrowLeft, CheckCircle2, XCircle, Trophy, Clock, Crown, Loader2, Gavel, Pencil, Vote, HelpCircle, Skull, Coins, Eye, EyeOff, MessageSquare } from 'lucide-react';
import Pusher from 'pusher-js';
import ChronoBombGame from './ChronoBombGame';
import '../chrono-bomb.css';

function PlayerProfileLink({ player, children, className = '', style }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className={`user-profile-link ${className}`.trim()}
      onClick={(event) => {
        event.stopPropagation();
        navigate(`/joueur/${player.user_id}`);
      }}
      aria-label={`Voir le profil de ${player.username}`}
      style={style}
    >
      {children ?? player.username}
    </button>
  );
}

export default function MultiplayerArena({ roomCode, user, onBack }) {
  // === LOBBY STATE (from polling) ===
  const [lobbyState, setLobbyState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [questionError, setQuestionError] = useState('');

  // === GAME PHASE ===
  // 'waiting' | 'countdown' | 'playing' | 'feedback' | 'waiting_end' | 'results'
  const [gamePhase, setGamePhase] = useState('waiting');

  // === COUNTDOWN ===
  const [countdownValue, setCountdownValue] = useState(3);

  // === QUESTION STATE (player-independent) ===
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answerToken, setAnswerToken] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [openAnswer, setOpenAnswer] = useState('');
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [questionTimer, setQuestionTimer] = useState(15000);
  const [fetchingQuestion, setFetchingQuestion] = useState(false);

  // === TRIBUNAL STATES ===
  const [tribunalInput, setTribunalInput] = useState('');
  const [submittingTribunal, setSubmittingTribunal] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState(null);
  const [votingTribunal, setVotingTribunal] = useState(false);
  const [tribunalTimer, setTribunalTimer] = useState(0);

  // === IMPOSTEUR STATES ===
  const [revealWord, setRevealWord] = useState(false);
  const [votingImposteur, setVotingImposteur] = useState(false);

  const lastPhaseRef = useRef('');
  const lastRoundRef = useRef(-1);

  // === REFS ===
  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const feedbackRef = useRef(null);
  const totalQuestions = useRef(10);
  const gamePhaseRef = useRef('waiting');
  const gameModeRef = useRef(null);

  // === WEBSOCKET REFS ===
  const pusherRef = useRef(null);
  const channelRef = useRef(null);
  const pusherActiveRef = useRef(false);

  // Remembers our own tribunal answer text. During the voting phase, the
  // broadcast payload deliberately omits author identity (to keep votes
  // anonymous), so we recognize "our" submission client-side by matching
  // its answer_text against what we submitted — no extra request needed.
  const myTribunalAnswersRef = useRef({});
  const myTribunalVotedRef = useRef(false);
  const transitionTriggerRef = useRef(null);

  const fetchQuestionRef = useRef(null);
  const handleAnswerRef = useRef(null);
  const handleFinishRef = useRef(null);
  const fetchStatusRef = useRef(null);
  const applyChronoPassRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    gamePhaseRef.current = gamePhase;
  }, [gamePhase]);

  // ============================================================
  // COUNTDOWN: 3... 2... 1... GO! (Synchronized via 100ms high-precision ticks)
  // ============================================================
  const [localCountdownLeft, setLocalCountdownLeft] = useState(0);

  const startCountdown = useCallback((remainingMs) => {
    setLocalCountdownLeft(remainingMs);
    setCountdownValue(Math.ceil(remainingMs / 1000));

    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setLocalCountdownLeft(prev => {
        if (prev <= 100) {
          clearInterval(countdownRef.current);
          setGamePhase('playing');
          if (gameModeRef.current !== 'chrono_bomb' && fetchQuestionRef.current) fetchQuestionRef.current(0);
          else if (gameModeRef.current === 'chrono_bomb' && fetchStatusRef.current) fetchStatusRef.current();
          return 0;
        }
        const nextValue = prev - 100;
        setCountdownValue(Math.ceil(nextValue / 1000));
        return nextValue;
      });
    }, 100);
  }, []);

  // ============================================================
  // APPLY LOBBY STATE: shared logic for both the HTTP /status response
  // AND the Pusher 'lobby_state' broadcast payload. This is what lets
  // the broadcast skip the HTTP round-trip entirely — both code paths
  // converge here.
  // ============================================================
  const applyLobbyState = useCallback((data) => {
    clearTimeout(transitionTriggerRef.current);

    const round = data?.tribunal?.round ?? 0;

    // Keep our own answer text/vote status in sync with what the server confirms,
    // useful on reconnect/refresh when we didn't just submit it ourselves.
    if (data?.tribunal?.my_submission) {
      myTribunalAnswersRef.current[round] = data.tribunal.my_submission;
    }
    if (data?.tribunal?.has_voted) {
      myTribunalVotedRef.current = true;
    }

    if (data?.tribunal) {
      const currentRound = data.tribunal.round;
      const currentPhase = data.tribunal.phase;

      // Reset refs and input states immediately if round or phase changed during the active session
      if (currentRound !== lastRoundRef.current) {
        myTribunalVotedRef.current = false;
        setTribunalInput('');
        setSelectedSubId(null);
        lastRoundRef.current = currentRound;
      }
      if (currentPhase !== lastPhaseRef.current) {
        myTribunalVotedRef.current = false;
        setTribunalInput('');
        setSelectedSubId(null);
        lastPhaseRef.current = currentPhase;
      }

      // Force personal fields from local refs if the broadcast payload anonymized them
      const mySubmissionText = myTribunalAnswersRef.current[currentRound] || null;
      if (mySubmissionText) {
        data.tribunal.my_submission = mySubmissionText;
      }
      if (myTribunalVotedRef.current) {
        data.tribunal.has_voted = true;
      }

      // Also force the local player's status (has_submitted / has_voted) in the players list
      if (data.players && Array.isArray(data.players)) {
        data.players = data.players.map(p => {
          if (p.user_id === user.id) {
            return {
              ...p,
              has_submitted: mySubmissionText ? true : p.has_submitted,
              has_voted: myTribunalVotedRef.current ? true : p.has_voted
            };
          }
          return p;
        });
      }

      // During the tribunal voting/results phase, we add back "is_mine" client-side.
      const phase = data.tribunal.phase;
      if ((phase === 'voting' || phase === 'results') && Array.isArray(data.tribunal.submissions)) {
        const mine = mySubmissionText;
        data = {
          ...data,
          tribunal: {
            ...data.tribunal,
            submissions: data.tribunal.submissions.map(sub => {
              const isMine = sub.is_mine !== undefined 
                ? sub.is_mine 
                : (mine !== null && sub.answer_text === mine) || (sub.author_id !== undefined && sub.author_id === user.id);
              return {
                ...sub,
                is_mine: isMine
              };
            })
          }
        };
      }
    }

    if (data?.imposteur) {
      const currentPhase = data.imposteur.phase;
      if (currentPhase !== lastPhaseRef.current) {
        setRevealWord(false);
        setVotingImposteur(false);
        lastPhaseRef.current = currentPhase;
      }
      // Restore personal fields from existing React state if Pusher broadcast anonymized them
      if (lobbyState && lobbyState.imposteur && lobbyState.game_mode === 'imposteur') {
        if (!data.imposteur.my_role && lobbyState.imposteur.my_role) {
          data.imposteur.my_role = lobbyState.imposteur.my_role;
        }
        if (!data.imposteur.my_word && lobbyState.imposteur.my_word) {
          data.imposteur.my_word = lobbyState.imposteur.my_word;
        }
        if (data.imposteur.my_vote === null && lobbyState.imposteur.my_vote !== null) {
          data.imposteur.my_vote = lobbyState.imposteur.my_vote;
        }
      }
    }

    gameModeRef.current = data.game_mode;
    setLobbyState(data);
    
    if (data.status === 'playing' && data.game_mode === 'imposteur' && data.imposteur && !data.imposteur.my_word) {
      setTimeout(() => {
        if (fetchStatusRef.current) fetchStatusRef.current();
      }, 50);
    }

    setLoading(false);
    setError('');

    if (data.total_questions) {
      totalQuestions.current = data.total_questions;
    }

    const phase = gamePhaseRef.current;

    // Detect game start → transition to countdown
    if (data.status === 'playing' && phase === 'waiting') {
      if (data.countdown_remaining_ms > 0) {
        setGamePhase('countdown');
        startCountdown(data.countdown_remaining_ms);
      } else {
        // Countdown already elapsed (e.g. reconnect)
        setGamePhase('playing');
        if (gameModeRef.current !== 'chrono_bomb' && fetchQuestionRef.current) fetchQuestionRef.current(0);
      }
    }

    // Detect game finished → show results
    if (data.status === 'finished' && phase !== 'results') {
      setGamePhase('results');
      clearAllTimers();
    }
  }, [user.id, startCountdown]);

  const applyChronoPass = useCallback((pass) => {
    setLobbyState((previous) => {
      if (!previous?.chrono_bomb || previous.chrono_bomb.round !== pass.round) return previous;
      const alreadyApplied = previous.chrono_bomb.used_answers.some(
        (item) => item.user_id === pass.user_id && item.answer === pass.accepted_answer,
      );
      if (alreadyApplied) return previous;
      const author = previous.players.find((player) => player.user_id === pass.user_id);
      return {
        ...previous,
        players: previous.players.map((player) => player.user_id === pass.user_id
          ? { ...player, score: player.score + 1 }
          : player),
        chrono_bomb: {
          ...previous.chrono_bomb,
          current_player_id: pass.next_player_id,
          used_answers: [...previous.chrono_bomb.used_answers, {
            answer: pass.accepted_answer,
            user_id: pass.user_id,
            username: author?.username || 'Joueur',
          }].slice(-12),
        },
      };
    });
  }, []);

  const applyLobbyStateRef = useRef(null);
  useEffect(() => {
    applyLobbyStateRef.current = applyLobbyState;
    applyChronoPassRef.current = applyChronoPass;
  }, [applyLobbyState, applyChronoPass]);

  // ============================================================
  // INITIALIZE PUSHER (once we know the credentials from /status)
  // ============================================================
  const initPusher = useCallback((data) => {
    if (!data.pusher_key) return;
    if (pusherRef.current && (pusherActiveRef.current || pusherRef.current.connection.state === 'connecting')) {
      return;
    }

    console.log('Pusher configuration found. Initializing WebSocket connection...');
    try {
      if (pusherRef.current) {
        pusherRef.current.disconnect();
      }
      const pusher = new Pusher(data.pusher_key, {
        cluster: data.pusher_cluster || 'eu',
        forceTLS: true,
        enabledTransports: ['ws']
      });
      pusherRef.current = pusher;

      const channel = pusher.subscribe(`lobby-${roomCode}`);
      channelRef.current = channel;

      // The server now pushes the actual state directly in the event
      // payload, so we apply it immediately — no follow-up HTTP request.
      // This is what makes actions feel instant to OTHER players: they
      // never wait on a fetch, they just receive the new state.
      channel.bind('chrono_bomb_passed', (pass) => {
        if (applyChronoPassRef.current) applyChronoPassRef.current(pass);
      });

      channel.bind('lobby_refresh', () => {
        if (fetchStatusRef.current) fetchStatusRef.current();
      });

      channel.bind('lobby_state', (state) => {
        if (applyLobbyStateRef.current) {
          applyLobbyStateRef.current(state);
        }
      });

      // Stop the HTTP polling fallback once the WebSocket is confirmed
      // connected — polling resumes automatically (see fetchStatusLoop)
      // if the connection drops.
      pusher.connection.bind('state_change', (states) => {
        console.log(`Pusher connection state changed from ${states.previous} to ${states.current}`);
        const active = states.current === 'connected';
        pusherActiveRef.current = active;
        if (active) {
          clearTimeout(pollRef.current);
        } else if (states.current === 'disconnected' || states.current === 'unavailable' || states.current === 'failed') {
          clearTimeout(pollRef.current);
          pollRef.current = setTimeout(fetchStatusLoopRef.current, 1000);
        }
      });
    } catch (pusherErr) {
      console.error('Failed to init Pusher client:', pusherErr);
    }
  }, [roomCode]);

  // ============================================================
  // POLLING: HTTP fallback only. Used to bootstrap the very first
  // state + Pusher credentials, and to keep things moving if the
  // WebSocket connection is down. While Pusher is connected, this
  // loop is not scheduled (see initPusher's 'connected' handler).
  // ============================================================
  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get('/lobby/status', { room_code: roomCode });
      applyLobbyState(data);
      initPusher(data);
    } catch (err) {
      if (err.message && (err.message.includes('introuvable') || err.message.includes('404'))) {
        clearAllTimers();
        onBack();
      } else {
        // Status polling connection issue (silent console warning to prevent blocking UI)
        console.warn('Background status sync delay:', err.message);
      }
    }
  }, [roomCode, applyLobbyState, initPusher]);

  const fetchStatusLoop = useCallback(async () => {
    try {
      await fetchStatus();
    } catch (e) {
      console.error(e);
    } finally {
      // Only reschedule the next poll if Pusher isn't actively connected.
      // Once Pusher confirms 'connected', this loop stops rescheduling
      // itself (see initPusher) and the room runs entirely on push
      // events — this is what removes the 1-2s baseline latency.
      if (!pusherActiveRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = setTimeout(fetchStatusLoop, 2000);
      }
    }
  }, [fetchStatus]);

  const fetchStatusLoopRef = useRef(null);
  useEffect(() => {
    fetchStatusLoopRef.current = fetchStatusLoop;
  }, [fetchStatusLoop]);

  useEffect(() => {
    fetchStatusLoop();
    return () => clearAllTimers();
  }, [roomCode, fetchStatusLoop]);

  useEffect(() => {
    if (!lobbyState || !lobbyState.tribunal) return;
    const serverRemainingMs = lobbyState.tribunal.phase_remaining_ms;

    // Synchronize local timer with authoritative server remaining time
    setTribunalTimer(serverRemainingMs);
  }, [lobbyState]);

  // Local tick effect for high-precision countdown ticks (100ms)
  useEffect(() => {
    if (lobbyState?.game_mode !== 'tribunal' || gamePhase !== 'playing') {
      return;
    }

    const tickInterval = setInterval(() => {
      setTribunalTimer(prev => {
        if (prev <= 100) {
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => clearInterval(tickInterval);
  }, [lobbyState?.game_mode, gamePhase, lobbyState?.tribunal?.phase, lobbyState?.tribunal?.round]);

  // Trigger server-side phase transition when local timer expires
  useEffect(() => {
    if (lobbyState?.game_mode !== 'tribunal' || gamePhase !== 'playing') return;
    if (tribunalTimer === 0 && lobbyState.tribunal?.phase_remaining_ms > 0) {
      console.log('Local timer expired. Scheduling transition check with jitter...');
      clearTimeout(transitionTriggerRef.current);
      transitionTriggerRef.current = setTimeout(() => {
        if (fetchStatusRef.current) {
          fetchStatusRef.current();
        }
      }, 100 + Math.random() * 800); // 100ms to 900ms random delay
    }
  }, [tribunalTimer, lobbyState, gamePhase]);

  const handleTribunalSubmit = async (e) => {
    e.preventDefault();
    if (!tribunalInput.trim() || submittingTribunal) return;
    const answerText = tribunalInput.trim();
    const round = lobbyState?.tribunal?.round ?? 0;

    // Optimistic Update: Set the local ref and state immediately before making the API call
    // to prevent any race conditions with incoming Pusher broadcasts.
    myTribunalAnswersRef.current[round] = answerText;
    setLobbyState(prev => {
      if (!prev || !prev.tribunal) return prev;
      return {
        ...prev,
        players: prev.players.map(p => 
          p.user_id === user.id ? { ...p, has_submitted: true } : p
        ),
        tribunal: {
          ...prev.tribunal,
          my_submission: answerText
        }
      };
    });

    setSubmittingTribunal(true);
    try {
      await api.post('/lobby/tribunal/submit', {
        room_code: roomCode,
        answer: answerText
      });
    } catch (err) {
      console.error(err);
      // Rollback on error
      myTribunalAnswersRef.current[round] = null;
      setLobbyState(prev => {
        if (!prev || !prev.tribunal) return prev;
        return {
          ...prev,
          players: prev.players.map(p => 
            p.user_id === user.id ? { ...p, has_submitted: false } : p
          ),
          tribunal: {
            ...prev.tribunal,
            my_submission: null
          }
        };
      });
      alert(err.message || "Erreur de soumission");
    } finally {
      setSubmittingTribunal(false);
    }
  };

  const handleTribunalVote = async () => {
    if (!selectedSubId || votingTribunal) return;

    // Optimistic Update: Set the local ref and state immediately before making the API call
    // to prevent any race conditions with incoming Pusher broadcasts.
    myTribunalVotedRef.current = true;
    setLobbyState(prev => {
      if (!prev || !prev.tribunal) return prev;
      return {
        ...prev,
        players: prev.players.map(p => 
          p.user_id === user.id ? { ...p, has_voted: true } : p
        ),
        tribunal: {
          ...prev.tribunal,
          has_voted: true
        }
      };
    });

    setVotingTribunal(true);
    try {
      await api.post('/lobby/tribunal/vote', {
        room_code: roomCode,
        submission_id: selectedSubId
      });
    } catch (err) {
      console.error(err);
      // Rollback on error
      myTribunalVotedRef.current = false;
      setLobbyState(prev => {
        if (!prev || !prev.tribunal) return prev;
        return {
          ...prev,
          players: prev.players.map(p => 
            p.user_id === user.id ? { ...p, has_voted: false } : p
          ),
          tribunal: {
            ...prev.tribunal,
            has_voted: false
          }
        };
      });
      alert(err.message || "Erreur lors du vote");
    } finally {
      setVotingTribunal(false);
    }
  };



  // ============================================================
  // FINISH: Player completed all questions
  // ============================================================
  const handleFinish = useCallback(async () => {
    setGamePhase('waiting_end');
    clearInterval(timerRef.current);

    try {
      await api.post('/lobby/finish', { room_code: roomCode });
    } catch (err) {
      console.error('Finish error:', err);
    }
  }, [roomCode]);

  // ============================================================
  // SUBMIT ANSWER
  // ============================================================
  const handleAnswer = useCallback(async (optionKey) => {
    if (selectedOption || !answerToken || gamePhaseRef.current !== 'playing') return;

    setSelectedOption(optionKey);
    clearInterval(timerRef.current);

    try {
      const res = await api.post('/lobby/answer', {
        room_code: roomCode,
        answer_token: answerToken,
        answer: optionKey
      });

      setAnswerFeedback(res);
      if (res.points_awarded) {
        setPlayerScore(prev => prev + res.points_awarded);
      }

      // Show feedback phase for 2 seconds, then advance
      setGamePhase('feedback');
      feedbackRef.current = setTimeout(() => {
        const nextIdx = res.next_index;
        if (nextIdx >= totalQuestions.current) {
          if (handleFinishRef.current) handleFinishRef.current();
        } else {
          setGamePhase('playing');
          if (fetchQuestionRef.current) fetchQuestionRef.current(nextIdx);
        }
      }, 2000);

    } catch (err) {
      console.error('Answer submission error:', err);
      setQuestionError('Erreur de transmission de la réponse. Veuillez réessayer.');
      setSelectedOption(null); // Allow retry on error
    }
  }, [roomCode, answerToken]);

  // ============================================================
  // QUESTION FETCHING
  // ============================================================
  const fetchQuestion = useCallback(async (index) => {
    if (index >= totalQuestions.current) {
      if (handleFinishRef.current) handleFinishRef.current();
      return;
    }

    setFetchingQuestion(true);
    setSelectedOption(null);
    setOpenAnswer('');
    setAnswerFeedback(null);
    setQuestionError('');
    const timeLimit = (lobbyState && lobbyState.game_mode === 'speed_blitz') ? 5000 : 15000;
    setCurrentQuestionIndex(index);
    setQuestionTimer(timeLimit);

    try {
      const data = await api.get('/lobby/my-question', {
        room_code: roomCode,
        question_index: index
      });

      if (data.success) {
        setCurrentQuestion(data.question);
        setAnswerToken(data.answer_token);
        setFetchingQuestion(false);
        startQuestionTimer();
      }
    } catch (err) {
      console.error('Failed to fetch question:', err);
      setQuestionError('Impossible de charger la question. Connexion interrompue.');
      setFetchingQuestion(false);
    }
  }, [roomCode, lobbyState]);

  // ============================================================
  // QUESTION TIMER (15s countdown, smooth 100ms ticks)
  // ============================================================
  const startQuestionTimer = useCallback(() => {
    const timeLimit = (lobbyState && lobbyState.game_mode === 'speed_blitz') ? 5000 : 15000;
    clearInterval(timerRef.current);
    setQuestionTimer(timeLimit);

    timerRef.current = setInterval(() => {
      setQuestionTimer(prev => {
        if (prev <= 100) {
          clearInterval(timerRef.current);
          if (handleAnswerRef.current) handleAnswerRef.current('TIMEOUT'); // Auto-submit timeout
          return 0;
        }
        return prev - 100;
      });
    }, 100);
  }, [lobbyState]);

  // Update refs on every render to bind current callbacks scope
  fetchQuestionRef.current = fetchQuestion;
  handleAnswerRef.current = handleAnswer;
  handleFinishRef.current = handleFinish;
  fetchStatusRef.current = fetchStatus;



  // ============================================================
  // HOST: Start Game
  // ============================================================
  const handleStartGame = async () => {
    try {
      await api.post('/lobby/start', { room_code: roomCode });
      if (!pusherActiveRef.current) fetchStatus();
    } catch (err) {
      setError(err.message || 'Erreur au démarrage.');
    }
  };

  const handleLeaveLobby = async () => {
    try {
      await api.post('/lobby/leave', { room_code: roomCode });
    } catch (e) {
      console.error(e);
    } finally {
      clearAllTimers();
      onBack();
    }
  };

  const clearAllTimers = () => {
    clearTimeout(pollRef.current);
    clearInterval(timerRef.current);
    clearInterval(countdownRef.current);
    clearTimeout(feedbackRef.current);
    clearTimeout(transitionTriggerRef.current);

    myTribunalAnswersRef.current = {};
    myTribunalVotedRef.current = false;

    if (pusherRef.current) {
      console.log('Disconnecting Pusher WebSocket...');
      try {
        pusherRef.current.disconnect();
      } catch (e) {
        console.error(e);
      }
      pusherRef.current = null;
      channelRef.current = null;
      pusherActiveRef.current = false;
    }
  };

  // ============================================================
  // RENDER: Loading
  // ============================================================
  if (loading) {
    return (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="glass-card text-center max-w-sm w-full">
            <div style={{
              width: '40px', height: '40px',
              border: '3px solid rgba(255,255,255,0.05)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px auto'
            }} />
            <p style={{ color: 'var(--text-secondary)' }}>Connexion au salon...</p>
          </div>
        </div>
    );
  }

  if (error && !lobbyState) {
    return (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="glass-card text-center max-w-md w-full">
            <XCircle size={48} style={{ color: 'var(--error)', marginBottom: '16px', display: 'inline-block' }} />
            <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Erreur</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error}</p>
            <button className="btn-primary" onClick={onBack}>
              <ArrowLeft size={18} /> Retour
            </button>
          </div>
        </div>
    );
  }

  if (!lobbyState) return null;

  const isHost = lobbyState.host_id === user.id;

  // ============================================================
  // RENDER: WAITING ROOM
  // ============================================================
  if (gamePhase === 'waiting' && lobbyState.status === 'waiting') {
    return (
        <div className="flex-1 flex items-center justify-center p-4 animate-slide-up">
          <div className="glass-card" style={{ maxWidth: '600px', width: '100%', display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                Mode En Ligne —
                {
                    lobbyState.game_mode === 'classic' && "Classique"
                }{
                  lobbyState.game_mode === 'speed_blitz' && "Speed Blitz"
              }{
                  lobbyState.game_mode === 'sudden_death' && "Mort Subite"
              }{
                  lobbyState.game_mode === 'guess_number' && "Le Juste Nombre"
              }{
                  lobbyState.game_mode === 'chrono_bomb' && "Chrono-Bomb"
              }
              </span>
                <h2 style={{ fontSize: '1.5rem', marginTop: '4px' }}>Thème : {lobbyState.pack_name}</h2>
              </div>
              <button className="btn-secondary" onClick={handleLeaveLobby} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                <LogOut size={14} /> Quitter
              </button>
            </div>

            {/* Room Code */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'var(--bg-input)', borderRadius: '12px', padding: '28px',
              border: '1px solid var(--border-color)', textAlign: 'center'
            }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Code d'Invitation
            </span>
              <span style={{
                fontSize: '2.8rem', fontWeight: 900, color: 'var(--accent)',
                letterSpacing: '6px', fontFamily: 'monospace', margin: '8px 0'
              }}>
              {lobbyState.room_code}
            </span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Partagez ce code avec vos amis !
              </p>
            </div>

            {/* Player List */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                <Users size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: '1rem' }}>Joueurs connectés ({lobbyState.players.length})</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {lobbyState.players.map((p, i) => (
                    <div key={p.user_id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', backgroundColor: p.user_id === user.id ? 'rgba(45, 212, 191, 0.06)' : 'var(--bg-input)',
                      border: `1px solid ${p.user_id === user.id ? '#2dd4bf' : 'var(--border-color)'}`,
                      borderRadius: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>#{i + 1}</span>
                        
                        {/* Avatar and Border */}
                        <div style={{ position: 'relative', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {p.avatar_url ? (
                            p.avatar_url.startsWith('/uploads/') ? (
                              <img src={`${PUBLIC_BASE}${p.avatar_url}`} alt="Avatar" className={`avatar ${p.equipped_border || ''}`} style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                            ) : p.avatar_url.startsWith('http') ? (
                              <img src={p.avatar_url} alt="Avatar" className={`avatar ${p.equipped_border || ''}`} style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                            ) : (
                              <div className={`avatar-placeholder ${p.equipped_border || ''}`} style={{ width: '28px', height: '28px', borderRadius: '50%', fontSize: '0.9rem' }}>{p.avatar_url}</div>
                            )
                          ) : (
                            <div className={`avatar-placeholder ${p.equipped_border || ''}`} style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--border-color)' }}>
                              <User size={12} />
                            </div>
                          )}
                        </div>

                        {/* Name and Title */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <PlayerProfileLink
                              player={p}
                              className={p.equipped_color === 'rainbow' ? 'text-rainbow' : (p.equipped_color === 'cyberpunk' ? 'text-cyberpunk' : '')}
                              style={{ ...getUsernameStyle(p.global_score), color: p.equipped_color && !['rainbow', 'cyberpunk'].includes(p.equipped_color) ? p.equipped_color : undefined, fontWeight: 700 }}
                            >
                              {p.username}
                            </PlayerProfileLink>
                            {p.user_id === user.id && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Vous)</span>}
                          </div>
                          {p.equipped_title && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '1px' }}>
                              {p.equipped_title}
                            </span>
                          )}
                        </div>
                      </div>
                      {p.user_id === lobbyState.host_id && (
                          <span style={{
                            backgroundColor: 'rgba(45, 212, 191, 0.15)', color: '#2dd4bf',
                            fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase'
                          }}>Hôte</span>
                      )}
                    </div>
                ))}
              </div>
            </div>

            {/* Start Button / Waiting */}
            {isHost ? (
                <button className="btn-primary" onClick={handleStartGame}
                        style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
                        disabled={lobbyState.players.length < (lobbyState.game_mode === 'chrono_bomb' ? 2 : 1)}>
                  <Play size={20} /> Lancer la Partie ({lobbyState.players.length} joueur{lobbyState.players.length > 1 ? 's' : ''})
                </button>
            ) : (
                <div style={{
                  textAlign: 'center', padding: '14px', color: 'var(--text-secondary)',
                  backgroundColor: 'rgba(15, 23, 42, 0.35)', borderRadius: '12px',
                  border: '1px dashed var(--border-color)', fontSize: '0.9rem'
                }}>
                  En attente du lancement par <strong style={{ color: '#2dd4bf' }}>{lobbyState.host_username}</strong>...
                </div>
            )}
          </div>
        </div>
    );
  }

  // ============================================================
  // RENDER: COUNTDOWN 3... 2... 1... GO!
  // ============================================================
  if (gamePhase === 'countdown') {
    return (
        <div className="flex-1 flex items-center justify-center p-4" style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Background pulse effect */}
          <div style={{
            position: 'absolute', width: '300px', height: '300px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(45, 212, 191, 0.2) 0%, transparent 70%)',
            animation: 'pulse 1s ease-in-out infinite'
          }} />

          <div style={{ textAlign: 'center', zIndex: 1 }}>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
              La partie commence dans
            </p>
            <div key={countdownValue} style={{
              fontSize: '8rem', fontWeight: 900, color: 'var(--accent)',
              lineHeight: 1, animation: 'fadeIn 0.3s ease-out',
              textShadow: '0 0 40px rgba(45, 212, 191, 0.5)'
            }}>
              {countdownValue > 0 ? countdownValue : 'GO!'}
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '20px' }}>
              {lobbyState.pack_name} — {totalQuestions.current} questions
            </p>
          </div>

          <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.3); opacity: 0.8; }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.5); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>
        </div>
    );
  }

  // ============================================================
  if (lobbyState.game_mode === 'chrono_bomb' && gamePhase === 'playing' && lobbyState.chrono_bomb) {
    return (
      <ChronoBombGame
        data={lobbyState.chrono_bomb}
        players={lobbyState.players}
        userId={user.id}
        roomCode={roomCode}
        api={api}
        onRefresh={fetchStatus}
        onPass={applyChronoPass}
      />
    );
  }

  // RENDER: TRIBUNAL
  // ============================================================
  const renderTribunalGame = () => {
    const tribunal = lobbyState.tribunal;
    if (!tribunal) return null;

    const phase = tribunal.phase;
    const timeLimit = phase === 'writing' ? 45000 : (phase === 'voting' ? 30000 : 15000);
    const timeRatio = tribunalTimer / timeLimit;
    const secondsLeft = Math.ceil(tribunalTimer / 1000);

    return (
        <div className="container animate-fade-in game-layout">

          {/* LEFT: Game Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Phase Header & Timer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Manche {tribunal.round + 1} — {
              phase === 'writing' ? 'Saisie des réponses' : (phase === 'voting' ? 'Vote du Tribunal' : 'Résultats de la manche')
            }
            </span>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px',
                backgroundColor: phase === 'results' ? 'var(--success-glow)' : (tribunalTimer <= 5000 ? 'var(--error-glow)' : 'var(--bg-card)'),
                color: phase === 'results' ? 'var(--success)' : (tribunalTimer <= 5000 ? 'var(--error)' : 'var(--accent)'),
                border: `1px solid ${phase === 'results' ? 'var(--success)' : (tribunalTimer <= 5000 ? 'var(--error)' : 'var(--border-color)')}`,
                fontWeight: 700, fontSize: '0.9rem'
              }}>
                <Clock size={14} />
                {secondsLeft}s
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${timeRatio * 100}%`,
                height: '100%',
                backgroundColor: phase === 'results' ? 'var(--success)' : (tribunalTimer <= 5000 ? 'var(--error)' : 'var(--accent)'),
                transition: 'width 0.1s linear'
              }} />
            </div>

            {/* Prompt Card */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '32px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Le Dilemme du Jour
            </span>
              <h2 style={{ fontSize: '1.6rem', lineHeight: 1.4, fontWeight: 600, margin: 0, wordBreak: 'break-word' }}>
                {tribunal.prompt_text}
              </h2>

              {/* PHASE 1: WRITING */}
              {phase === 'writing' && (
                  <div style={{ marginTop: '12px' }}>
                    {tribunal.my_submission ? (
                        <div style={{
                          padding: '20px', borderRadius: '12px', border: '1px solid var(--success)',
                          backgroundColor: 'rgba(0, 255, 157, 0.03)', textAlign: 'center'
                        }}>
                          <CheckCircle2 size={32} style={{ color: 'var(--success)', margin: '0 auto 12px' }} />
                          <p style={{ fontWeight: 600, fontSize: '1.1rem', margin: 0 }}>Votre réponse a été enregistrée :</p>
                          <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)', marginTop: '8px', fontSize: '1.05rem' }}>
                            "{tribunal.my_submission}"
                          </p>
                          <small style={{ display: 'block', marginTop: '12px', color: 'var(--text-secondary)' }}>
                            En attente de la saisie des autres joueurs...
                          </small>
                        </div>
                    ) : (
                        <form onSubmit={handleTribunalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <textarea
                        value={tribunalInput}
                        onChange={(e) => setTribunalInput(e.target.value)}
                        placeholder="Tapez votre réponse secrète ici... Soyez drôle, créatif ou machiavélique !"
                        maxLength={180}
                        disabled={submittingTribunal}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '16px',
                          borderRadius: '12px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: '1.1rem',
                          outline: 'none',
                          resize: 'none',
                          fontFamily: 'inherit'
                        }}
                        autoFocus
                    />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {180 - tribunalInput.length} caractères restants
                      </span>
                            <button type="submit" className="btn-primary" disabled={submittingTribunal || !tribunalInput.trim()} style={{ padding: '12px 28px' }}>
                              {submittingTribunal ? 'Envoi...' : 'Valider ma réponse'}
                            </button>
                          </div>
                        </form>
                    )}
                  </div>
              )}

              {/* PHASE 2: VOTING */}
              {phase === 'voting' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                    {tribunal.has_voted ? (
                        <div style={{
                          padding: '20px', borderRadius: '12px', border: '1px solid var(--success)',
                          backgroundColor: 'rgba(0, 255, 157, 0.03)', textAlign: 'center'
                        }}>
                          <CheckCircle2 size={32} style={{ color: 'var(--success)', margin: '0 auto 12px' }} />
                          <p style={{ fontWeight: 600, fontSize: '1.1rem', margin: 0 }}>Votre vote a été pris en compte !</p>
                          <small style={{ display: 'block', marginTop: '8px', color: 'var(--text-secondary)' }}>
                            En attente des autres votes...
                          </small>
                        </div>
                    ) : (
                        <>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                            Sélectionnez la réponse qui mérite de gagner cette manche (vous ne pouvez pas voter pour vous-même) :
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {tribunal.submissions.map((sub) => (
                                <button
                                    key={sub.id}
                                    disabled={sub.is_mine || votingTribunal}
                                    onClick={() => setSelectedSubId(sub.id)}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      width: '100%',
                                      padding: '16px 20px',
                                      backgroundColor: selectedSubId === sub.id ? 'var(--bg-hover)' : 'var(--bg-card)',
                                      border: `2px solid ${
                                          selectedSubId === sub.id ? 'var(--accent)' : 'var(--border-color)'
                                      }`,
                                      borderRadius: '12px',
                                      cursor: sub.is_mine ? 'not-allowed' : 'pointer',
                                      textAlign: 'left',
                                      color: 'var(--text-primary)',
                                      fontSize: '1.05rem',
                                      opacity: sub.is_mine ? 0.5 : 1,
                                      transition: 'var(--transition)'
                                    }}
                                >
                                  <span style={{ fontStyle: 'italic', marginRight: '16px', wordBreak: 'break-word' }}>"{sub.answer_text}"</span>
                                  {sub.is_mine ? (
                                      <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                              Votre réponse
                            </span>
                                  ) : (
                                      <div style={{
                                        width: '20px', height: '20px', borderRadius: '50%',
                                        border: `2px solid ${selectedSubId === sub.id ? 'var(--accent)' : 'var(--border-color)'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        backgroundColor: selectedSubId === sub.id ? 'var(--accent)' : 'transparent'
                                      }}>
                                        {selectedSubId === sub.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#000' }} />}
                                      </div>
                                  )}
                                </button>
                            ))}
                          </div>

                          {!tribunal.has_voted && selectedSubId && (
                              <button
                                  onClick={handleTribunalVote}
                                  disabled={votingTribunal}
                                  className="btn-primary"
                                  style={{ alignSelf: 'flex-end', padding: '12px 28px', marginTop: '8px' }}
                              >
                                {votingTribunal ? 'Envoi...' : 'Confirmer mon vote 🗳️'}
                              </button>
                          )}
                        </>
                    )}
                  </div>
              )}

              {/* PHASE 3: RESULTS */}
              {phase === 'results' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', margin: 0 }}>
                      Résultats des votes :
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {tribunal.submissions.map((sub, idx) => {
                        const isWinner = idx === 0 && sub.vote_count > 0;
                        return (
                            <div
                                key={sub.id}
                                style={{
                                  padding: '20px',
                                  backgroundColor: isWinner ? 'rgba(45, 212, 191, 0.08)' : 'var(--bg-input)',
                                  border: `1px solid ${isWinner ? '#2dd4bf' : 'var(--border-color)'}`,
                                  borderRadius: '12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '12px'
                                }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <span style={{ fontSize: '1.1rem', fontStyle: 'italic', fontWeight: 600, wordBreak: 'break-word' }}>
                            "{sub.answer_text}"
                          </span>
                                <span style={{
                                  fontSize: '0.9rem',
                                  fontWeight: 800,
                                  color: sub.vote_count > 0 ? 'var(--accent)' : 'var(--text-secondary)',
                                  backgroundColor: 'rgba(255,255,255,0.02)',
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  whiteSpace: 'nowrap'
                                }}>
                            🗳️ {sub.vote_count} vote{sub.vote_count > 1 ? 's':''}
                          </span>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                          <span>
                            Auteur : <strong style={{ color: sub.is_mine ? 'var(--accent)' : 'var(--text-primary)' }}>
                              {sub.author_username} {sub.is_mine ? '(Vous)' : ''}
                            </strong>
                          </span>
                                {sub.vote_count > 0 && (
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                              Voté par : {sub.votes.join(', ')}
                            </span>
                                )}
                              </div>
                            </div>
                        );
                      })}
                    </div>
                  </div>
              )}

            </div>
          </div>

          {/* RIGHT: Live Scoreboard */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '24px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} style={{ color: 'var(--accent)' }} /> Classement Live
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lobbyState.players.map((p, i) => {
                const isMe = p.user_id === user.id;

                // Status text in writing/voting phase
                let statusLabel = null;
                if (phase === 'writing') {
                  statusLabel = p.has_submitted ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={13} /> Prêt
                      </span>
                  ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', animation: 'pulse 1.5s infinite' }}>
                        <Pencil size={13} /> Écrit...
                      </span>
                  );
                } else if (phase === 'voting') {
                  statusLabel = p.has_voted ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Vote size={13} /> Voté
                      </span>
                  ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', animation: 'pulse 1.5s infinite' }}>
                        <HelpCircle size={13} /> Vote...
                      </span>
                  );
                }

                return (
                    <div key={p.user_id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: isMe ? 'rgba(45, 212, 191, 0.08)' : 'var(--bg-input)',
                      border: `1px solid ${isMe ? 'rgba(45, 212, 191, 0.3)' : 'var(--border-color)'}`,
                      borderRadius: '10px', fontSize: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.8rem' }}>#{i + 1}</span>
                        <PlayerProfileLink player={p} style={{ ...getUsernameStyle(p.global_score), fontWeight: isMe ? 700 : 500 }}>
                      {p.username}{isMe ? ' (Vous)' : ''}
                    </PlayerProfileLink>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.8rem' }}>{p.score} pts</span>
                        {statusLabel}
                      </div>
                    </div>
                );
              })}
            </div>
          </div>
        </div>
    );
  };

  // ============================================================
  // L'IMPOSTEUR GAME MODE RENDERING
  // ============================================================
  const renderImposteurGame = () => {
    const imposteurData = lobbyState?.imposteur;
    if (!imposteurData) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <span style={{ marginLeft: '12px', color: 'var(--text-secondary)' }}>Chargement du mode de jeu...</span>
        </div>
      );
    }

    const { phase, theme, my_role, my_word, my_vote, eliminated_user_id } = imposteurData;
    const players = lobbyState?.players || [];
    const hostId = lobbyState?.host_id;
    const isHost = (hostId === user.id);
    const myPlayerInfo = players.find(p => p.user_id === user.id);
    const isEliminated = !!myPlayerInfo?.is_eliminated;

    // Helper: submit vote to backend
    const handleImposteurVote = async (targetId) => {
      if (votingImposteur) return;
      setVotingImposteur(true);
      try {
        await api.post('/lobby/imposteur/vote', {
          room_code: roomCode,
          voted_for_user_id: targetId
        });
      } catch (err) {
        console.error('Failed to submit imposteur vote:', err);
        alert(err.message || 'Erreur lors du vote.');
      } finally {
        setVotingImposteur(false);
      }
    };

    // Helper: start voting phase (host only)
    const handleStartVoting = async () => {
      try {
        await api.post('/lobby/imposteur/start-voting', { room_code: roomCode });
      } catch (err) {
        console.error('Failed to start voting phase:', err);
        alert(err.message || 'Erreur.');
      }
    };

    // Helper: start next round (host only)
    const handleNextRound = async () => {
      try {
        await api.post('/lobby/imposteur/next-round', { room_code: roomCode });
      } catch (err) {
        console.error('Failed to start next round:', err);
        alert(err.message || 'Erreur.');
      }
    };

    return (
      <div className="flex-1 flex flex-col p-4 animate-fade-in" style={{ maxWidth: '800px', width: '100%', margin: '0 auto', gap: '20px' }}>
        
        {/* PHASE 1: DEBATE (IRL) */}
        {phase === 'debate' && (
          <div className="glass-card flex flex-col gap-6" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <MessageSquare size={26} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Débat en cours (IRL)</h2>
              </div>
              <span style={{ padding: '6px 14px', backgroundColor: 'rgba(255, 42, 133, 0.1)', color: '#ff2a85', border: '1px solid rgba(255, 42, 133, 0.2)', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                Thème : {theme}
              </span>
            </div>

            <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
                💬 <strong>Règles du débat :</strong> Décrivez votre mot secret à tour de rôle sans le prononcer directement. L'imposteur a un mot légèrement différent et doit bluffer pour ne pas se faire repérer tout en essayant de deviner le mot des innocents. La discussion se fait entièrement <strong>face-à-face (IRL)</strong>.
              </p>
            </div>

            {/* Secret Word Display Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255,0,127,0.06), rgba(127,0,255,0.06))',
              border: '1px dashed rgba(255,0,127,0.2)', borderRadius: '16px', padding: '24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px',
              textAlign: 'center', minHeight: '160px', position: 'relative'
            }}>
              {isEliminated ? (
                <>
                  <Skull size={36} style={{ color: 'var(--error)' }} />
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--error)' }}>Vous avez été éliminé !</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Vous pouvez observer le reste du groupe débattre.</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                    Votre mot secret
                  </span>
                  
                  {revealWord ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', animation: 'scale-up 0.2s ease-out' }}>
                      <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        {my_word}
                      </span>
                      <span style={{
                        fontSize: '0.85rem', fontWeight: 700,
                        color: my_role === 'imposteur' ? 'var(--error)' : 'var(--success)',
                        padding: '4px 10px', backgroundColor: my_role === 'imposteur' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                        borderRadius: '6px'
                      }}>
                        {my_role === 'imposteur' ? 'Vous êtes l\'Imposteur 😈' : 'Vous êtes Innocent 😇'}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                      <EyeOff size={32} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mot masqué pour préserver le secret</span>
                    </div>
                  )}

                  <button
                    onClick={() => setRevealWord(!revealWord)}
                    className="btn-secondary"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    {revealWord ? <EyeOff size={14} /> : <Eye size={14} />}
                    {revealWord ? 'Masquer le mot' : 'Afficher le mot'}
                  </button>
                </>
              )}
            </div>

            {/* Players Status List */}
            <div>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Statut des Joueurs ({players.filter(p => !p.is_eliminated).length} en vie)
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {players.map(p => {
                  const dead = !!p.is_eliminated;
                  return (
                    <div key={p.user_id} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 14px', borderRadius: '8px',
                      backgroundColor: dead ? 'rgba(255,255,255,0.02)' : 'var(--bg-input)',
                      border: `1px solid ${dead ? 'rgba(255,68,68,0.1)' : 'var(--border-color)'}`,
                      opacity: dead ? 0.5 : 1
                    }}>
                      <PlayerProfileLink player={p} style={{ ...getUsernameStyle(p.global_score), fontSize: '0.85rem', fontWeight: 600 }}>
                        {p.username}
                      </PlayerProfileLink>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: dead ? 'var(--error)' : 'var(--success)' }}>
                        {dead ? '💀 Éliminé' : '💚 En vie'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Host Actions */}
            {isHost && (
              <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button className="btn-primary" onClick={handleStartVoting} style={{ padding: '12px 28px', fontSize: '0.95rem' }}>
                  <Vote size={18} style={{ marginRight: '6px' }} />
                  Lancer la phase de vote 🗳️
                </button>
              </div>
            )}
          </div>
        )}

        {/* PHASE 2: VOTING */}
        {phase === 'voting' && (
          <div className="glass-card flex flex-col gap-6" style={{ padding: '32px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '6px' }}>
                <Vote size={26} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Phase de Vote</h2>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Votez pour le joueur suspecté d'être l'Imposteur.
              </p>
            </div>

            {/* Grid of Players to Vote For */}
            {isEliminated ? (
              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '32px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <Skull size={32} style={{ color: 'var(--error)', marginBottom: '8px' }} />
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem' }}>Vous êtes éliminé</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>Vous ne pouvez pas participer au vote de cette manche.</p>
              </div>
            ) : my_vote ? (
              <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(34,197,94,0.02))', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                <CheckCircle2 size={32} style={{ color: 'var(--success)', marginBottom: '8px', display: 'inline-block' }} />
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 700 }}>Vote enregistré !</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
                  Vous avez voté pour <strong>{players.find(p => p.user_id === my_vote)?.username}</strong>. Attente des autres votes...
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span className="section-label">Sélectionner un suspect :</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {players.filter(p => !p.is_eliminated && p.user_id !== user.id).map(p => (
                    <button
                      key={p.user_id}
                      onClick={() => handleImposteurVote(p.user_id)}
                      disabled={votingImposteur}
                      className="btn-secondary flex flex-col items-center justify-center"
                      style={{
                        padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)', cursor: 'pointer', gap: '8px', minHeight: '80px', transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ ...getUsernameStyle(p.global_score), fontSize: '0.9rem', fontWeight: 700 }}>
                        {p.username}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Accuser
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live Voting Progress */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Suivi des votes ({players.filter(p => !p.is_eliminated && p.has_voted).length} / {players.filter(p => !p.is_eliminated).length} votes)
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {players.filter(p => !p.is_eliminated).map(p => (
                  <div key={p.user_id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 12px', borderRadius: '6px',
                    backgroundColor: p.has_voted ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${p.has_voted ? 'rgba(34,197,94,0.15)' : 'var(--border-color)'}`
                  }}>
                    <PlayerProfileLink player={p} style={{ ...getUsernameStyle(p.global_score), fontSize: '0.8rem', fontWeight: 600 }}>
                      {p.username}
                    </PlayerProfileLink>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: p.has_voted ? 'var(--success)' : 'var(--text-muted)' }}>
                      {p.has_voted ? 'A voté ✅' : 'Réfléchit... 💬'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PHASE 3: ROUND RESULTS */}
        {phase === 'results' && (
          <div className="glass-card flex flex-col gap-6" style={{ padding: '32px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 4px 0' }}>Verdict du Groupe 📢</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Le vote de la table est clos.
              </p>
            </div>

            {/* Elimination Result Card */}
            {(() => {
              const elimPlayer = players.find(p => p.user_id === eliminated_user_id);
              if (!elimPlayer) return null;
              const wasImposteur = elimPlayer.imposteur_role === 'imposteur';

              return (
                <div style={{
                  background: wasImposteur
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(0, 0, 0, 0.25))'
                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(0, 0, 0, 0.25))',
                  border: `1px solid ${wasImposteur ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  borderRadius: '16px', padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
                }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: wasImposteur ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {wasImposteur ? <Trophy size={32} style={{ color: 'var(--success)' }} /> : <Skull size={32} style={{ color: 'var(--error)' }} />}
                  </div>
                  
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.4rem', fontWeight: 800 }}>
                      {elimPlayer.username} a été éliminé !
                    </h3>
                    <p style={{
                      fontSize: '1.1rem', fontWeight: 700, margin: 0,
                      color: wasImposteur ? 'var(--success)' : 'var(--error)'
                    }}>
                      {wasImposteur
                        ? 'C\'était l\'Imposteur ! 🎉'
                        : 'C\'était un Innocent... 😔'
                      }
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Votes breakdown */}
            <div>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Détail des votes de ce tour :
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {players.filter(p => !p.is_eliminated || p.user_id === eliminated_user_id).map(p => {
                  const votesReceived = p.imposteur_votes_received || 0;
                  const votersList = players.filter(v => v.imposteur_voted_for_user_id === p.user_id).map(v => v.username);
                  
                  return (
                    <div key={p.user_id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <PlayerProfileLink player={p} style={{ ...getUsernameStyle(p.global_score), fontWeight: 700, fontSize: '0.88rem' }}>
                          {p.username} {p.user_id === eliminated_user_id ? '💀' : ''}
                        </PlayerProfileLink>
                        {votesReceived > 0 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Voté par : {votersList.join(', ')}
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.8rem', fontWeight: 700, padding: '4px 10px',
                        backgroundColor: votesReceived > 0 ? 'rgba(255,255,255,0.05)' : 'transparent',
                        color: votesReceived > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                        border: votesReceived > 0 ? '1px solid var(--border-color)' : 'none',
                        borderRadius: '12px'
                      }}>
                        {votesReceived} vote{votesReceived > 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Host actions if game still running */}
            {lobbyState?.status === 'playing' && isHost && (
              <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button className="btn-primary" onClick={handleNextRound} style={{ padding: '12px 28px', fontSize: '0.95rem' }}>
                  Lancer la manche suivante 🔄
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderImposteurFinalResults = () => {
    const players = lobbyState?.players || [];
    const imposteurPlayer = players.find(p => p.imposteur_role === 'imposteur');
    
    // Win calculation: if imposteur player is eliminated, innocents won!
    const imposteurWon = imposteurPlayer ? !imposteurPlayer.is_eliminated : false;

    return (
      <div className="flex-1 flex items-center justify-center p-4 animate-slide-up">
        <div className="glass-card" style={{ maxWidth: '650px', width: '100%', display: 'flex', flexDirection: 'column', gap: '28px', padding: '32px' }}>
          
          {/* Trophy Header */}
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              backgroundColor: 'rgba(255, 215, 0, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255, 215, 0, 0.2)', marginBottom: '8px'
            }}>
              <Trophy size={36} style={{ color: '#ffd700' }} />
            </div>
            
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>
              {imposteurWon ? "Victoire de l'Imposteur ! 😈" : "Victoire des Innocents ! 🎉"}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '400px', lineHeight: 1.4, margin: '4px 0 0 0' }}>
              {imposteurWon
                ? "L'Imposteur a réussi à éliminer tous les innocents ou à bluffer jusqu'à la fin !"
                : "Les innocents ont démasqué et éliminé l'Imposteur avec succès !"
              }
            </p>
          </div>

          {/* Words recap */}
          <div style={{
            backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '12px',
            padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', textAlign: 'center'
          }}>
            <div>
              Thème : <strong style={{ color: 'var(--accent)' }}>{lobbyState.imposteur_theme}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
              <div>
                Mot des Innocents : <strong style={{ color: 'var(--success)' }}>{lobbyState.imposteur_word_innocent}</strong>
              </div>
              <div style={{ width: '1px', backgroundColor: 'var(--border-color)' }} />
              <div>
                Mot de l'Imposteur : <strong style={{ color: 'var(--error)' }}>{lobbyState.imposteur_word_imposteur}</strong>
              </div>
            </div>
          </div>

          {/* Player result summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Bilan des Joueurs
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {players.map((p) => {
                const isWinner = (p.imposteur_role === 'imposteur' && imposteurWon) || (p.imposteur_role === 'innocent' && !imposteurWon);
                
                return (
                  <div key={p.user_id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', backgroundColor: p.user_id === user.id ? 'rgba(45, 212, 191, 0.06)' : 'var(--bg-input)',
                    borderRadius: '12px', border: `1px solid ${p.user_id === user.id ? 'rgba(45, 212, 191, 0.2)' : 'var(--border-color)'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <PlayerProfileLink player={p} style={{ ...getUsernameStyle(p.global_score), fontWeight: p.user_id === user.id ? 700 : 500 }}>
                        {p.username} {p.user_id === user.id ? ' (Vous)' : ''}
                      </PlayerProfileLink>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                        backgroundColor: p.imposteur_role === 'imposteur' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                        color: p.imposteur_role === 'imposteur' ? 'var(--error)' : 'var(--text-secondary)'
                      }}>
                        {p.imposteur_role === 'imposteur' ? 'Imposteur' : 'Innocent'}
                      </span>
                      {p.is_eliminated === 1 && (
                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.2)', color: 'var(--text-muted)' }}>
                          💀 Éliminé
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {/* Win/Lose tag */}
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 800,
                        color: isWinner ? 'var(--success)' : 'var(--text-muted)'
                      }}>
                        {isWinner ? 'Victoire 🎉' : 'Défaite'}
                      </span>

                      {/* Coins changes */}
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffb300', minWidth: '60px', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        +{isWinner ? 100 : 10} <Coins size={13} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Back button */}
          <button className="btn-primary" onClick={() => { clearAllTimers(); onBack(); }}
                  style={{ width: '100%', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <ArrowLeft size={18} /> Retour au Tableau de Bord
          </button>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: PLAYING (question + answer)
  // ============================================================
  if (gamePhase === 'playing' || gamePhase === 'feedback') {
    const isFeedback = gamePhase === 'feedback';
    const myPlayerInfo = lobbyState?.players.find(p => p.user_id === user.id);
    const isEliminated = myPlayerInfo?.is_eliminated;

    const timeLimit = 15000;
    const timeRatio = questionTimer / timeLimit;

    return (
        <div className="container animate-fade-in game-layout">

          {/* LEFT: Question Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Error Banner */}
            {questionError && (
                <div style={{
                  padding: '12px 16px', borderRadius: '8px',
                  backgroundColor: 'rgba(255, 59, 105, 0.1)', border: '1px solid var(--error)',
                  color: 'var(--error)', fontWeight: 600, fontSize: '0.9rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span>{questionError}</span>
                  <button className="btn-secondary" onClick={() => { setQuestionError(''); fetchQuestion(currentQuestionIndex); }} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    Réessayer
                  </button>
                </div>
            )}

            {/* Progress bar header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Question {currentQuestionIndex + 1} / {totalQuestions.current}
            </span>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px',
                backgroundColor: isFeedback ? 'var(--success-glow)' : (questionTimer <= 3000 ? 'var(--error-glow)' : 'var(--bg-card)'),
                color: isFeedback ? 'var(--success)' : (questionTimer <= 3000 ? 'var(--error)' : 'var(--accent)'),
                border: `1px solid ${isFeedback ? 'var(--success)' : (questionTimer <= 3000 ? 'var(--error)' : 'var(--border-color)')}`,
                fontWeight: 700, fontSize: '0.9rem'
              }}>
                <Clock size={14} />
                {isFeedback ? '✓' : `${(questionTimer / 1000).toFixed(1)}s`}
              </div>
            </div>

            {/* Timer progress bar */}
            <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: isFeedback ? '100%' : `${timeRatio * 100}%`,
                height: '100%',
                backgroundColor: isFeedback ? 'var(--success)' : (questionTimer <= 3000 ? 'var(--error)' : 'var(--accent)'),
                transition: isFeedback ? 'width 0.3s ease' : 'none'
              }} />
            </div>

            {/* Score display */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', backgroundColor: 'rgba(45, 212, 191, 0.1)',
              borderRadius: '10px', border: '1px solid rgba(45, 212, 191, 0.2)', alignSelf: 'flex-start'
            }}>
              <Trophy size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.9rem' }}>{playerScore} pts</span>
            </div>

            {/* Question Card */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {isEliminated ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--error)' }}>
                    <XCircle size={48} style={{ margin: '0 auto 16px' }} />
                    <h2 style={{ fontSize: '1.2rem' }}>Vous êtes éliminé</h2>
                    <p>Vous pouvez toujours suivre la partie en spectateur.</p>
                  </div>
              ) : fetchingQuestion ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px auto', display: 'block' }} />
                    Chargement de la question...
                  </div>
              ) : currentQuestion ? (
                  <>
                    <h2 style={{ fontSize: '1.3rem', lineHeight: 1.4, fontWeight: 600 }}>
                      {currentQuestion.question_text}
                    </h2>

                    {currentQuestion.media_url && (
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
                          <img 
                              src={currentQuestion.media_url.startsWith('http') 
                                ? currentQuestion.media_url 
                                : currentQuestion.media_url.replace(/^\/?(images\/)?/, '/images/')
                              } 
                              alt="Illustration de la question" 
                              style={{ 
                                maxWidth: '100%', 
                                maxHeight: '280px', 
                                borderRadius: '8px', 
                                objectFit: 'contain', 
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                              }} 
                          />
                        </div>
                    )}

                    {currentQuestion.question_type === 'open' || !currentQuestion.options ? (
                        <form onSubmit={(e) => { e.preventDefault(); handleAnswer(openAnswer.trim()); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <input
                              type="text"
                              value={openAnswer}
                              onChange={(e) => setOpenAnswer(e.target.value)}
                              placeholder="Entrez votre réponse..."
                              disabled={!!selectedOption || isFeedback}
                              style={{
                                width: '100%',
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-input)',
                                color: 'var(--text-primary)',
                                fontSize: '1.1rem',
                                outline: 'none'
                              }}
                              autoFocus
                          />
                          {!selectedOption && !isFeedback && (
                              <button type="submit" className="btn-primary" disabled={!openAnswer.trim()} style={{ alignSelf: 'flex-start', padding: '12px 24px' }}>
                                Valider
                              </button>
                          )}
                        </form>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {Object.entries(currentQuestion.options).map(([key, text]) => {
                            const isSelected = selectedOption === key;
                            const isCorrect = answerFeedback && answerFeedback.correct_option === key;

                            let btnClass = 'option-btn';
                            if (isFeedback) {
                              if (isCorrect) btnClass += ' correct';
                              else if (isSelected) btnClass += ' incorrect';
                              else btnClass += ' disabled';
                            } else if (isSelected) {
                              btnClass += ' selected';
                            }

                            return (
                                <button key={key} className={btnClass}
                                        onClick={() => handleAnswer(key)}
                                        disabled={!!selectedOption || isFeedback}>
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          <span className="option-badge">{key}</span>
                          {text}
                        </span>
                                  {isFeedback && isCorrect && <CheckCircle2 size={18} />}
                                  {isFeedback && isSelected && !isCorrect && <XCircle size={18} />}
                                </button>
                            );
                          })}
                        </div>
                    )}

                    {/* Feedback message */}
                    {isFeedback && answerFeedback && (
                        <div className="animate-fade-in" style={{
                          padding: '12px 16px', borderRadius: '8px',
                          backgroundColor: answerFeedback.correct ? 'var(--success-glow)' : 'var(--error-glow)',
                          border: `1px solid ${answerFeedback.correct ? 'var(--success)' : 'var(--error)'}`,
                          display: 'flex', alignItems: 'center', gap: '10px'
                        }}>
                          {answerFeedback.correct ? (
                              <>
                                <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                                <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                          Correct ! +{answerFeedback.points_awarded} pts
                        </span>
                              </>
                          ) : (
                              <>
                                <XCircle size={20} style={{ color: 'var(--error)' }} />
                                <span style={{ color: 'var(--error)', fontWeight: 700 }}>
                          Incorrect — La bonne réponse était : {answerFeedback.correct_text}
                        </span>
                              </>
                          )}
                        </div>
                    )}
                  </>
              ) : (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    En attente de la question...
                  </div>
              )}
            </div>
          </div>

          {/* RIGHT: Live Scoreboard */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '24px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} style={{ color: 'var(--accent)' }} /> Classement Live
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lobbyState.players.map((p, i) => {
                const isMe = p.user_id === user.id;
                return (
                    <div key={p.user_id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: isMe ? 'rgba(45, 212, 191, 0.08)' : 'var(--bg-input)',
                      border: `1px solid ${isMe ? 'rgba(45, 212, 191, 0.3)' : 'var(--border-color)'}`,
                      borderRadius: '10px', fontSize: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.8rem' }}>#{i + 1}</span>
                        
                        {/* Mini Avatar with border */}
                        <div style={{ position: 'relative', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {p.avatar_url ? (
                            p.avatar_url.startsWith('/uploads/') ? (
                              <img src={`${PUBLIC_BASE}${p.avatar_url}`} alt="Avatar" className={`avatar ${p.equipped_border || ''}`} style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                            ) : p.avatar_url.startsWith('http') ? (
                              <img src={p.avatar_url} alt="Avatar" className={`avatar ${p.equipped_border || ''}`} style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                            ) : (
                              <div className={`avatar-placeholder ${p.equipped_border || ''}`} style={{ width: '18px', height: '18px', borderRadius: '50%', fontSize: '0.6rem' }}>{p.avatar_url}</div>
                            )
                          ) : (
                            <div className={`avatar-placeholder ${p.equipped_border || ''}`} style={{ width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--border-color)' }}>
                              <User size={8} />
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <PlayerProfileLink
                              player={p}
                              className={p.equipped_color === 'rainbow' ? 'text-rainbow' : (p.equipped_color === 'cyberpunk' ? 'text-cyberpunk' : '')}
                              style={{ ...getUsernameStyle(p.global_score), color: p.equipped_color && !['rainbow', 'cyberpunk'].includes(p.equipped_color) ? p.equipped_color : undefined, fontWeight: isMe ? 700 : 500 }}
                            >
                              {p.username}
                            </PlayerProfileLink>
                            {isMe && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Vous)</span>}
                            {p.is_eliminated && <Skull size={13} style={{ color: 'var(--error)', marginLeft: '4px' }} />}
                          </div>
                          {p.equipped_title && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '1px' }}>
                              {p.equipped_title}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.8rem' }}>{p.score} pts</span>
                        {p.is_eliminated ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--error)', fontWeight: 'bold' }}>Éliminé</span>
                        ) : p.finished ? (
                            <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                        ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Q{p.current_question_index + 1}
                      </span>
                        )}
                      </div>
                    </div>
                );
              })}
            </div>

            {/* Reactions */}
            {lobbyState.players.some(p => p.reaction) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                  {lobbyState.players.filter(p => p.reaction).map(p => (
                      <span key={p.user_id} style={{ fontSize: '1.2rem', animation: 'floatUp 2s ease-out forwards' }}>
                  {p.reaction}
                </span>
                  ))}
                </div>
            )}
          </div>

          <style>{`
          @keyframes floatUp {
            0% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
          }
        `}</style>
        </div>
    );
  }

  // ============================================================
  // RENDER: WAITING FOR OTHERS
  // ============================================================
  if (gamePhase === 'waiting_end') {
    const finishedCount = lobbyState.players.filter(p => p.finished).length;
    const totalPlayers = lobbyState.players.length;

    return (
        <div className="flex-1 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-card" style={{ maxWidth: '550px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'center' }}>

            <div>
              <Trophy size={48} style={{ color: 'var(--accent)', margin: '0 auto 8px' }} />
              <h2 style={{ fontSize: '1.5rem', marginTop: '8px' }}>Vous avez terminé !</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                Votre score : <strong style={{ color: 'var(--accent)' }}>{playerScore} pts</strong>
              </p>
            </div>

            {/* Progress indicator */}
            <div style={{
              padding: '16px', backgroundColor: 'var(--bg-input)', borderRadius: '10px',
              border: '1px solid var(--border-color)'
            }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
                {finishedCount < totalPlayers
                    ? `En attente des autres joueurs... (${finishedCount}/${totalPlayers} terminé${finishedCount > 1 ? 's' : ''})`
                    : 'Tout le monde a terminé ! Calcul du classement...'
                }
              </p>
              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${(finishedCount / totalPlayers) * 100}%`,
                  height: '100%', backgroundColor: 'var(--accent)',
                  transition: 'width 0.5s ease',
                  borderRadius: '3px'
                }} />
              </div>
            </div>

            {/* Live player status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lobbyState.players.map((p, i) => (
                  <div key={p.user_id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', backgroundColor: 'var(--bg-input)',
                    borderRadius: '8px', border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>#{i + 1}</span>
                      <PlayerProfileLink player={p} style={{ ...getUsernameStyle(p.global_score) }}>{p.username}</PlayerProfileLink>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{p.score} pts</span>
                      {p.finished ? (
                          <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                      ) : (
                          <span style={{
                            fontSize: '0.75rem', color: 'var(--text-secondary)',
                            padding: '2px 6px', backgroundColor: 'rgba(255,255,255,0.03)',
                            borderRadius: '4px'
                          }}>
                      Q{p.current_question_index}/{totalQuestions.current}
                    </span>
                      )}
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>
    );
  }

  // ============================================================
  // RENDER: FINAL RESULTS / PODIUM
  // ============================================================
  if (gamePhase === 'results' || lobbyState.status === 'finished') {
    const players = lobbyState.players;
    const podium = players.slice(0, 3);
    const podiumOrder = podium.length >= 3 ? [podium[1], podium[0], podium[2]] : podium;
    const heights = ['80px', '110px', '60px'];
    const places = ['🥈', '🥇', '🥉'];
    const bgColors = ['rgba(192,192,192,0.08)', 'rgba(255,215,0,0.08)', 'rgba(205,127,50,0.08)'];

    return (
        <div className="flex-1 flex items-center justify-center p-4 animate-slide-up">
          <div className="glass-card" style={{ maxWidth: '650px', width: '100%', display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {/* Header */}
            <div style={{ textAlign: 'center' }}>
              <Trophy size={40} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
              <h2 style={{ fontSize: '1.6rem' }}>Partie Terminée !</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                Les scores ont été enregistrés sur vos comptes.
              </p>
            </div>

            {/* Visual Podium */}
            {podium.length >= 2 && (
                <div style={{
                  display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '12px',
                  padding: '24px 0 0 0'
                }}>
                  {podiumOrder.map((p, idx) => {
                    if (!p) return null;
                    const actualIndex = podium.length >= 3 ? idx : (idx === 0 ? 1 : 0); // Adjust for 2-player games
                    const height = podium.length >= 3 ? heights[idx] : (idx === 0 ? heights[1] : heights[0]);
                    const place = podium.length >= 3 ? places[idx] : (idx === 0 ? places[1] : places[0]);
                    const bgColor = podium.length >= 3 ? bgColors[idx] : (idx === 0 ? bgColors[1] : bgColors[0]);

                    return (
                        <div key={p.user_id} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                          flex: '1', maxWidth: '160px'
                        }}>
                    <PlayerProfileLink player={p} style={{ ...getUsernameStyle(p.global_score), fontSize: '0.9rem', fontWeight: 700 }}>
                      {p.username}
                    </PlayerProfileLink>
                          <div style={{
                            width: '100%', height, backgroundColor: bgColor,
                            borderRadius: '8px 8px 0 0', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: '4px',
                            border: '1px solid var(--border-color)', borderBottom: 'none'
                          }}>
                            <span style={{ fontSize: '1.8rem' }}>{place}</span>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.score} pts</span>
                            {p.coin_bonus !== undefined && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffb300', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          +{p.coin_bonus} <Coins size={12} />
                        </span>
                            )}
                          </div>
                        </div>
                    );
                  })}
                </div>
            )}

            {/* Full Standings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                Classement complet
              </h3>
              {players.map((p, i) => (
                  <div key={p.user_id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', backgroundColor: p.user_id === user.id ? 'rgba(45, 212, 191, 0.08)' : 'var(--bg-input)',
                    borderRadius: '12px', border: `1px solid ${p.user_id === user.id ? 'rgba(45, 212, 191, 0.2)' : 'var(--border-color)'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.85rem', minWidth: '24px' }}>#{i + 1}</span>
                      
                      {/* Avatar with Border */}
                      <div style={{ position: 'relative', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {p.avatar_url ? (
                          p.avatar_url.startsWith('/uploads/') ? (
                            <img src={`${PUBLIC_BASE}${p.avatar_url}`} alt="Avatar" className={`avatar ${p.equipped_border || ''}`} style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                          ) : p.avatar_url.startsWith('http') ? (
                            <img src={p.avatar_url} alt="Avatar" className={`avatar ${p.equipped_border || ''}`} style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                          ) : (
                            <div className={`avatar-placeholder ${p.equipped_border || ''}`} style={{ width: '28px', height: '28px', borderRadius: '50%', fontSize: '0.9rem' }}>{p.avatar_url}</div>
                          )
                        ) : (
                          <div className={`avatar-placeholder ${p.equipped_border || ''}`} style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--border-color)' }}>
                            <User size={12} />
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <PlayerProfileLink
                            player={p}
                            className={p.equipped_color === 'rainbow' ? 'text-rainbow' : (p.equipped_color === 'cyberpunk' ? 'text-cyberpunk' : '')}
                            style={{ ...getUsernameStyle(p.global_score), color: p.equipped_color && !['rainbow', 'cyberpunk'].includes(p.equipped_color) ? p.equipped_color : undefined, fontWeight: p.user_id === user.id ? 700 : 500 }}
                          >
                            {p.username}
                          </PlayerProfileLink>
                          {p.user_id === user.id && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Vous)</span>}
                        </div>
                        {p.equipped_title && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '1px' }}>
                            {p.equipped_title}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{p.score} pts</span>
                      {p.coin_bonus !== undefined && (
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffb300', minWidth: '60px', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      +{p.coin_bonus} <Coins size={13} />
                    </span>
                      )}
                    </div>
                  </div>
              ))}
            </div>

            {/* Back button */}
            <button className="btn-primary" onClick={() => { clearAllTimers(); onBack(); }}
                    style={{ width: '100%', padding: '14px', fontSize: '1rem' }}>
              <ArrowLeft size={18} /> Retour au Tableau de Bord
            </button>
          </div>
        </div>
    );
  }

  // Fallback
  return null;
}
