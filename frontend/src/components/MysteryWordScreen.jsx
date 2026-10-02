import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Type, Trophy, XCircle, RotateCcw, Sparkles, Clock, AlertCircle, Award, Share2, Check, HelpCircle, X } from 'lucide-react';
import OmniIcon from './OmniIcon';
import { api } from '../utils/api';
import '../mystery-word.css';

const KEYBOARD_ROWS = [
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['ENTER', 'W', 'X', 'C', 'V', 'B', 'N', 'BACKSPACE']
];

export default function MysteryWordScreen({ onBack, onUpdateUserStats }) {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState(null);
  const [guesses, setGuesses] = useState([]); // Array of { word: string, evaluation: Array<{ letter, status }> }
  const [currentGuess, setCurrentGuess] = useState('');
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameStatus, setGameStatus] = useState('in_progress'); // 'in_progress', 'won', 'lost'
  const [targetWord, setTargetWord] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [shakeRow, setShakeRow] = useState(false);
  const [rewards, setRewards] = useState({ coins: 0, score: 0 });
  const [timeLeftToMidnight, setTimeLeftToMidnight] = useState('');
  const [copied, setCopied] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Fetch initial status on mount
  useEffect(() => {
    let active = true;
    api.get('/mystery-word/status')
      .then((res) => {
        if (!active) return;
        setStatusData(res);
        setGuesses(res.guesses || []);
        setGameStatus(res.status || 'in_progress');
        setIsGameOver(res.played || res.status === 'won' || res.status === 'lost');
        if (res.target_word) setTargetWord(res.target_word);
        if (res.coins_awarded || res.score_awarded) {
          setRewards({ coins: res.coins_awarded, score: res.score_awarded });
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load mystery word status:', err);
        setErrorMessage(err.message || "Impossible de charger le défi.");
        setLoading(false);
      });

    return () => { active = false; };
  }, []);

  // Countdown to midnight
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      const diffMs = tomorrow - now;
      if (diffMs <= 0) {
        setTimeLeftToMidnight('00:00:00');
        return;
      }
      const hours = Math.floor(diffMs / (1000 * 60 * 60)).toString().padStart(2, '0');
      const mins = Math.floor((diffMs / (1000 * 60)) % 60).toString().padStart(2, '0');
      const secs = Math.floor((diffMs / 1000) % 60).toString().padStart(2, '0');
      setTimeLeftToMidnight(`${hours}:${mins}:${secs}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute key statuses for the virtual keyboard
  const keyStatuses = React.useMemo(() => {
    const map = {};
    guesses.forEach((g) => {
      g.evaluation.forEach(({ letter, status }) => {
        const current = map[letter];
        if (status === 'correct') {
          map[letter] = 'correct';
        } else if (status === 'present' && current !== 'correct') {
          map[letter] = 'present';
        } else if (status === 'absent' && !current) {
          map[letter] = 'absent';
        }
      });
    });
    return map;
  }, [guesses]);

  // Handle letter input
  const handleChar = useCallback((char) => {
    if (isGameOver || submitting) return;
    setErrorMessage('');
    setCurrentGuess((prev) => {
      if (prev.length >= 5) return prev;
      return prev + char.toUpperCase();
    });
  }, [isGameOver, submitting]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (isGameOver || submitting) return;
    setErrorMessage('');
    setCurrentGuess((prev) => prev.slice(0, -1));
  }, [isGameOver, submitting]);

  // Trigger shake animation on row
  const triggerShake = () => {
    setShakeRow(true);
    setTimeout(() => setShakeRow(false), 500);
  };

  // Submit current word
  const handleSubmit = useCallback(async () => {
    if (isGameOver || submitting) return;

    if (currentGuess.length < 5) {
      setErrorMessage("Le mot doit comporter 5 lettres.");
      triggerShake();
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const res = await api.post('/mystery-word/guess', { guess: currentGuess });
      
      const newGuesses = [...guesses, { word: currentGuess, evaluation: res.evaluation }];
      setGuesses(newGuesses);
      setCurrentGuess('');

      if (res.is_game_over) {
        setIsGameOver(true);
        setGameStatus(res.status);
        if (res.target_word) setTargetWord(res.target_word);
        setRewards({ coins: res.coins_awarded, score: res.score_awarded });

        if (onUpdateUserStats && (res.coins_awarded > 0 || res.score_awarded > 0)) {
          onUpdateUserStats({ global_score: res.global_score, coins: res.coins });
        }
      }
    } catch (err) {
      setErrorMessage(err.message || "Mot non valide ou erreur serveur.");
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  }, [currentGuess, isGameOver, submitting, guesses, onUpdateUserStats]);

  // Copy shareable Wordle grid to clipboard
  const handleShare = useCallback(() => {
    if (!isGameOver) return;

    const dateObj = new Date();
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const scoreLabel = gameStatus === 'won' ? `${guesses.length}/6` : 'X/6';

    const gridEmojis = guesses
      .map((g) =>
        g.evaluation
          .map((e) => {
            if (e.status === 'correct') return '🟩';
            if (e.status === 'present') return '🟨';
            return '⬛';
          })
          .join('')
      )
      .join('\n');

    const shareText = `Omnia - Mot Mystère #${d}/${m} 🎯\n${scoreLabel}\n\n${gridEmojis}\n\nJouez vous aussi sur : ${window.location.origin}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [isGameOver, gameStatus, guesses]);

  // Physical keyboard listener
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key && e.key.length === 1) {
        const normalized = e.key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (/^[a-zA-Z]$/.test(normalized)) {
          handleChar(normalized);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleChar, handleDelete, handleSubmit]);

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="loading-state">
          <div className="spinner spinner-lg" />
          <p style={{ marginTop: '12px', fontWeight: 600 }}>Chargement du Mot Mystère...</p>
        </div>
      </div>
    );
  }

  const currentRowIndex = guesses.length;

  return (
    <div className="mystery-page animate-fade-in">
      {/* Header Navigation */}
      <div className="mystery-header-nav">
        <button
          type="button"
          onClick={onBack}
          className="btn-secondary mystery-back-btn"
        >
          <ArrowLeft size={16} /> Retour
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="btn-secondary mystery-back-btn"
            title="Règles du jeu"
            style={{ padding: '6px 10px' }}
          >
            <HelpCircle size={16} />
          </button>
          <div className="mystery-attempt-badge">
            Tentative <strong>{Math.min(guesses.length + (isGameOver ? 0 : 1), 6)}</strong> / 6
          </div>
        </div>
      </div>

      {/* Header Title Section */}
      <div className="mystery-header-title">
        <span className="kicker"><Type size={14} /> Défi quotidien</span>
        <h1 className="mystery-title">Mot Mystère</h1>
        <p className="mystery-subtitle">Trouve le mot secret du jour en 6 essais maximum.</p>
      </div>

      {/* Error / Toast container */}
      <div className="mystery-toast-container" style={{ opacity: errorMessage ? 1 : 0, pointerEvents: errorMessage ? 'auto' : 'none' }}>
        {errorMessage && (
          <div className="mystery-toast">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Word Grid 6 x 5 */}
      <div className="mystery-grid">
        {Array.from({ length: 6 }).map((_, rowIndex) => {
          const isSubmitted = rowIndex < guesses.length;
          const isCurrent = rowIndex === currentRowIndex && !isGameOver;
          const guessData = isSubmitted ? guesses[rowIndex] : null;

          return (
            <div
              key={rowIndex}
              className={`mystery-row ${isCurrent && shakeRow ? 'animate-shake' : ''}`}
            >
              {Array.from({ length: 5 }).map((_, colIndex) => {
                let letter = '';
                let status = 'empty';

                if (isSubmitted && guessData) {
                  letter = guessData.word[colIndex] || '';
                  status = guessData.evaluation[colIndex]?.status || 'absent';
                } else if (isCurrent) {
                  letter = currentGuess[colIndex] || '';
                  status = letter ? 'typing' : 'empty';
                }

                return (
                  <div
                    key={colIndex}
                    className={`mystery-tile mystery-tile--${status}`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Game Over Banner & Stats */}
      {isGameOver && (
        <div className="mystery-result-card animate-fade-in">
          <div className={`mystery-result-icon ${gameStatus === 'won' ? 'mystery-result-icon--won' : 'mystery-result-icon--lost'}`}>
            {gameStatus === 'won' ? <Trophy size={28} /> : <XCircle size={28} />}
          </div>

          <h2 className="mystery-result-title">
            {gameStatus === 'won' ? "Victoire !" : "Partie terminée"}
          </h2>
          <p className="mystery-result-desc">
            {gameStatus === 'won'
              ? `Bravo, tu as démasqué le mot en ${guesses.length} tentative${guesses.length > 1 ? 's' : ''} !`
              : "Tu n'as pas trouvé le mot secret aujourd'hui. Reviens demain pour retenter ta chance !"}
          </p>

          {targetWord && (
            <div className="mystery-secret-pill">
              <span>Mot secret</span>
              <strong className="mystery-secret-word">{targetWord}</strong>
            </div>
          )}

          {/* Rewards pill */}
          {(rewards.coins > 0 || rewards.score > 0) && (
            <div className="mystery-rewards-pill">
              {rewards.coins > 0 && (
                <span className="mystery-reward-coins">
                  <OmniIcon size={16} /> +{rewards.coins} Omnis
                </span>
              )}
              {rewards.score > 0 && (
                <span className="mystery-reward-score">
                  <Award size={16} /> +{rewards.score} score
                </span>
              )}
            </div>
          )}

          <div className="mystery-countdown">
            <Clock size={13} /> Prochain mot dans <strong>{timeLeftToMidnight}</strong>
          </div>

          <div className="mystery-result-actions">
            <button
              type="button"
              className="btn-primary mystery-share-btn"
              onClick={handleShare}
            >
              {copied ? (
                <>
                  <Check size={16} /> Résultat copié !
                </>
              ) : (
                <>
                  <Share2 size={16} /> Partager mon résultat
                </>
              )}
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={onBack}
              style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 600 }}
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      )}

      {/* Virtual AZERTY Keyboard */}
      {!isGameOver && (
        <div className="mystery-keyboard">
          {KEYBOARD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="mystery-keyboard-row">
              {row.map((k) => {
                const isSpecial = k === 'ENTER' || k === 'BACKSPACE';
                const status = keyStatuses[k];

                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (k === 'ENTER') handleSubmit();
                      else if (k === 'BACKSPACE') handleDelete();
                      else handleChar(k);
                    }}
                    disabled={isGameOver || submitting}
                    className={`mystery-key ${isSpecial ? 'mystery-key--special' : ''} ${status ? `mystery-key--${status}` : ''}`}
                  >
                    {k === 'BACKSPACE' ? '⌫' : k === 'ENTER' ? 'Entrée' : k}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="mystery-modal-backdrop" onClick={() => setShowRulesModal(false)}>
          <div className="mystery-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="mystery-modal-close"
              onClick={() => setShowRulesModal(false)}
              aria-label="Fermer"
              style={{ position: 'absolute', top: 14, right: 14, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <div className="mystery-victory-icon" style={{ background: 'rgba(163, 230, 53, 0.15)', color: '#a3e635', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <HelpCircle size={32} />
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
              Règles du Mot Mystère
            </h2>
            <div style={{ textAlign: 'left', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.55', margin: '14px 0 20px' }}>
              <p style={{ margin: '0 0 10px' }}>
                Devine le mot caché de <strong>5 lettres</strong> en 6 essais maximum :
              </p>
              <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Chaque tentative doit être un mot valide de 5 lettres du dictionnaire.</li>
                <li>
                  <strong style={{ color: '#22c55e' }}>Vert</strong> : La lettre est correcte et bien placée.
                </li>
                <li>
                  <strong style={{ color: '#eab308' }}>Orange / Jaune</strong> : La lettre est présente dans le mot mais à une autre place.
                </li>
                <li>
                  <strong style={{ color: '#64748b' }}>Gris</strong> : La lettre n'est pas dans le mot.
                </li>
              </ul>
            </div>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setShowRulesModal(false)}
              style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }}
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
