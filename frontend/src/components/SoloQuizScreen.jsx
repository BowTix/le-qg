import React, { useEffect, useState, useRef } from 'react';
import { api } from '../utils/api';
import { ArrowLeft, Clock, Award, CheckCircle2, XCircle, ChevronRight, Trophy } from 'lucide-react';

export default function SoloQuizScreen({ packId, onBack, onUpdateUserScore }) {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0); // 0 to 9
  const [selectedOption, setSelectedOption] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [gameFinished, setGameFinished] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    fetchNextQuestion();
    return () => clearInterval(timerRef.current);
  }, [questionIndex]);

  // Handle timer countdown
  useEffect(() => {
    if (timeLeft === 0 && !answered && currentQuestion) {
      handleTimeOut();
    }
  }, [timeLeft]);

  const fetchNextQuestion = async () => {
    if (gameFinished) return;
    setLoading(true);
    setError('');
    setSelectedOption(null);
    setAnswered(false);
    setResult(null);
    setTimeLeft(20);

    try {
      const qData = await api.get('/quiz/question', { pack_id: packId });
      setCurrentQuestion(qData);
      
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
      // If we run out of questions or get an error, finish early
      if (questionIndex > 0) {
        setGameFinished(true);
      } else {
        setError(err.message || "Impossible de charger les questions.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTimeOut = () => {
    clearInterval(timerRef.current);
    setAnswered(true);
    setResult({
      correct: false,
      correct_option: '',
      correct_text: "Temps écoulé !",
      points_awarded: 0
    });
    setHistory(prev => [...prev, {
      question_text: currentQuestion.question_text,
      correct: false,
      user_answer: 'AUCUNE',
      correct_text: ''
    }]);
  };

  const handleSelectOption = async (optionKey) => {
    if (answered || loading) return;
    setSelectedOption(optionKey);
    clearInterval(timerRef.current);
    setLoading(true);

    try {
      const response = await api.post('/quiz/answer', {
        answer_token: currentQuestion.answer_token,
        answer: optionKey
      });

      setResult(response);
      setAnswered(true);
      setScore(prev => prev + response.points_awarded);
      onUpdateUserScore(response.global_score); // Update global score in dashboard context

      setHistory(prev => [...prev, {
        question_text: currentQuestion.question_text,
        correct: response.correct,
        user_answer: optionKey,
        correct_text: response.correct_text
      }]);
    } catch (err) {
      setError(err.message || "Erreur de validation de la réponse.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (questionIndex >= 9) {
      setGameFinished(true);
    } else {
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
                  {!h.correct && (
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

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
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
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
          Question {questionIndex + 1} de 10
        </span>
        
        {loading && !currentQuestion ? (
          <div style={{ padding: '40px 0', textSelf: 'center', color: 'var(--text-secondary)' }}>Chargement de la question...</div>
        ) : currentQuestion ? (
          <>
            <h2 style={{ fontSize: '1.4rem', lineHeight: '1.4', fontWeight: 600 }}>
              {currentQuestion.question_text}
            </h2>

            {/* Options list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              {Object.keys(currentQuestion.options).map((key) => {
                const isSelected = selectedOption === key;
                const isCorrectOption = result?.correct_option === key;
                
                let optionClass = 'option-btn';
                if (answered) {
                  if (isCorrectOption) {
                    optionClass += ' correct';
                  } else if (isSelected && !result?.correct) {
                    optionClass += ' incorrect';
                  } else {
                    optionClass += ' disabled';
                  }
                } else if (isSelected) {
                  optionClass += ' selected';
                }

                return (
                  <button
                    key={key}
                    className={optionClass}
                    onClick={() => handleSelectOption(key)}
                    disabled={answered || loading}
                  >
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <span className="option-badge">{key}</span>
                      {currentQuestion.options[key]}
                    </span>
                    {answered && isCorrectOption && <CheckCircle2 size={18} />}
                    {answered && isSelected && !result?.correct && <XCircle size={18} />}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {/* Action Panel after Answered */}
        {answered && (
          <div className="animate-fade-in" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginTop: '12px',
            paddingTop: '24px',
            borderTop: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'space-between', gap: '16px' }}>
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
                      Correct ! (+{result.points_awarded} pts)
                    </>
                  ) : (
                    <>
                      <XCircle size={22} />
                      {result.correct_text === "Temps écoulé !" ? "Temps écoulé !" : "Incorrect"}
                    </>
                  )}
                </p>
                {!result.correct && result.correct_option && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
                    La bonne réponse était : <strong style={{ color: '#fff' }}>({result.correct_option}) {result.correct_text}</strong>
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
    </div>
  );
}
