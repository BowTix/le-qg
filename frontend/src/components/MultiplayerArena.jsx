import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../utils/api';
import { getLevel, getUsernameStyle } from '../utils/progression';
import { Users, Play, LogOut, ArrowLeft, CheckCircle2, XCircle, Trophy, Clock, Crown, Loader2, Gavel, Pencil, Vote, HelpCircle, Skull, Coins } from 'lucide-react';
import Pusher from 'pusher-js';

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

  const lastPhaseRef = useRef('');
  const lastRoundRef = useRef(-1);

  // === REFS ===
  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const feedbackRef = useRef(null);
  const totalQuestions = useRef(10);
  const gamePhaseRef = useRef('waiting');

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
          if (fetchQuestionRef.current) fetchQuestionRef.current(0);
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

    setLobbyState(data);
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
        if (fetchQuestionRef.current) fetchQuestionRef.current(0);
      }
    }

    // Detect game finished → show results
    if (data.status === 'finished' && phase !== 'results') {
      setGamePhase('results');
      clearAllTimers();
    }
  }, [user.id, startCountdown]);

  const applyLobbyStateRef = useRef(null);
  useEffect(() => {
    applyLobbyStateRef.current = applyLobbyState;
  }, [applyLobbyState]);

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
        forceTLS: true
      });
      pusherRef.current = pusher;

      const channel = pusher.subscribe(`lobby-${roomCode}`);
      channelRef.current = channel;

      // The server now pushes the actual state directly in the event
      // payload, so we apply it immediately — no follow-up HTTP request.
      // This is what makes actions feel instant to OTHER players: they
      // never wait on a fetch, they just receive the new state.
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
      fetchStatus();
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
                      padding: '10px 14px', backgroundColor: p.user_id === user.id ? 'rgba(255,247,0,0.03)' : 'var(--bg-input)',
                      border: `1px solid ${p.user_id === user.id ? 'var(--accent)' : 'var(--border-color)'}`,
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>#{i + 1}</span>
                        <span style={{ ...getUsernameStyle(p.global_score) }}>{p.username}</span>
                        {p.user_id === user.id && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Vous)</span>}
                      </div>
                      {p.user_id === lobbyState.host_id && (
                          <span style={{
                            backgroundColor: 'rgba(255,247,0,0.1)', color: 'var(--accent)',
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
                        disabled={lobbyState.players.length < 1}>
                  <Play size={20} /> Lancer la Partie ({lobbyState.players.length} joueur{lobbyState.players.length > 1 ? 's' : ''})
                </button>
            ) : (
                <div style={{
                  textAlign: 'center', padding: '14px', color: 'var(--text-secondary)',
                  backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px',
                  border: '1px dashed var(--border-color)', fontSize: '0.9rem'
                }}>
                  En attente du lancement par <strong style={{ color: 'var(--accent)' }}>{lobbyState.host_username}</strong>...
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
            background: 'radial-gradient(circle, rgba(255,247,0,0.15) 0%, transparent 70%)',
            animation: 'pulse 1s ease-in-out infinite'
          }} />

          <div style={{ textAlign: 'center', zIndex: 1 }}>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
              La partie commence dans
            </p>
            <div key={countdownValue} style={{
              fontSize: '8rem', fontWeight: 900, color: 'var(--accent)',
              lineHeight: 1, animation: 'fadeIn 0.3s ease-out',
              textShadow: '0 0 40px rgba(255,247,0,0.4)'
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
        <div className="container animate-fade-in"
             style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>

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
                                  backgroundColor: isWinner ? 'rgba(255,247,0,0.02)' : 'var(--bg-input)',
                                  border: `1px solid ${isWinner ? 'var(--accent)' : 'var(--border-color)'}`,
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
                      backgroundColor: isMe ? 'rgba(255,247,0,0.04)' : 'var(--bg-input)',
                      border: `1px solid ${isMe ? 'rgba(255,247,0,0.2)' : 'var(--border-color)'}`,
                      borderRadius: '6px', fontSize: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.8rem' }}>#{i + 1}</span>
                        <span style={{ ...getUsernameStyle(p.global_score), fontWeight: isMe ? 700 : 500 }}>
                      {p.username}{isMe ? ' (Vous)' : ''}
                    </span>
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
  // RENDER: PLAYING (question + answer)
  // ============================================================
  if (gamePhase === 'playing' || gamePhase === 'feedback') {
    if (lobbyState.game_mode === 'tribunal') {
      return renderTribunalGame();
    }
    const isFeedback = gamePhase === 'feedback';
    const myPlayerInfo = lobbyState?.players.find(p => p.user_id === user.id);
    const isEliminated = myPlayerInfo?.is_eliminated;

    const timeLimit = (lobbyState && lobbyState.game_mode === 'speed_blitz') ? 5000 : 15000;
    const timeRatio = questionTimer / timeLimit;

    return (
        <div className="container animate-fade-in"
             style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>

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
              padding: '6px 12px', backgroundColor: 'rgba(255,247,0,0.05)',
              borderRadius: '8px', border: '1px solid rgba(255,247,0,0.1)', alignSelf: 'flex-start'
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

                    {currentQuestion.question_type === 'guess_number' || currentQuestion.question_type === 'open' ? (
                        <form onSubmit={(e) => { e.preventDefault(); handleAnswer(openAnswer.trim()); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <input
                              type={currentQuestion.question_type === 'guess_number' ? 'number' : 'text'}
                              value={openAnswer}
                              onChange={(e) => setOpenAnswer(e.target.value)}
                              placeholder={currentQuestion.question_type === 'guess_number' ? 'Entrez votre estimation...' : 'Entrez votre réponse...'}
                              disabled={!!selectedOption || isFeedback}
                              style={{
                                width: '100%',
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-input)',
                                color: '#fff',
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
                          Incorrect — Réponse : {answerFeedback.correct_option || answerFeedback.correct_value}. {answerFeedback.correct_text}
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
                      backgroundColor: isMe ? 'rgba(255,247,0,0.04)' : 'var(--bg-input)',
                      border: `1px solid ${isMe ? 'rgba(255,247,0,0.2)' : 'var(--border-color)'}`,
                      borderRadius: '6px', fontSize: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.8rem' }}>#{i + 1}</span>
                        <span style={{ ...getUsernameStyle(p.global_score), fontWeight: isMe ? 700 : 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {p.username}{isMe ? ' (Vous)' : ''}
                      {p.is_eliminated && <Skull size={13} style={{ color: 'var(--error)' }} />}
                    </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.8rem' }}>{p.score} pts</span>
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
                      <span style={{ ...getUsernameStyle(p.global_score) }}>{p.username}</span>
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
                    <span style={{ ...getUsernameStyle(p.global_score), fontSize: '0.9rem', fontWeight: 700 }}>
                      {p.username}
                    </span>
                          <div style={{
                            width: '100%', height, backgroundColor: bgColor,
                            borderRadius: '8px 8px 0 0', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: '4px',
                            border: '1px solid var(--border-color)', borderBottom: 'none'
                          }}>
                            <span style={{ fontSize: '1.8rem' }}>{place}</span>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.score} pts</span>
                            {p.elo_change !== undefined && (
                                <span style={{
                                  fontSize: '0.75rem', fontWeight: 700,
                                  color: p.elo_change > 0 ? 'var(--success)' : p.elo_change < 0 ? 'var(--error)' : 'var(--text-secondary)'
                                }}>
                          {p.elo_change > 0 ? '+' : ''}{p.elo_change} Elo
                        </span>
                            )}
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
                    padding: '10px 14px', backgroundColor: p.user_id === user.id ? 'rgba(255,247,0,0.04)' : 'var(--bg-input)',
                    borderRadius: '8px', border: `1px solid ${p.user_id === user.id ? 'rgba(255,247,0,0.15)' : 'var(--border-color)'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.85rem', minWidth: '24px' }}>#{i + 1}</span>
                      <span style={{ ...getUsernameStyle(p.global_score), fontWeight: p.user_id === user.id ? 700 : 500 }}>
                    {p.username}{p.user_id === user.id ? ' (Vous)' : ''}
                  </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{p.score} pts</span>
                      {p.elo_change !== undefined && (
                          <span style={{
                            fontSize: '0.8rem', fontWeight: 700,
                            color: p.elo_change > 0 ? 'var(--success)' : p.elo_change < 0 ? 'var(--error)' : 'var(--text-secondary)',
                            minWidth: '55px', textAlign: 'right'
                          }}>
                      {p.elo_change > 0 ? '+' : ''}{p.elo_change} Elo
                    </span>
                      )}
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