import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../utils/api';
import { getLevel, getUsernameStyle } from '../utils/progression';
import { Users, Play, LogOut, ArrowLeft, CheckCircle2, XCircle, Trophy, Clock, Crown, Loader2 } from 'lucide-react';

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
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [questionTimer, setQuestionTimer] = useState(15000);
  const [fetchingQuestion, setFetchingQuestion] = useState(false);

  // === REFS ===
  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const feedbackRef = useRef(null);
  const totalQuestions = useRef(10);
  const gamePhaseRef = useRef('waiting');

  const fetchQuestionRef = useRef(null);
  const handleAnswerRef = useRef(null);
  const handleFinishRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    gamePhaseRef.current = gamePhase;
  }, [gamePhase]);

  // ============================================================
  // POLLING: Fetch lobby status every second
  // ============================================================
  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get('/lobby/status', { room_code: roomCode });
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

    } catch (err) {
      if (err.message && (err.message.includes('introuvable') || err.message.includes('404'))) {
        clearAllTimers();
        onBack();
      } else {
        // Status polling connection issue (silent console warning to prevent blocking UI)
        console.warn('Background status sync delay:', err.message);
      }
    }
  }, [roomCode]);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 1000);
    return () => clearAllTimers();
  }, [roomCode]);

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
    setAnswerFeedback(null);
    setQuestionError('');
    setCurrentQuestionIndex(index);
    setQuestionTimer(15000);

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
  }, [roomCode]);

  // ============================================================
  // QUESTION TIMER (15s countdown, smooth 100ms ticks)
  // ============================================================
  const startQuestionTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setQuestionTimer(15000);

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
  }, []);

  // Update refs on every render to bind current callbacks scope
  fetchQuestionRef.current = fetchQuestion;
  handleAnswerRef.current = handleAnswer;
  handleFinishRef.current = handleFinish;



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
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    clearInterval(countdownRef.current);
    clearTimeout(feedbackRef.current);
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
                Mode En Ligne — Classique
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
              En attente du lancement par <strong style={{ color: '#fff' }}>{lobbyState.host_username}</strong>...
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
  // RENDER: PLAYING (question + answer)
  // ============================================================
  if (gamePhase === 'playing' || gamePhase === 'feedback') {
    const isFeedback = gamePhase === 'feedback';
    const timeRatio = questionTimer / 15000;

    return (
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 animate-fade-in"
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
            {fetchingQuestion ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px auto', display: 'block' }} />
                Chargement de la question...
              </div>
            ) : currentQuestion ? (
              <>
                <h2 style={{ fontSize: '1.3rem', lineHeight: 1.4, fontWeight: 600 }}>
                  {currentQuestion.question_text}
                </h2>

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
                          Incorrect — Réponse : {answerFeedback.correct_option}. {answerFeedback.correct_text}
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
                    <span style={{ ...getUsernameStyle(p.global_score), fontWeight: isMe ? 700 : 500 }}>
                      {p.username}{isMe ? ' (Vous)' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.8rem' }}>{p.score} pts</span>
                    {p.finished ? (
                      <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
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
            <span style={{ fontSize: '3rem' }}>🏁</span>
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
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffb300' }}>
                          +{p.coin_bonus} 🪙
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
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffb300', minWidth: '50px', textAlign: 'right' }}>
                      +{p.coin_bonus} 🪙
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
