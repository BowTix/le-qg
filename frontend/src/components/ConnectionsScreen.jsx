import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Dumbbell,
  HelpCircle,
  RotateCcw,
  Save,
  Share2,
  Shuffle,
  Sparkles,
  Trophy,
  X,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../utils/api';
import './ConnectionsScreen.css';

function formatDateFrench(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDateFrench(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const LEVEL_COLORS = {
  1: { bg: '#f59e0b', text: '#000', label: 'Facile' },
  2: { bg: '#10b981', text: '#000', label: 'Moyen' },
  3: { bg: '#3b82f6', text: '#fff', label: 'Difficile' },
  4: { bg: '#a855f7', text: '#fff', label: 'Expert' },
};

export default function ConnectionsScreen({ onBack, onUpdateUserStats }) {
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const [currentDate, setCurrentDate] = useState(todayStr);
  const [loading, setLoading] = useState(true);
  const [isPractice, setIsPractice] = useState(false);
  const [practiceToken, setPracticeToken] = useState(null);

  // Puzzle State
  const [words, setWords] = useState([]);
  const [initialPracticeWords, setInitialPracticeWords] = useState([]);
  const [solvedCategories, setSolvedCategories] = useState([]);
  const [selectedWords, setSelectedWords] = useState([]);
  const [mistakesRemaining, setMistakesRemaining] = useState(4);
  const [guessesHistory, setGuessesHistory] = useState([]);
  const [userState, setUserState] = useState(null);
  const [allCategories, setAllCategories] = useState(null);

  // Status & Timing
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [validating, setValidating] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Modals & Messages
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('info');
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const timerIntervalRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((msg, type = 'info', duration = 3000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    setToastType(type);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, duration);
  }, []);

  // Grid number computed from reference date
  const gridNumber = useMemo(() => {
    const diffDays = Math.abs(
      Math.floor((new Date(currentDate) - new Date('2023-01-01')) / 86400000)
    );
    return diffDays || 1;
  }, [currentDate]);

  // 1. Timer effect
  useEffect(() => {
    const isDone = userState?.status === 'completed' || userState?.status === 'failed';
    if (!loading && !isDone) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((t) => t + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [loading, userState?.status]);

  // 2. Auto-save time spent in Daily Mode
  useEffect(() => {
    if (isPractice || loading || !currentDate) return;
    const isDone = userState?.status === 'completed' || userState?.status === 'failed';
    if (isDone) return;

    const interval = setInterval(() => {
      api.post('/connections/save', { date: currentDate, time_spent: timerSeconds }).catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, [isPractice, loading, currentDate, userState?.status, timerSeconds]);

  // 3. Load Daily Grid
  const loadDailyGrid = useCallback((targetDate = todayStr) => {
    setLoading(true);
    setSelectedWords([]);
    setIsPractice(false);
    setPracticeToken(null);
    setShowVictoryModal(false);
    setCurrentDate(targetDate);

    api.get(`/connections/grid?date=${targetDate}`)
      .then((res) => {
        if (res.user_state?.status === 'failed' && res.all_categories) {
          setSolvedCategories(res.all_categories);
          setWords([]);
        } else {
          setWords(res.grid?.words || []);
          setSolvedCategories(res.grid?.solved_categories || []);
        }
        setUserState(res.user_state);
        setMistakesRemaining(res.user_state?.mistakes_remaining ?? 4);
        setGuessesHistory(res.user_state?.guesses_history || []);
        setTimerSeconds(res.user_state?.time_spent_seconds || 0);
        setAllCategories(res.all_categories || null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load Connections grid:', err);
        showToast(err.message || 'Impossible de charger la grille.', 'error');
        setLoading(false);
      });
  }, [todayStr, showToast]);

  // 4. Load Practice Grid
  const loadPracticeGrid = useCallback(() => {
    setLoading(true);
    setSelectedWords([]);
    setIsPractice(true);
    setShowVictoryModal(false);
    setTimerSeconds(0);
    setGuessesHistory([]);

    api.get('/connections/practice')
      .then((res) => {
        const receivedWords = res.grid?.words || [];
        setWords(receivedWords);
        setInitialPracticeWords(receivedWords);
        setSolvedCategories([]);
        setPracticeToken(res.practice_token);
        setMistakesRemaining(4);
        setUserState({ status: 'in_progress' });
        setAllCategories(null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load practice Connections:', err);
        showToast(err.message || 'Erreur lors de la génération.', 'error');
        setLoading(false);
      });
  }, [showToast]);

  // Initial load
  useEffect(() => {
    loadDailyGrid(todayStr);
  }, [loadDailyGrid, todayStr]);

  // 5. Select/deselect word
  const handleToggleWord = (word) => {
    if (userState?.status === 'completed' || userState?.status === 'failed' || validating) return;

    if (selectedWords.includes(word)) {
      setSelectedWords((prev) => prev.filter((w) => w !== word));
    } else {
      if (selectedWords.length >= 4) {
        showToast('4 mots maximum à la fois.', 'warning', 1800);
        return;
      }
      setSelectedWords((prev) => [...prev, word]);
    }
  };

  // 6. Deselect all
  const handleDeselectAll = () => {
    if (validating) return;
    setSelectedWords([]);
  };

  // 7. Shuffle remaining words
  const handleShuffle = () => {
    setWords((prev) => {
      const arr = [...prev];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
  };

  // 8. Reset Practice Grid
  const handleResetPracticeGrid = () => {
    if (!isPractice || initialPracticeWords.length === 0) return;
    setSelectedWords([]);
    setSolvedCategories([]);
    setWords([...initialPracticeWords]);
    setMistakesRemaining(4);
    setUserState({ status: 'in_progress' });
    setGuessesHistory([]);
    showToast('Grille réinitialisée.', 'info', 1800);
  };

  // 9. Submit Guess
  const handleSubmit = async () => {
    if (selectedWords.length !== 4 || validating) return;

    const sortedGuess = [...selectedWords].sort().join(',');
    const alreadyGuessed = guessesHistory.some(
      (g) => [...g].sort().join(',') === sortedGuess
    );

    if (alreadyGuessed) {
      showToast('Tu as déjà testé cette combinaison !', 'warning', 2500);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
      return;
    }

    setValidating(true);
    setGuessesHistory((prev) => [...prev, selectedWords]);

    try {
      const payload = {
        words: selectedWords,
        date: currentDate,
        practice_token: isPractice ? practiceToken : undefined,
        time_spent: timerSeconds,
      };

      const res = await api.post('/connections/guess', payload);

      if (res.matched && res.category) {
        setSolvedCategories((prev) => [...prev, res.category]);
        setWords((prev) => prev.filter((w) => !res.category.words.includes(w)));
        setSelectedWords([]);
        showToast(res.message || 'Bien vu !', 'success', 2500);

        if (isPractice && res.practice_token) {
          setPracticeToken(res.practice_token);
        }

        if (res.status === 'completed') {
          setUserState((prev) => ({
            ...prev,
            status: 'completed',
            coins_awarded: res.coins_awarded,
            score_awarded: res.score_awarded,
          }));
          if (onUpdateUserStats && (res.coins || res.global_score)) {
            onUpdateUserStats(res.global_score, res.coins);
          }
          setTimeout(() => setShowVictoryModal(true), 800);
        }
      } else {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 600);
        setMistakesRemaining(res.mistakes_remaining ?? 0);

        if (isPractice && res.practice_token) {
          setPracticeToken(res.practice_token);
        }

        if (res.one_away) {
          showToast('Tu y es presque... (3 sur 4) !', 'warning', 3000);
        } else {
          showToast('Pas de lien trouvé.', 'error', 2200);
        }

        if (res.status === 'failed') {
          setUserState((prev) => ({ ...prev, status: 'failed' }));
          setAllCategories(res.all_categories || null);
          if (res.all_categories) {
            setSolvedCategories(res.all_categories);
            setWords([]);
            setSelectedWords([]);
          }
          showToast('Plus d’essais ! Voici la solution révélée ci-dessous.', 'error', 4000);
        }
      }
    } catch (err) {
      console.error('Submit guess error:', err);
      showToast(err.message || 'Erreur lors de la validation.', 'error');
    } finally {
      setValidating(false);
    }
  };

  // 10. Share Result
  const handleShare = () => {
    const isCompleted = userState?.status === 'completed';
    const statusText = isCompleted ? 'Victoire' : 'Défaite';
    const mistakesUsed = 4 - mistakesRemaining;

    const emojiSquares = {
      1: '🟨',
      2: '🟩',
      3: '🟦',
      4: '🟪',
    };

    let emojiLines = '';
    solvedCategories.forEach((cat) => {
      const sq = emojiSquares[cat.level] || '⬜';
      emojiLines += `${sq}${sq}${sq}${sq}\n`;
    });

    const text = `Le QG — Les Liens\n${isPractice ? 'Entraînement' : currentDate} (${statusText})\nTemps : ${formatTime(timerSeconds)} · Erreurs : ${mistakesUsed}/4\n\n${emojiLines}https://leqg.app`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    });
  };

  return (
    <div className="conn-page">
      {/* 1. Header (Standard Le QG) */}
      <header className="conn-top-header">
        <div className="conn-header-left">
          <h1 className="conn-main-title">
            <button className="conn-tool-btn" onClick={onBack} title="Retour">
              <ArrowLeft size={18} />
            </button>
            {isPractice ? 'Les Liens • Entraînement Libre' : 'Les Liens du Jour'}
          </h1>
          <p className="conn-sub-title">
            {isPractice
              ? 'Grille aléatoire illimitée · +10 pièces · +8 XP'
              : `${formatDateFrench(currentDate)} · Grille #${gridNumber} · +60 pièces · +25 XP`}
          </p>
        </div>

        {isPractice ? (
          <button
            className="conn-all-grids-btn"
            onClick={() => loadDailyGrid(todayStr)}
            style={{ background: 'rgba(234, 179, 8, 0.15)', borderColor: '#eab308', color: '#fef08a' }}
          >
            <Calendar size={16} /> Grille Quotidienne
          </button>
        ) : (
          <button className="conn-all-grids-btn" onClick={loadPracticeGrid}>
            <Dumbbell size={16} /> Mode Entraînement (Illimité)
          </button>
        )}
      </header>

      {/* 2. Control Toolbar */}
      <div className="conn-toolbar">
        {/* Left: Timer & Quick Tools */}
        <div className="conn-toolbar-group">
          <div className="conn-tool-timer">
            <Clock size={16} />
            <span>{formatTime(timerSeconds)}</span>
          </div>

          {!isPractice && (
            <button
              type="button"
              className="conn-tool-btn"
              title="Grille sauvegardée automatiquement"
            >
              <Save size={16} />
            </button>
          )}

          <button
            type="button"
            className="conn-tool-btn"
            onClick={() => setShowRulesModal(true)}
            title="Règles du jeu"
          >
            <HelpCircle size={16} />
          </button>
        </div>

        {/* Right: Status or Practice Reset */}
        <div className="conn-toolbar-group">
          {userState?.status === 'completed' ? (
            <span className="conn-status-badge conn-status-badge--completed">
              <Check size={16} /> Résolu
            </span>
          ) : userState?.status === 'failed' ? (
            <span className="conn-status-badge conn-status-badge--failed">
              <X size={16} /> Échec
            </span>
          ) : isPractice ? (
            <>
              <button
                type="button"
                onClick={handleResetPracticeGrid}
                disabled={solvedCategories.length === 0 && selectedWords.length === 0 && mistakesRemaining === 4}
                className="conn-nav-btn"
                title="Recommencer cette grille"
                style={{ padding: '6px 12px' }}
              >
                <RotateCcw size={15} />
                <span>Recommencer</span>
              </button>

              <button
                type="button"
                onClick={loadPracticeGrid}
                className="conn-nav-btn"
                title="Générer une autre grille d'entraînement"
                style={{ padding: '6px 12px' }}
              >
                <Sparkles size={15} />
                <span>Autre grille</span>
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* 3. Main Play Area */}
      {loading ? (
        <div className="conn-loader">
          <span className="spinner spinner-lg" />
          <p>Chargement des liens…</p>
        </div>
      ) : (
        <div className="conn-game-box">
          {/* Top Prompt */}
          <p className="conn-prompt">
            {userState?.status === 'failed' ? (
              <span style={{ color: '#f87171', fontWeight: 650 }}>
                Partie terminée · Voici les 4 catégories secrètes :
              </span>
            ) : userState?.status === 'completed' ? (
              <span style={{ color: '#34d399', fontWeight: 650 }}>
                Bravo ! Toutes les connexions ont été trouvées.
              </span>
            ) : (
              <>Forme <strong>4 groupes de 4 mots</strong> partageant un lien commun.</>
            )}
          </p>

          {/* Solved Categories Stack */}
          <div className="conn-solved-stack">
            {solvedCategories.map((cat) => {
              const meta = LEVEL_COLORS[cat.level] || LEVEL_COLORS[1];
              return (
                <div
                  key={cat.level}
                  className="conn-solved-card"
                  style={{
                    backgroundColor: meta.bg,
                    color: meta.text,
                  }}
                >
                  <strong className="conn-solved-theme">{cat.theme.toUpperCase()}</strong>
                  <span className="conn-solved-words">{cat.words.join(', ')}</span>
                </div>
              );
            })}
          </div>

          {/* Unsolved Words Grid */}
          {words.length > 0 && userState?.status === 'in_progress' && (
            <div className={`conn-grid ${isShaking ? 'is-shaking' : ''}`}>
              {words.map((word) => {
                const isSelected = selectedWords.includes(word);
                return (
                  <button
                    key={word}
                    type="button"
                    className={`conn-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleToggleWord(word)}
                  >
                    <span className="conn-card__text">{word}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Mistakes indicator (only during active game) */}
          {userState?.status === 'in_progress' && (
            <div className="conn-mistakes-row">
              <span className="conn-mistakes-label">Erreurs restantes :</span>
              <div className="conn-mistakes-dots">
                {[0, 1, 2, 3].map((idx) => {
                  const isLost = idx >= mistakesRemaining;
                  return (
                    <span
                      key={idx}
                      className={`conn-mistake-dot ${isLost ? 'is-lost' : ''}`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Toast feedback */}
          {toastMessage && (
            <div className={`conn-toast conn-toast--${toastType}`}>
              {toastType === 'error' && <XCircle size={16} />}
              {toastType === 'warning' && <AlertTriangle size={16} />}
              {toastType === 'success' && <Sparkles size={16} />}
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Actions Bar */}
          {userState?.status === 'in_progress' ? (
            <div className="conn-actions-bar">
              <div className="conn-actions-group">
                <button
                  type="button"
                  className="conn-action-btn conn-action-btn--secondary"
                  onClick={handleShuffle}
                  title="Mélanger l'ordre des mots"
                >
                  <Shuffle size={15} />
                  <span>Mélanger</span>
                </button>

                <button
                  type="button"
                  className="conn-action-btn conn-action-btn--secondary"
                  onClick={handleDeselectAll}
                  disabled={selectedWords.length === 0}
                  title="Tout désélectionner"
                >
                  <X size={15} />
                  <span>Désélectionner</span>
                </button>
              </div>

              <div className="conn-actions-group">
                <button
                  type="button"
                  className="conn-action-btn conn-action-btn--primary"
                  onClick={handleSubmit}
                  disabled={selectedWords.length !== 4 || validating}
                >
                  <Check size={16} />
                  <span>{validating ? 'Vérification…' : 'Valider'}</span>
                </button>
              </div>
            </div>
          ) : userState?.status === 'failed' ? (
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '0.8rem' }}>
              <button
                type="button"
                className="conn-action-btn conn-action-btn--primary"
                onClick={loadPracticeGrid}
                style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}
              >
                <Dumbbell size={16} />
                <span>S’entraîner sur une autre grille</span>
              </button>
            </div>
          ) : !isPractice ? (
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '0.8rem' }}>
              <button
                type="button"
                className="conn-action-btn conn-action-btn--primary"
                onClick={loadPracticeGrid}
                style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}
              >
                <Dumbbell size={16} />
                <span>Enchaîner en entraînement</span>
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* 4. Victory Modal */}
      {showVictoryModal && (
        <div className="conn-modal-backdrop" onClick={() => setShowVictoryModal(false)}>
          <div className="conn-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="conn-modal-icon-badge conn-modal-icon-badge--success">
              <Trophy size={36} />
            </div>

            <h2 className="conn-modal-title">
              {isPractice ? 'Entraînement Réussi !' : 'Connexions Parfaites !'}
            </h2>
            <p className="conn-modal-desc">
              {isPractice
                ? 'Tu as percé à jour toutes les connexions de cette grille !'
                : `Tu as résolu la grille du ${formatShortDateFrench(currentDate)} avec brio.`}
            </p>

            <div className="conn-stats-row">
              <div className="conn-stat-box">
                <span className="conn-stat-val">{formatTime(timerSeconds)}</span>
                <span className="conn-stat-lbl">Temps</span>
              </div>
              <div className="conn-stat-box">
                <span className="conn-stat-val">+{userState?.score_awarded || (isPractice ? 8 : 25)}</span>
                <span className="conn-stat-lbl">XP</span>
              </div>
              <div className="conn-stat-box">
                <span className="conn-stat-val">+{userState?.coins_awarded || (isPractice ? 10 : 60)}</span>
                <span className="conn-stat-lbl">Pièces</span>
              </div>
            </div>

            <div className="conn-modal-btns">
              <button
                className="conn-modal-btn conn-modal-btn--primary"
                onClick={loadPracticeGrid}
              >
                <Dumbbell size={16} />
                <span>{isPractice ? 'Autre grille' : 'Jouer en entraînement'}</span>
              </button>

              <button className="conn-modal-btn conn-modal-btn--secondary" onClick={handleShare}>
                <Share2 size={16} />
                <span>{copiedShare ? 'Copié !' : 'Partager'}</span>
              </button>

              <button className="conn-modal-btn conn-modal-btn--secondary" onClick={() => setShowVictoryModal(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Rules Modal */}
      {showRulesModal && (
        <div className="conn-modal-backdrop" onClick={() => setShowRulesModal(false)}>
          <div className="conn-modal-card conn-modal-card--rules" onClick={(e) => e.stopPropagation()}>
            <h2 className="conn-modal-title">Règles des Liens</h2>
            <div className="conn-rules-content">
              <p>
                Trouve <strong>4 groupes de 4 mots</strong> partageant un point commun ou une thématique secrète.
              </p>
              <ul>
                <li>Sélectionne 4 mots et clique sur <strong>Valider</strong>.</li>
                <li>Si le groupe est correct, la catégorie se révèle avec sa couleur.</li>
                <li>Tu as droit à <strong>4 erreurs</strong> avant la fin de la partie.</li>
                <li>
                  <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>Jaune</span> = Simple & direct.<br />
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>Vert</span> = Thématique moyenne.<br />
                  <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>Bleu</span> = Vocabulaire & spécificités.<br />
                  <span style={{ color: '#a855f7', fontWeight: 'bold' }}>Violet</span> = Pièges, jeux de mots et doubles sens.
                </li>
              </ul>
            </div>
            <button className="conn-modal-btn conn-modal-btn--primary" onClick={() => setShowRulesModal(false)}>
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
