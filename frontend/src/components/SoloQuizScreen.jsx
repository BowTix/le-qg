import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { ArrowLeft, CheckCircle2, XCircle, ChevronRight, Trophy } from 'lucide-react';
import OmniIcon from './OmniIcon';

export default function SoloQuizScreen({ packId, gameMode = 'kculture', onBack, onUpdateUserStats }) {
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0); // 0 to 9
  const [selectedOption, setSelectedOption] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true); // true only for the very first load
  const [transitioning, setTransitioning] = useState(false); // true between questions
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [gameFinished, setGameFinished] = useState(false);
  const [seenQuestionIds, setSeenQuestionIds] = useState([]);
  const [openAnswer, setOpenAnswer] = useState('');
  const [totalXp, setTotalXp] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);

  const answeredRef = useRef(false);
  const latestUserStatsRef = useRef(null);
  const userStatsUpdatedRef = useRef(false);

  const handleBack = () => {
    if (!userStatsUpdatedRef.current && latestUserStatsRef.current && onUpdateUserStats) {
      userStatsUpdatedRef.current = true;
      onUpdateUserStats(latestUserStatsRef.current);
    }
    if (typeof onBack === 'function') {
      onBack();
    } else {
      navigate('/dashboard');
    }
  };

  // Keep ref in sync
  useEffect(() => {
    answeredRef.current = answered;
  }, [answered]);

  // Fetch question
  useEffect(() => {
    let active = true;

    const loadQuestion = async () => {
      if (gameFinished) return;

      try {
        const excludeParam = seenQuestionIds.join(',');
        const qData = await api.get('/quiz/question', { 
          pack_id: packId,
          exclude: excludeParam
        });
        
        if (!active) return;

        // Reset all answer state BEFORE setting the new question
        setSelectedOption(null);
        setOpenAnswer('');
        setAnswered(false);
        setResult(null);
        setError('');

        // Set question — this triggers the card animation via key change
        setCurrentQuestion(qData);
        setSeenQuestionIds(prev => [...prev, qData.id]);
        setInitialLoading(false);
        setTransitioning(false);
      } catch (err) {
        if (!active) return;
        if (questionIndex > 0) {
          setGameFinished(true);
        } else {
          setError(err.message || "Impossible de charger les questions.");
          setInitialLoading(false);
        }
      }
    };

    loadQuestion();

    return () => {
      active = false;
    };
  }, [questionIndex]);

  // Appuyer sur Entrée pour passer à la suivante après validation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && result !== null) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [result, questionIndex]);

  // Propagate user stats update when game finishes or on exit (only once)
  useEffect(() => {
    if (gameFinished && latestUserStatsRef.current && onUpdateUserStats && !userStatsUpdatedRef.current) {
      userStatsUpdatedRef.current = true;
      onUpdateUserStats(latestUserStatsRef.current);
    }
  }, [gameFinished, onUpdateUserStats]);

  useEffect(() => {
    return () => {
      if (latestUserStatsRef.current && onUpdateUserStats && !userStatsUpdatedRef.current) {
        userStatsUpdatedRef.current = true;
        onUpdateUserStats(latestUserStatsRef.current);
      }
    };
  }, [onUpdateUserStats]);

  const handleSelectOption = async (optionKey) => {
    if (answered || transitioning) return;
    
    // Immediately mark as answered and selected — UI updates instantly
    setSelectedOption(optionKey);
    setAnswered(true);
    answeredRef.current = true;

    try {
      const response = await api.post('/quiz/answer', {
        answer_token: currentQuestion.answer_token,
        answer: optionKey,
        game_mode: gameMode
      });

      setResult(response);
      if (response.points_awarded) {
        setTotalXp(prev => prev + response.points_awarded);
      }
      if (response.coins_awarded) {
        setTotalCoins(prev => prev + response.coins_awarded);
      }
      if (response.global_score !== undefined || response.coins !== undefined) {
        latestUserStatsRef.current = {
          global_score: response.global_score,
          coins: response.coins
        };
      }

      setHistory(prev => [...prev, {
        question_text: currentQuestion.question_text,
        correct: response.correct,
        user_answer: optionKey,
        correct_text: response.correct_text
      }]);
    } catch (err) {
      setError(err.message || "Erreur de validation de la réponse.");
    }
  };

  const handleOpenAnswerSubmit = async (e) => {
    if (e) e.preventDefault();
    if (answered || transitioning || !openAnswer.trim()) return;
    
    setAnswered(true);
    answeredRef.current = true;

    try {
      const response = await api.post('/quiz/answer', {
        answer_token: currentQuestion.answer_token,
        answer: openAnswer.trim(),
        game_mode: gameMode
      });

      setResult(response);
      if (response.points_awarded) {
        setTotalXp(prev => prev + response.points_awarded);
      }
      if (response.coins_awarded) {
        setTotalCoins(prev => prev + response.coins_awarded);
      }
      if (response.global_score !== undefined || response.coins !== undefined) {
        latestUserStatsRef.current = {
          global_score: response.global_score,
          coins: response.coins
        };
      }

      setHistory(prev => [...prev, {
        question_text: currentQuestion.question_text,
        correct: response.correct,
        user_answer: openAnswer.trim(),
        correct_text: response.correct_text
      }]);
    } catch (err) {
      setError(err.message || "Erreur de validation de la réponse.");
    }
  };

  const handleNext = () => {
    if (questionIndex >= 9) {
      setGameFinished(true);
    } else {
      // Start transition: keep old question visible but faded while loading
      setTransitioning(true);
      setQuestionIndex(prev => prev + 1);
    }
  };

  if (error && !currentQuestion) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="glass-card text-center max-w-md w-full">
          <XCircle size={48} style={{ color: 'var(--error)', marginBottom: '16px', display: 'inline-block' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Erreur</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error}</p>
          <button type="button" className="btn-primary" onClick={handleBack}>
            <ArrowLeft size={18} />
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (gameFinished) {
    const correctCount = history.filter(h => h.correct).length;
    const totalCount = history.length || 10;

    return (
      <div className="flex-1 max-w-2xl w-full mx-auto p-4 md:p-8 animate-slide-up">
        <div className="glass-card text-center" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div>
            <Trophy size={64} style={{ color: 'var(--accent)', display: 'inline-block', marginBottom: '16px' }} />
            <h1 style={{ fontSize: '2.2rem', color: 'var(--accent)', marginBottom: '8px' }}>
              Quiz Terminé !
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Voici le récapitulatif de votre session Culture & Pop
            </p>
          </div>

          {/* Encadré récapitulatif fin de quiz : à gauche réponses correctes/total, au milieu XP gagné, à droite pièces gagnées */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '16px',
            padding: '24px 16px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Réponses Correctes
              </span>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--success)' }}>
                {correctCount}/{totalCount}
              </span>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              borderLeft: '1px solid var(--border-color)',
              borderRight: '1px solid var(--border-color)',
              padding: '0 8px'
            }}>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                XP gagné
              </span>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#a855f7' }}>
                +{totalXp} XP
              </span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Omnis gagnés
              </span>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#eab308', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                +{totalCoins} <OmniIcon size={20} />
              </span>
            </div>
          </div>

          {/* Détail des questions */}
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Détail des questions
            </h3>
            {history.map((h, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: h.correct ? 'rgba(45, 212, 191, 0.06)' : 'rgba(251, 113, 133, 0.06)',
                border: `1px solid ${h.correct ? 'rgba(45, 212, 191, 0.15)' : 'rgba(251, 113, 133, 0.15)'}`
              }}>
                {h.correct ? (
                  <CheckCircle2 size={18} style={{ color: 'var(--success)', marginTop: '2px', flexShrink: 0 }} />
                ) : (
                  <XCircle size={18} style={{ color: 'var(--error)', marginTop: '2px', flexShrink: 0 }} />
                )}
                <div>
                  <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>{i + 1}. {h.question_text}</p>
                  {!h.correct && h.correct_text && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Correct : <span style={{ color: 'var(--success)', fontWeight: 500 }}>{h.correct_text}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="btn-primary" onClick={handleBack} style={{ alignSelf: 'center', minWidth: '200px' }}>
            Retour au Tableau
          </button>
        </div>
      </div>
    );
  }

  // Determine if we're waiting for the first question ever
  const showSkeleton = initialLoading || (!currentQuestion && !error);

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '800px' }}>
      
      {/* Top Bar Info (No chrono and no score counter during questions) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="btn-secondary" onClick={handleBack} style={{ padding: '8px 16px' }}>
          <ArrowLeft size={16} />
          Quitter
        </button>

        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          borderRadius: '12px',
          background: 'rgba(139, 92, 246, 0.15)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          color: '#c4b5fd',
          fontWeight: 700,
          fontSize: '0.85rem'
        }}>
          Culture & Pop
        </span>
      </div>

      {/* Progress indicators */}
      <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          width: `${((questionIndex + 1) / 10) * 100}%`,
          height: '100%',
          backgroundColor: '#2dd4bf',
          transition: 'width 0.4s ease-out'
        }} />
      </div>

      {/* Question Card */}
      {showSkeleton ? (
        /* Skeleton loader — same shape as the real card to prevent layout shift */
        <div className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ width: '120px', height: '14px', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ width: '85%', height: '22px', backgroundColor: 'var(--border-color)', borderRadius: '6px' }} />
            <div style={{ width: '60%', height: '22px', backgroundColor: 'var(--border-color)', borderRadius: '6px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ width: '100%', height: '56px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
            ))}
          </div>
        </div>
      ) : currentQuestion ? (
        <div 
          key={currentQuestion.id} 
          className="glass-card animate-slide-up" 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '24px',
            opacity: transitioning ? 0.4 : 1,
            transition: 'opacity 0.2s ease'
          }}
        >
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
            Question {questionIndex + 1} / 10
          </span>
          
          <>
            <h2 style={{ fontSize: '1.4rem', lineHeight: '1.4', fontWeight: 600 }}>
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
              <form onSubmit={handleOpenAnswerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                <input
                  type="text"
                  value={openAnswer}
                  onChange={(e) => setOpenAnswer(e.target.value)}
                  placeholder="Écrivez votre réponse ici..."
                  disabled={answered}
                  style={{
                    fontSize: '1.1rem',
                  }}
                  autoFocus
                />
                {!answered && (
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={!openAnswer.trim()}
                    style={{ alignSelf: 'flex-start', padding: '12px 24px' }}
                  >
                    Valider
                  </button>
                )}
              </form>
            ) : (
              /* Options list */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                {Object.keys(currentQuestion.options || {}).map((key) => {
                  const isSelected = selectedOption === key;
                  const hasResult = result !== null;
                  const isCorrectOption = result?.correct_option === key;
                  
                  let optionClass = 'option-btn';
                  if (hasResult) {
                    // Server responded — show correct/incorrect
                    if (isCorrectOption) {
                      optionClass += ' correct';
                    } else if (isSelected && !result?.correct) {
                      optionClass += ' incorrect';
                    } else {
                      optionClass += ' disabled';
                    }
                  } else if (answered && isSelected) {
                    // Answered but server hasn't responded yet — keep selected style
                    optionClass += ' selected';
                  } else if (answered) {
                    // Other buttons while waiting for server
                    optionClass += ' disabled';
                  }

                  return (
                    <button
                      key={key}
                      className={optionClass}
                      onClick={() => handleSelectOption(key)}
                      disabled={answered}
                    >
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="option-badge">{key}</span>
                        {currentQuestion.options[key]}
                      </span>
                      {hasResult && isCorrectOption && <CheckCircle2 size={18} />}
                      {hasResult && isSelected && !result?.correct && <XCircle size={18} />}
                    </button>
                  );
                })}
              </div>
            )}
          </>

          {/* Action Panel after Server Response (without per-question points/coins) */}
          {result && (
            <div className="animate-fade-in" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginTop: '12px',
              paddingTop: '24px',
              borderTop: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <p style={{
                    color: result.correct ? 'var(--success)' : 'var(--error)',
                    fontWeight: 700,
                    fontSize: '1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {result.correct ? (
                      <>
                        <CheckCircle2 size={22} />
                        <span>Correct !</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={22} />
                        <span>Incorrect</span>
                      </>
                    )}
                  </p>
                  {!result.correct && result.correct_text && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
                      La bonne réponse était : <strong style={{ color: 'var(--text-primary)' }}>
                        {result.correct_option ? `(${result.correct_option}) ` : ''}{result.correct_text}
                      </strong>
                    </p>
                  )}
                </div>

                <button className="btn-primary" onClick={handleNext} style={{ marginLeft: 'auto' }}>
                  {questionIndex >= 9 ? 'Voir les résultats' : 'Suivant'}
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
