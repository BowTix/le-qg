import React, { useEffect, useState, useRef } from 'react';
import { api } from '../utils/api';
import { ArrowLeft, Loader2, Award, Share2 } from 'lucide-react';

export default function DailyQuizScreen({ onBack, onUpdateUserStats }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState('');
  
  // Answers accumulated locally
  const [userAnswers, setUserAnswers] = useState([]); // [{ answer_token, answer }]
  
  // Current question inputs
  const [openAnswer, setOpenAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(20);
  const timerRef = useRef(null);
  
  // Finished results state
  const [results, setResults] = useState(null); // { attempt, stats, points_earned, coins_earned }

  useEffect(() => {
    fetchQuestions();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (questions.length > 0 && currentIndex < questions.length && !results) {
      // Start/Reset timer for the current question
      setTimeLeft(20);
      setOpenAnswer('');
      setSelectedOption('');
      
      if (timerRef.current) clearInterval(timerRef.current);
      
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleNext('TIMEOUT');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [currentIndex, questions, results]);

  const fetchQuestions = async () => {
    try {
      const data = await api.get('/quiz/daily/questions');
      if (data.success) {
        setQuestions(data.questions);
      }
    } catch (err) {
      setError(err.message || "Impossible de charger le quiz du jour. Veuillez réessayer plus tard.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = (finalAnswer) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const currentQ = questions[currentIndex];
    const newAttempt = {
      answer_token: currentQ.answer_token,
      answer: finalAnswer
    };

    const updatedAnswers = [...userAnswers, newAttempt];
    setUserAnswers(updatedAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Last question completed, submit all answers
      submitAllAnswers(updatedAnswers);
    }
  };

  const submitAllAnswers = async (allAnswers) => {
    setSubmitting(true);
    try {
      const data = await api.post('/quiz/daily/submit', { answers: allAnswers });
      if (data.success) {
        setResults(data);
        // Trigger parent profile stats refresh
        if (data.points_earned > 0) {
          onUpdateUserStats({
            global_score: data.points_earned, // This will be added by parent, or we can just fetch profile
            coins: data.coins_earned
          });
        }
      }
    } catch (err) {
      setError(err.message || "Erreur lors de la soumission de vos réponses.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = () => {
    if (!results) return;
    
    const correctCount = [results.attempt.q1_correct, results.attempt.q2_correct, results.attempt.q3_correct].filter(Boolean).length;
    const dateObj = new Date();
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    
    const block1 = results.attempt.q1_correct ? '🟩' : '🟥';
    const block2 = results.attempt.q2_correct ? '🟩' : '🟥';
    const block3 = results.attempt.q3_correct ? '🟩' : '🟥';
    
    const shareText = `Le QG - Quiz du Jour #${d}-${m} 📅\n${block1}${block2}${block3} (${correctCount}/3)\nJouez vous aussi sur : ${window.location.origin}`;
    
    navigator.clipboard.writeText(shareText);
    alert("Résultats copiés dans le presse-papiers !");
  };

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <h3>Chargement du Quiz du Jour...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="glass-card max-w-md mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '36px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem' }}>⚠️</div>
          <h3 style={{ color: 'var(--error)', fontWeight: 700 }}>Une erreur est survenue</h3>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <button className="btn-primary" onClick={onBack} style={{ marginTop: '12px' }}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <h3>Validation de vos réponses...</h3>
          <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>Enregistrement de votre tentative quotidienne.</p>
        </div>
      </div>
    );
  }

  // RESULTS SCREEN
  if (results) {
    const correctCount = [results.attempt.q1_correct, results.attempt.q2_correct, results.attempt.q3_correct].filter(Boolean).length;
    
    return (
      <div className="container">
        <div className="glass-card max-w-xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '28px', padding: '36px' }}>
          
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '2.5rem' }}>📅</span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Quiz du Jour Terminé !
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Merci d'avoir participé. Vous avez joué votre unique essai pour aujourd'hui.
            </p>
          </div>

          {/* Score card */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px 16px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, height: '4px',
              background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)'
            }} />

            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Votre Score</span>
            <span style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
              {correctCount}/3
            </span>

            {/* Wordle blocks */}
            <div style={{ fontSize: '1.8rem', letterSpacing: '6px', margin: '4px 0 8px' }}>
              {results.attempt.q1_correct ? '🟩' : '🟥'}
              {results.attempt.q2_correct ? '🟩' : '🟥'}
              {results.attempt.q3_correct ? '🟩' : '🟥'}
            </div>

            {/* Rewards */}
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <span>🪙 +{results.coins_earned} pièces</span>
              <span>⚡ +{results.points_earned} XP</span>
            </div>
          </div>

          {/* Share Block */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px' }}>
              <Share2 size={16} />
              Partager mon résultat (Copier)
            </button>
          </div>

          {/* Success Statistics */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Taux de réussite global ({results.stats.total} participants) :
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span>Question 1</span>
                  <strong>{results.stats.q1_pct}% de réussite</strong>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${results.stats.q1_pct}%`, height: '100%', backgroundColor: 'var(--success)', borderRadius: '4px', transition: 'width 1s ease-out' }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span>Question 2</span>
                  <strong>{results.stats.q2_pct}% de réussite</strong>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${results.stats.q2_pct}%`, height: '100%', backgroundColor: 'var(--success)', borderRadius: '4px', transition: 'width 1s ease-out' }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span>Question 3</span>
                  <strong>{results.stats.q3_pct}% de réussite</strong>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${results.stats.q3_pct}%`, height: '100%', backgroundColor: 'var(--success)', borderRadius: '4px', transition: 'width 1s ease-out' }}></div>
                </div>
              </div>
            </div>
          </div>

          <button className="btn-secondary" onClick={onBack} style={{ width: '100%', padding: '12px' }}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  // GAME CHALLENGE SCREEN
  const currentQuestion = questions[currentIndex];
  
  return (
    <div className="container">
      <div className="glass-card max-w-xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '36px' }}>
        
        {/* Progress header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
            Défi du Jour — Q{currentIndex + 1}/3
          </span>
          <span style={{ 
            fontSize: '0.85rem', 
            fontWeight: 700, 
            color: timeLeft <= 5 ? 'var(--error)' : 'var(--accent)',
            backgroundColor: timeLeft <= 5 ? 'var(--error-glow)' : 'rgba(255, 247, 0, 0.05)',
            padding: '4px 10px',
            borderRadius: '20px',
            border: `1px solid ${timeLeft <= 5 ? 'rgba(255, 59, 105, 0.2)' : 'rgba(255, 247, 0, 0.2)'}`
          }}>
            ⏱️ {timeLeft}s
          </span>
        </div>

        {/* Shimmer timer progress bar */}
        <div style={{ height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden', width: '100%' }}>
          <div style={{ 
            width: `${(timeLeft / 20) * 100}%`, 
            height: '100%', 
            backgroundColor: timeLeft <= 5 ? 'var(--error)' : 'var(--accent)', 
            transition: 'width 1s linear'
          }}></div>
        </div>

        {/* Question Text */}
        <h2 style={{ fontSize: '1.35rem', lineHeight: 1.4, fontWeight: 700, marginTop: '8px' }}>
          {currentQuestion.question_text}
        </h2>

        {/* Render question inputs according to type */}
        {currentQuestion.question_type === 'guess_number' || currentQuestion.question_type === 'open' ? (
          <form 
            onSubmit={(e) => { e.preventDefault(); if (openAnswer.trim()) handleNext(openAnswer.trim()); }} 
            style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}
          >
            <input
              type={currentQuestion.question_type === 'guess_number' ? 'number' : 'text'}
              value={openAnswer}
              onChange={(e) => setOpenAnswer(e.target.value)}
              placeholder={currentQuestion.question_type === 'guess_number' ? 'Entrez votre estimation...' : 'Écrivez votre réponse...'}
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
            <button type="submit" className="btn-primary" disabled={!openAnswer.trim()} style={{ alignSelf: 'flex-start', padding: '12px 28px' }}>
              Valider la réponse
            </button>
          </form>
        ) : (
          // Multiple Choice QCM
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginTop: '8px' }}>
            {['A', 'B', 'C', 'D'].map(optKey => {
              const optionText = currentQuestion.options[optKey];
              return (
                <button
                  key={optKey}
                  onClick={() => handleNext(optKey)}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    textAlign: 'left',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  className="option-button-hover"
                >
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}>
                    {optKey}
                  </span>
                  <span>{optionText}</span>
                </button>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
