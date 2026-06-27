import React, { useEffect, useState, useRef } from 'react';
import { api } from '../utils/api';
import { ArrowLeft, Clock, Award, Users, Play, CheckCircle2, XCircle, ChevronRight, Trophy, RefreshCw, LogOut } from 'lucide-react';

export default function MultiplayerArena({ roomCode, user, onBack, onUpdateUserScore }) {
  const [lobbyState, setLobbyState] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Local active question state
  const [selectedOption, setSelectedOption] = useState(null);
  const [answeredThisRound, setAnsweredThisRound] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [localTimeLeft, setLocalTimeLeft] = useState(0);

  const pollIntervalRef = useRef(null);
  const localTimerRef = useRef(null);
  const prevQuestionIdRef = useRef(null);

  // Start polling on mount
  useEffect(() => {
    fetchLobbyStatus();
    pollIntervalRef.current = setInterval(fetchLobbyStatus, 1000);

    return () => {
      clearInterval(pollIntervalRef.current);
      clearInterval(localTimerRef.current);
    };
  }, [roomCode]);

  // Smooth local countdown timer
  useEffect(() => {
    if (lobbyState?.round_active && lobbyState?.time_left_ms > 0) {
      setLocalTimeLeft(lobbyState.time_left_ms);
      
      clearInterval(localTimerRef.current);
      localTimerRef.current = setInterval(() => {
        setLocalTimeLeft(prev => {
          if (prev <= 100) {
            clearInterval(localTimerRef.current);
            return 0;
          }
          return prev - 100;
        });
      }, 1000 / 10);
    } else {
      clearInterval(localTimerRef.current);
      setLocalTimeLeft(0);
    }
  }, [lobbyState?.time_left_ms, lobbyState?.round_active]);

  const fetchLobbyStatus = async () => {
    try {
      const data = await api.get('/lobby/status', { room_code: roomCode });
      setLobbyState(data);
      setLoading(false);

      const qId = data.question?.id || null;
      // Reset local answer choices when the question advances
      if (qId !== prevQuestionIdRef.current) {
        setSelectedOption(null);
        setAnsweredThisRound(false);
        setAnswerFeedback(null);
        prevQuestionIdRef.current = qId;
      }
    } catch (err) {
      setError(err.message || "Impossible de charger le salon.");
      setLoading(false);
      clearInterval(pollIntervalRef.current);
    }
  };

  const handleStartGame = async () => {
    try {
      await api.post('/lobby/next', { room_code: roomCode });
      fetchLobbyStatus();
    } catch (err) {
      setError(err.message || "Erreur au démarrage de la partie.");
    }
  };

  const handleNextQuestion = async () => {
    try {
      await api.post('/lobby/next', { room_code: roomCode });
      fetchLobbyStatus();
    } catch (err) {
      setError(err.message || "Impossible d'avancer la partie.");
    }
  };

  const handleSelectOption = async (optionKey) => {
    if (answeredThisRound || lobbyState?.user_has_answered || !lobbyState?.round_active) return;
    
    setSelectedOption(optionKey);
    setAnsweredThisRound(true);

    try {
      const response = await api.post('/lobby/answer', {
        room_code: roomCode,
        question_id: lobbyState.question.id,
        answer: optionKey
      });
      setAnswerFeedback(response);
    } catch (err) {
      setError(err.message || "Erreur de validation de la réponse.");
    }
  };

  const handleLeaveLobby = async () => {
    try {
      await api.post('/lobby/leave', { room_code: roomCode });
    } catch (e) {
      console.error(e);
    } finally {
      onBack();
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="glass-card text-center max-w-sm w-full">
          <div className="spinner" style={{
            width: '40px',
            height: '40px',
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
            <ArrowLeft size={18} />
            Retour
          </button>
        </div>
      </div>
    );
  }

  const isHost = lobbyState.host_id === user.id;

  // ==========================================
  // VIEW: WAITING LOBBY
  // ==========================================
  if (lobbyState.status === 'waiting') {
    return (
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 animate-slide-up" style={{ display: 'grid', gridTemplateColumns: '1fr', md: '1.5fr 1fr', gap: '32px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        
        {/* Left Card: Room Details */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                Salon d'Attente Multijoueur
              </span>
              <h2 style={{ fontSize: '1.8rem', marginTop: '6px' }}>Thème : {lobbyState.pack_name}</h2>
            </div>
            <button className="btn-secondary" onClick={handleLeaveLobby} style={{ padding: '8px 16px' }}>
              <LogOut size={16} />
              Quitter
            </button>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '12px',
            padding: '32px',
            border: '1px solid var(--border-color)',
            textAlign: 'center',
            marginTop: '12px'
          }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Code d'Invitation
            </span>
            <span style={{
              fontSize: '3rem',
              fontWeight: 900,
              color: 'var(--accent)',
              letterSpacing: '6px',
              fontFamily: 'monospace',
              margin: '12px 0 8px 0'
            }}>
              {lobbyState.room_code}
            </span>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Partagez ce code avec vos amis pour qu'ils rejoignent la partie !
            </p>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
            {isHost ? (
              <button 
                className="btn-primary" 
                onClick={handleStartGame}
                style={{ width: '100%', padding: '16px' }}
                disabled={lobbyState.players.length < 1} // Can play solo too if testing, but standard is friends
              >
                <Play size={20} />
                Lancer la Partie ({lobbyState.players.length} Joueurs)
              </button>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '16px',
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                border: '1px dashed var(--border-color)'
              }}>
                En attente du lancement par l'hôte <strong style={{ color: '#fff' }}>{lobbyState.host_username}</strong>...
              </div>
            )}
          </div>
        </div>

        {/* Right Card: Players list */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Users size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: '1.2rem' }}>Joueurs connectés ({lobbyState.players.length})</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flexGrow: 1 }}>
            {lobbyState.players.map((p, index) => {
              const isPlayerHost = p.user_id === lobbyState.host_id;
              const isCurrentUser = p.user_id === user.id;

              return (
                <div key={p.user_id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: isCurrentUser ? 'rgba(255,247,0,0.03)' : 'var(--bg-input)',
                  border: `1px solid ${isCurrentUser ? 'var(--accent)' : 'var(--border-color)'}`,
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>#{index+1}</span>
                    <span style={{ fontWeight: 600 }}>{p.username} {isCurrentUser && '(Vous)'}</span>
                  </div>
                  {isPlayerHost && (
                    <span style={{
                      backgroundColor: 'rgba(255,247,0,0.1)',
                      color: 'var(--accent)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      textTransform: 'uppercase'
                    }}>
                      Hôte
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  }

  // ==========================================
  // VIEW: PLAYING GAME
  // ==========================================
  if (lobbyState.status === 'playing') {
    const question = lobbyState.question;
    const isRoundOver = lobbyState.round_over;
    
    // Check if current user has answered
    const hasCurrentUserAnswered = lobbyState.user_has_answered || answeredThisRound;

    return (
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', md: '2fr 1fr', gap: '32px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        
        {/* Left Side: Question Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Quiz Top Info bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Question {lobbyState.current_question_index + 1} de 10
            </span>
            
            {/* Timer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: isRoundOver ? 'var(--success-glow)' : (localTimeLeft <= 3000 ? 'var(--error-glow)' : 'var(--bg-card)'),
              color: isRoundOver ? 'var(--success)' : (localTimeLeft <= 3000 ? 'var(--error)' : 'var(--accent)'),
              padding: '8px 16px',
              borderRadius: '20px',
              border: `1px solid ${isRoundOver ? 'var(--success)' : (localTimeLeft <= 3000 ? 'var(--error)' : 'var(--border-color)')}`,
              fontWeight: 700,
              minWidth: '100px',
              justifyContent: 'center'
            }}>
              <Clock size={16} />
              {isRoundOver ? 'Fini' : `${(localTimeLeft / 1000).toFixed(1)}s`}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: isRoundOver ? '100%' : `${(localTimeLeft / 15000) * 100}%`,
              height: '100%',
              backgroundColor: isRoundOver ? 'var(--success)' : (localTimeLeft <= 3000 ? 'var(--error)' : 'var(--accent)'),
              transition: isRoundOver ? 'width 0.4s ease-out' : 'none'
            }} />
          </div>

          {/* Core Question Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {question ? (
              <>
                <h2 style={{ fontSize: '1.4rem', lineHeight: '1.4', fontWeight: 600 }}>
                  {question.question_text}
                </h2>

                {/* Options List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                  {Object.keys(question.options).map((key) => {
                    const isSelected = selectedOption === key;
                    const isCorrect = lobbyState.correct_option === key;
                    
                    let btnClass = 'option-btn';
                    if (isRoundOver) {
                      if (isCorrect) {
                        btnClass += ' correct';
                      } else if (isSelected) {
                        btnClass += ' incorrect';
                      } else {
                        btnClass += ' disabled';
                      }
                    } else if (isSelected || hasCurrentUserAnswered) {
                      if (isSelected) {
                        btnClass += ' selected';
                      } else {
                        btnClass += ' disabled';
                      }
                    }

                    return (
                      <button
                        key={key}
                        className={btnClass}
                        onClick={() => handleSelectOption(key)}
                        disabled={hasCurrentUserAnswered || isRoundOver}
                      >
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          <span className="option-badge">{key}</span>
                          {question.options[key]}
                        </span>
                        {isRoundOver && isCorrect && <CheckCircle2 size={18} />}
                        {isRoundOver && isSelected && !isCorrect && <XCircle size={18} />}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ padding: '40px 0', textSelf: 'center', color: 'var(--text-secondary)' }}>
                En attente de la question...
              </div>
            )}

            {/* Answer Feedback panel */}
            {isRoundOver && (
              <div className="animate-fade-in" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                marginTop: '12px',
                paddingTop: '24px',
                borderTop: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>
                      {selectedOption === lobbyState.correct_option ? (
                        <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                          <CheckCircle2 size={20} />
                          Bien joué ! {answerFeedback?.points_awarded ? `(+${answerFeedback.points_awarded} pts)` : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                          <XCircle size={20} />
                          {selectedOption ? "Mauvaise réponse" : "Temps écoulé !"}
                        </span>
                      )}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      La bonne réponse était : <strong style={{ color: '#fff' }}>({lobbyState.correct_option}) {lobbyState.correct_text}</strong>
                    </p>
                  </div>

                  {isHost && (
                    <button className="btn-primary" onClick={handleNextQuestion} style={{ marginLeft: 'auto' }}>
                      {lobbyState.current_question_index >= 9 ? 'Terminer la partie' : 'Question Suivante'}
                      <ChevronRight size={18} />
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {hasCurrentUserAnswered && !isRoundOver && (
              <div style={{
                textAlign: 'center',
                padding: '12px',
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(255,255,255,0.01)',
                borderRadius: '8px',
                border: '1px dashed var(--border-color)',
                fontSize: '0.9rem'
              }}>
                Réponse enregistrée. Attente des autres joueurs ou de la fin du chrono...
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Scoreboard & Active players state */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1.2rem' }}>Classement Live</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
            {lobbyState.players.map((p, index) => {
              const isCurrentUser = p.user_id === user.id;

              return (
                <div key={p.user_id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: isCurrentUser ? 'rgba(255,247,0,0.03)' : 'var(--bg-input)',
                  border: `1px solid ${isCurrentUser ? 'var(--accent)' : 'var(--border-color)'}`,
                  borderRadius: '8px',
                  transition: 'var(--transition-smooth)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontWeight: 700,
                      color: index === 0 ? 'var(--accent)' : 'var(--text-secondary)'
                    }}>
                      #{index+1}
                    </span>
                    <span style={{ fontWeight: 600 }}>{p.username}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {p.has_answered ? (
                        <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                      ) : (
                        <RefreshCw size={14} className="spinner" style={{ animation: 'spin 1.5s linear infinite', color: 'var(--text-secondary)' }} />
                      )}
                    </span>
                    <strong style={{ fontSize: '1rem' }}>{p.score} pts</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  }

  // ==========================================
  // VIEW: FINISHED GAME (PODIUM)
  // ==========================================
  if (lobbyState.status === 'finished') {
    // Players sorted by score (already sorted descending from PHP)
    const podium = lobbyState.players;

    return (
      <div className="flex-1 max-w-2xl w-full mx-auto p-4 md:p-8 animate-slide-up">
        <div className="glass-card text-center" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div>
            <Trophy size={64} style={{ color: 'var(--accent)', display: 'inline-block', marginBottom: '16px' }} />
            <h1 style={{ fontSize: '2.5rem', color: 'var(--accent)', marginBottom: '8px' }}>
              Partie Terminée !
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Les scores finaux ont été enregistrés sur vos comptes.
            </p>
          </div>

          {/* Podium Display (Top 3 Visuals) */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: '16px',
            margin: '24px 0',
            height: '180px'
          }}>
            {/* 2nd Place */}
            {podium[1] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>{podium[1].username}</span>
                <div style={{
                  width: '100%',
                  height: '80px',
                  backgroundColor: '#4a4d63',
                  borderRadius: '8px 8px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <strong style={{ fontSize: '1.4rem' }}>2</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{podium[1].score} pts</span>
                </div>
              </div>
            )}

            {/* 1st Place */}
            {podium[0] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }}>
                <Trophy size={20} style={{ color: 'var(--accent)', marginBottom: '4px' }} />
                <span style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '6px' }}>{podium[0].username}</span>
                <div style={{
                  width: '100%',
                  height: '110px',
                  backgroundColor: 'var(--accent)',
                  color: '#12121c',
                  borderRadius: '8px 8px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0 0 20px rgba(255,247,0,0.2)'
                }}>
                  <strong style={{ fontSize: '1.8rem', fontWeight: 800 }}>1</strong>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{podium[0].score} pts</span>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {podium[2] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>{podium[2].username}</span>
                <div style={{
                  width: '100%',
                  height: '60px',
                  backgroundColor: '#35374a',
                  borderRadius: '8px 8px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <strong style={{ fontSize: '1.4rem' }}>3</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{podium[2].score} pts</span>
                </div>
              </div>
            )}
          </div>

          {/* Full Standings List */}
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Classement final
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {podium.map((p, i) => (
                <div key={p.user_id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <span style={{ fontWeight: 600 }}>#{i+1} {p.username}</span>
                  <strong>{p.score} points</strong>
                </div>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={onBack} style={{ alignSelf: 'center', width: '220px' }}>
            Retour au Dashboard
          </button>
        </div>
      </div>
    );
  }

  return null;
}
