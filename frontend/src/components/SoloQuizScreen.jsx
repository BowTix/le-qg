import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../utils/api';
import { ArrowLeft, Clock, Award, CheckCircle2, XCircle, ChevronRight, Trophy } from 'lucide-react';

export default function SoloQuizScreen({ packId, onBack, onUpdateUserStats }) {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0); // 0 to 9
  const [selectedOption, setSelectedOption] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [initialLoading, setInitialLoading] = useState(true); // true only for the very first load
  const [transitioning, setTransitioning] = useState(false); // true between questions
  const [error, setError] = useState('');
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [gameFinished, setGameFinished] = useState(false);
  const [seenQuestionIds, setSeenQuestionIds] = useState([]);
  const [openAnswer, setOpenAnswer] = useState('');

  const timerRef = useRef(null);
  const answeredRef = useRef(false); // ref mirror of answered to avoid stale closures in timer

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
        setTimeLeft(20);
        setError('');

        // Set question — this triggers the card animation via key change
        setCurrentQuestion(qData);
        setSeenQuestionIds(prev => [...prev, qData.id]);
        setInitialLoading(false);
        setTransitioning(false);
        
        // Start 20s countdown timer
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
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
      clearInterval(timerRef.current);
    };
  }, [questionIndex]);

  // Handle timer reaching zero
  useEffect(() => {
    if (timeLeft === 0 && !answeredRef.current && currentQuestion) {
      handleTimeOut();
    }
  }, [timeLeft]);

  const handleTimeOut = useCallback(async () => {
    if (answeredRef.current) return;
    clearInterval(timerRef.current);
    // Mark answered immediately so UI reacts instantly
    setAnswered(true);
    answeredRef.current = true;

    try {
      const response = await api.post('/quiz/answer', {
        answer_token: currentQuestion.answer_token,
        answer: 'TIMEOUT'
      });

      setResult({
        ...response,
        is_timeout: true
      });
      setHistory(prev => [...prev, {
        question_text: currentQuestion.question_text,
        correct: false,
        user_answer: 'AUCUNE',
        correct_text: response.correct_text
      }]);
    } catch {
      setResult({
        correct: false,
        correct_option: null,
        correct_text: '',
        points_awarded: 0,
        coins_awarded: 0,
        is_timeout: true
      });
      setHistory(prev => [...prev, {
        question_text: currentQuestion.question_text,
        correct: false,
        user_answer: 'AUCUNE',
        correct_text: ''
      }]);
    }
  }, [currentQuestion]);

  const handleSelectOption = async (optionKey) => {
    if (answered || transitioning) return;
    
    // Immediately mark as answered and selected — UI updates instantly
    setSelectedOption(optionKey);
    setAnswered(true);
    answeredRef.current = true;
    clearInterval(timerRef.current);

    try {
      const response = await api.post('/quiz/answer', {
        answer_token: currentQuestion.answer_token,
        answer: optionKey
      });

      setResult(response);
      setScore(prev => prev + response.points_awarded);
      if (onUpdateUserStats) {
        onUpdateUserStats({ global_score: response.global_score, coins: response.coins });
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
    clearInterval(timerRef.current);

    try {
      const response = await api.post('/quiz/answer', {
        answer_token: currentQuestion.answer_token,
        answer: openAnswer.trim()
      });

      setResult(response);
      setScore(prev => prev + response.points_awarded);
      if (onUpdateUserStats) {
        onUpdateUserStats({ global_score: response.global_score, coins: response.coins });
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
          <button className="btn-primary" onClick={onBack}>
            <ArrowLeft size={18} />
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (gameFinished) {
    return (
      <div className="flex-1 max-w-2xl w-full mx-auto p-4 md:p-8 animate-slide-up">
        <div className="glass-card text-center" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div>
            <Trophy size={64} style={{ color: 'var(--accent)', display: 'inline-block', marginBottom: '16px' }} />
            <h1 style={{ fontSize: '2.2rem', color: 'var(--accent)', marginBottom: '8px' }}>
              Entraînement Terminé !
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Voici le récapitulatif de votre session
            </p>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid var(--border-color)'
          }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Questions</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>{history.length}</span>
            </div>
            <div style={{ height: '40px', width: '1px', backgroundColor: 'var(--border-color)' }}></div>
            <div>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Réponses Correctes</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--success)' }}>
                {history.filter(h => h.correct).length}
              </span>
            </div>
            <div style={{ height: '40px', width: '1px', backgroundColor: 'var(--border-color)' }}></div>
            <div>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Points Gagnés</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent)' }}>+{score}</span>
            </div>
          </div>

          {/* History Details */}
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Détail des questions</h3>
            {history.map((h, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: h.correct ? 'rgba(0, 255, 157, 0.03)' : 'rgba(255, 59, 105, 0.03)',
                border: `1px solid ${h.correct ? 'rgba(0, 255, 157, 0.1)' : 'rgba(255, 59, 105, 0.1)'}`
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

          <button className="btn-primary" onClick={onBack} style={{ alignSelf: 'center', width: '200px' }}>
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
      
      {/* Top Bar Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn-secondary" onClick={onBack} style={{ padding: '8px 16px' }}>
          <ArrowLeft size={16} />
          Quitter
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <Award size={16} />
            Score : <strong style={{ color: '#fff' }}>{score} pts</strong>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: timeLeft <= 5 ? 'var(--error-glow)' : 'var(--bg-card)',
            color: timeLeft <= 5 ? 'var(--error)' : 'var(--accent)',
            padding: '8px 16px',
            borderRadius: '20px',
            border: `1px solid ${timeLeft <= 5 ? 'var(--error)' : 'var(--border-color)'}`,
            fontWeight: 700,
            minWidth: '90px',
            justifyContent: 'center',
            transition: 'var(--transition-smooth)'
          }}>
            <Clock size={16} />
            {timeLeft}s
          </div>
        </div>
      </div>

      {/* Progress indicators */}
      <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          width: `${((questionIndex + 1) / 10) * 100}%`,
          height: '100%',
          backgroundColor: 'var(--accent)',
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
            Question {questionIndex + 1} de 10
          </span>
          
          <>
            <h2 style={{ fontSize: '1.4rem', lineHeight: '1.4', fontWeight: 600 }}>
              {currentQuestion.question_text}
            </h2>

            {currentQuestion.question_type === 'open' ? (
              <form onSubmit={handleOpenAnswerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                <input
                  type="text"
                  value={openAnswer}
                  onChange={(e) => setOpenAnswer(e.target.value)}
                  placeholder="Écrivez votre réponse ici..."
                  disabled={answered}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: '#fff',
                    fontSize: '1.1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
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

          {/* Action Panel after Server Response */}
          {result && (
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
                        Correct ! (+{result.points_awarded} pts, +{result.coins_awarded} 🪙)
                      </>
                    ) : (
                      <>
                        <XCircle size={22} />
                        {result.is_timeout ? "Temps écoulé !" : "Incorrect"}
                      </>
                    )}
                  </p>
                  {!result.correct && result.correct_text && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
                      La bonne réponse était : <strong style={{ color: '#fff' }}>
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
