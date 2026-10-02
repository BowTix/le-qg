import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Trophy,
  Share2,
  Check,
  AlertCircle,
  Sparkles,
  RotateCcw,
  X,
  Undo2,
  Eraser,
  PenTool,
  Save,
  CheckCircle2,
  Dumbbell,
  Grid3X3,
  HelpCircle,
} from 'lucide-react';
import { api } from '../utils/api';
import '../sudoku.css';

function formatDateFrench(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatShortDateFrench(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function SudokuScreen({ onBack, onUpdateUserStats }) {
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const [currentDate, setCurrentDate] = useState(todayStr);
  const [loading, setLoading] = useState(true);
  const [gridData, setGridData] = useState(null);
  const [userState, setUserState] = useState(null);

  // Board state: 81-character string
  const [board, setBoard] = useState('0'.repeat(81));
  // Notes state: { [cellIdx]: [1, 2, ...] }
  const [notes, setNotes] = useState({});

  const [selectedCell, setSelectedCell] = useState(null); // index 0..80
  const [isNotesMode, setIsNotesMode] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Undo history: stack of { board, notes }
  const [history, setHistory] = useState([]);

  // UI state
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('error');
  const [validating, setValidating] = useState(false);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isPractice, setIsPractice] = useState(false);
  const [practiceToken, setPracticeToken] = useState(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  const saveTimerRef = useRef(null);

  // 1. Load grid for currentDate (Daily)
  const loadDailyGrid = useCallback(() => {
    setLoading(true);
    setToastMessage(null);
    setSelectedCell(null);
    setHistory([]);
    setIsPractice(false);
    setPracticeToken(null);

    api.get(`/sudoku/grid?date=${todayStr}`)
      .then((res) => {
        setGridData(res.grid);
        setUserState(res.user_state);

        const initialGrid = res.grid.initial_grid;
        const savedState = res.user_state?.grid_state || initialGrid;
        setBoard(savedState);
        setNotes(res.user_state?.notes_state || {});
        setTimerSeconds(res.user_state?.time_spent_seconds || 0);

        // Find first non-given cell to select
        for (let i = 0; i < 81; i++) {
          if (initialGrid[i] === '0') {
            setSelectedCell(i);
            break;
          }
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load Sudoku grid:', err);
        setToastMessage(err.message || 'Erreur de chargement du Sudoku.');
        setToastType('error');
        setLoading(false);
      });
  }, [todayStr]);

  // Load random practice grid
  const loadPracticeGrid = useCallback(() => {
    setLoading(true);
    setToastMessage(null);
    setSelectedCell(null);
    setHistory([]);
    setIsPractice(true);
    setShowVictoryModal(false);

    api.get('/sudoku/practice')
      .then((res) => {
        setGridData(res.grid);
        setPracticeToken(res.practice_token);
        setUserState({ status: 'in_progress', coins_awarded: 0, score_awarded: 0 });

        const initialGrid = res.grid.initial_grid;
        setBoard(initialGrid);
        setNotes({});
        setTimerSeconds(0);

        for (let i = 0; i < 81; i++) {
          if (initialGrid[i] === '0') {
            setSelectedCell(i);
            break;
          }
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load practice Sudoku:', err);
        setToastMessage(err.message || "Erreur de chargement de l'entraînement.");
        setToastType('error');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadDailyGrid();
  }, [loadDailyGrid]);

  // 2. Timer
  useEffect(() => {
    if (loading || userState?.status === 'completed') return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, userState?.status]);

  // 3. Debounced Auto-Save (only for daily grid)
  const triggerAutoSave = useCallback((updatedBoard, updatedNotes, currentTimer) => {
    if (isPractice) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.post('/sudoku/save', {
        date: todayStr,
        grid_state: updatedBoard,
        notes_state: updatedNotes,
        time_spent: currentTimer
      }).then(() => {
        setSaveSuccessNotice(true);
        setTimeout(() => setSaveSuccessNotice(false), 1500);
      }).catch((err) => console.warn('Auto-save error:', err));
    }, 1200);
  }, [todayStr, isPractice]);

  // 4. Calculate Remaining Counts for digits 1..9
  const remainingCounts = useMemo(() => {
    const counts = { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 9 };
    for (let i = 0; i < 81; i++) {
      const char = board[i];
      if (char >= '1' && char <= '9') {
        counts[char] = Math.max(0, counts[char] - 1);
      }
    }
    return counts;
  }, [board]);

  // 5. Detect Conflicts (duplicate numbers in same row, col, or 3x3 box)
  const conflicts = useMemo(() => {
    const conflictSet = new Set();
    if (!board) return conflictSet;

    // Check rows
    for (let r = 0; r < 9; r++) {
      const seen = {};
      for (let c = 0; c < 9; c++) {
        const idx = r * 9 + c;
        const val = board[idx];
        if (val !== '0') {
          if (seen[val] !== undefined) {
            conflictSet.add(idx);
            conflictSet.add(seen[val]);
          } else {
            seen[val] = idx;
          }
        }
      }
    }

    // Check columns
    for (let c = 0; c < 9; c++) {
      const seen = {};
      for (let r = 0; r < 9; r++) {
        const idx = r * 9 + c;
        const val = board[idx];
        if (val !== '0') {
          if (seen[val] !== undefined) {
            conflictSet.add(idx);
            conflictSet.add(seen[val]);
          } else {
            seen[val] = idx;
          }
        }
      }
    }

    // Check 3x3 boxes
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const seen = {};
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const idx = (br * 3 + r) * 9 + (bc * 3 + c);
            const val = board[idx];
            if (val !== '0') {
              if (seen[val] !== undefined) {
                conflictSet.add(idx);
                conflictSet.add(seen[val]);
              } else {
                seen[val] = idx;
              }
            }
          }
        }
      }
    }

    return conflictSet;
  }, [board]);

  // 6. Selected Cell Coordinates and Peer highlights
  const selectedDetails = useMemo(() => {
    if (selectedCell === null) return { row: -1, col: -1, boxR: -1, boxC: -1, value: '0' };
    const row = Math.floor(selectedCell / 9);
    const col = selectedCell % 9;
    const boxR = Math.floor(row / 3);
    const boxC = Math.floor(col / 3);
    const value = board[selectedCell] || '0';
    return { row, col, boxR, boxC, value };
  }, [selectedCell, board]);

  // 7. Input Digit Handler
  const handleInputDigit = useCallback((num) => {
    if (selectedCell === null || !gridData) return;
    if (gridData.initial_grid[selectedCell] !== '0') return; // Cannot overwrite initial clues
    if (userState?.status === 'completed') return;

    const strNum = String(num);

    if (isNotesMode) {
      // Toggle note candidate for this cell
      setNotes((prev) => {
        const currentNotes = prev[selectedCell] || [];
        const nextNotes = currentNotes.includes(num)
          ? currentNotes.filter((n) => n !== num)
          : [...currentNotes, num].sort((a, b) => a - b);

        const nextObj = { ...prev, [selectedCell]: nextNotes };
        triggerAutoSave(board, nextObj, timerSeconds);
        return nextObj;
      });
    } else {
      // Record history before state change
      setHistory((prev) => [...prev.slice(-20), { board, notes }]);

      // Place number on board & clear notes on this cell
      const newBoard = board.substring(0, selectedCell) + strNum + board.substring(selectedCell + 1);
      setBoard(newBoard);

      setNotes((prev) => {
        const nextObj = { ...prev };
        delete nextObj[selectedCell];
        triggerAutoSave(newBoard, nextObj, timerSeconds);
        return nextObj;
      });
    }
  }, [selectedCell, gridData, userState, isNotesMode, board, notes, timerSeconds, triggerAutoSave]);

  // 8. Erase Cell Handler
  const handleErase = useCallback(() => {
    if (selectedCell === null || !gridData) return;
    if (gridData.initial_grid[selectedCell] !== '0') return;
    if (userState?.status === 'completed') return;

    // Check if cell has digit or notes
    const hasDigit = board[selectedCell] !== '0';
    const hasNotes = notes[selectedCell] && notes[selectedCell].length > 0;

    if (hasDigit || hasNotes) {
      setHistory((prev) => [...prev.slice(-20), { board, notes }]);

      const newBoard = board.substring(0, selectedCell) + '0' + board.substring(selectedCell + 1);
      setBoard(newBoard);

      setNotes((prev) => {
        const nextObj = { ...prev };
        delete nextObj[selectedCell];
        triggerAutoSave(newBoard, nextObj, timerSeconds);
        return nextObj;
      });
    }
  }, [selectedCell, gridData, userState, board, notes, timerSeconds, triggerAutoSave]);

  // 9. Undo Handler
  const handleUndo = useCallback(() => {
    if (history.length === 0 || userState?.status === 'completed') return;
    const last = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setBoard(last.board);
    setNotes(last.notes);
    triggerAutoSave(last.board, last.notes, timerSeconds);
  }, [history, userState, timerSeconds, triggerAutoSave]);

  // 10. Physical Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showVictoryModal || showArchiveModal) return;

      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        handleInputDigit(parseInt(e.key, 10));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleErase();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setIsNotesMode((prev) => !prev);
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedCell((prev) => (prev === null ? 0 : (prev % 9 === 8 ? prev : prev + 1)));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedCell((prev) => (prev === null ? 0 : (prev % 9 === 0 ? prev : prev - 1)));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCell((prev) => (prev === null ? 0 : (prev >= 72 ? prev : prev + 9)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCell((prev) => (prev === null ? 0 : (prev < 9 ? prev : prev - 9)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showVictoryModal, handleInputDigit, handleErase, handleUndo]);

  // 11. Validate Grid
  const handleValidateGrid = () => {
    setValidating(true);
    setToastMessage(null);

    const payload = isPractice
      ? { practice_token: practiceToken, grid_state: board, time_spent: timerSeconds }
      : { date: todayStr, grid_state: board, time_spent: timerSeconds };

    api.post('/sudoku/validate', payload)
      .then((res) => {
        setValidating(false);
        if (res.valid) {
          setUserState((prev) => ({
            ...prev,
            status: 'completed',
            coins_awarded: res.coins_awarded,
            score_awarded: res.score_awarded,
            completed_at: new Date().toISOString()
          }));
          setShowVictoryModal(true);

          if (res.coins_awarded > 0 || res.score_awarded > 0) {
            onUpdateUserStats?.({ global_score: res.global_score, coins: res.coins });
          }
        } else {
          setToastMessage(res.message || "La grille contient des erreurs.");
          setToastType('error');
        }
      })
      .catch((err) => {
        setValidating(false);
        console.error('Validation error:', err);
        setToastMessage(err.message || 'Erreur lors de la validation.');
        setToastType('error');
      });
  };

  // 12. Share Result
  const handleShare = () => {
    const formattedDate = formatDateFrench(todayStr);
    const timeFormatted = formatTime(timerSeconds);
    const modeTitle = isPractice ? "Sudoku Entraînement" : `Sudoku Quotidien (${formattedDate})`;

    const shareText = `🔢 Omnia — ${modeTitle}\n⏱️ ${timeFormatted} • Sans aucune erreur !\n🟩🟩🟩🟩🟩🟩🟩🟩🟩\n${window.location.origin}/solo/sudoku`;

    navigator.clipboard.writeText(shareText).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }).catch(() => {
      setToastMessage("Impossible de copier dans le presse-papiers.");
      setToastType('error');
    });
  };

  // 13. Reset Grid
  const handleResetGrid = () => {
    if (!gridData || isCompleted) return;
    if (board === gridData.initial_grid && Object.keys(notes).length === 0) return;
    setHistory((prev) => [...prev.slice(-20), { board, notes }]);
    setBoard(gridData.initial_grid);
    setNotes({});
    setSelectedCell(null);
    if (!isPractice) {
      triggerAutoSave(gridData.initial_grid, {}, timerSeconds);
    }
  };

  const isCompleted = userState?.status === 'completed';

  return (
    <div className="sudoku-page">
      {/* 1. Header */}
      <header className="sudoku-top-header">
        <div className="sudoku-header-left">
          <h1 className="sudoku-main-title">
            <button className="sudoku-tool-btn" onClick={onBack} title="Retour">
              <ArrowLeft size={18} />
            </button>
            <Grid3X3 size={26} className="sudoku-grid-icon" />
            {isPractice ? "Sudoku • Entraînement Libre" : "Sudoku du Jour"}
          </h1>
          <p className="sudoku-sub-title">
            {isPractice
              ? "Grille aléatoire illimitée · +10 Omnis · +8 XP"
              : `${formatDateFrench(todayStr)} · Grille #${gridData?.grid_number || 1} · +60 Omnis · +25 XP`}
          </p>
        </div>

        {isPractice ? (
          <button
            className="sudoku-all-grids-btn"
            onClick={loadDailyGrid}
            style={{ background: 'rgba(234, 179, 8, 0.15)', borderColor: '#eab308', color: '#fef08a' }}
          >
            <Calendar size={16} /> Grille Quotidienne
          </button>
        ) : (
          <button className="sudoku-all-grids-btn" onClick={loadPracticeGrid}>
            <Dumbbell size={16} /> Mode Entraînement (Illimité)
          </button>
        )}
      </header>

      {/* 2. Control Toolbar */}
      <div className="sudoku-toolbar">
        {/* Left: Timer & Quick Tools */}
        <div className="sudoku-toolbar-group">
          <div className="sudoku-tool-timer">
            <Clock size={16} />
            <span>{formatTime(timerSeconds)}</span>
          </div>

          {!isPractice && (
            <button
              type="button"
              onClick={() => triggerAutoSave(board, notes, timerSeconds)}
              className="sudoku-tool-btn"
              title={saveSuccessNotice ? "Sauvegardé !" : "Sauvegarder"}
            >
              <Save size={16} color={saveSuccessNotice ? "#4ade80" : "currentColor"} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="sudoku-tool-btn"
            title="Règles du jeu"
          >
            <HelpCircle size={16} />
          </button>
        </div>

        {/* Right: Practice Reset & New Grid / Status & Validate */}
        <div className="sudoku-toolbar-group">
          {isPractice && (
            <>
              <button
                type="button"
                onClick={handleResetGrid}
                disabled={isCompleted || (board === gridData?.initial_grid && Object.keys(notes).length === 0)}
                className="sudoku-nav-btn"
                title="Effacer vos saisies et recommencer cette grille"
                style={{ padding: '6px 12px' }}
              >
                <RotateCcw size={15} />
                <span>Recommencer</span>
              </button>

              <button
                type="button"
                onClick={loadPracticeGrid}
                className="sudoku-nav-btn"
                title="Générer une autre grille d'entraînement"
                style={{ padding: '6px 12px' }}
              >
                <Sparkles size={15} />
                <span>Autre grille</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleValidateGrid}
            disabled={validating || isCompleted}
            className="btn btn--primary"
            style={{ padding: '7px 18px', fontSize: '0.88rem' }}
          >
            <Check size={16} />
            <span>{validating ? "Vérification..." : isCompleted ? "Résolu" : "Valider"}</span>
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="sudoku-toast">
          <div className={`sudoku-toast-pill ${toastType}`}>
            <AlertCircle size={16} />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* 3. 9x9 Sudoku Board */}
      <div className="sudoku-board-container">
        <div className="sudoku-grid-9">
          {Array.from({ length: 81 }).map((_, idx) => {
            const r = Math.floor(idx / 9);
            const c = idx % 9;
            const boxR = Math.floor(r / 3);
            const boxC = Math.floor(c / 3);

            const isGiven = gridData?.initial_grid[idx] !== '0';
            const val = board[idx];
            const isSelected = selectedCell === idx;

            // Peer highlighting (same row, col, or box)
            const isPeer = selectedCell !== null && !isSelected && (
              r === selectedDetails.row ||
              c === selectedDetails.col ||
              (boxR === selectedDetails.boxR && boxC === selectedDetails.boxC)
            );

            // Same digit highlight
            const isSameDigit = selectedDetails.value !== '0' && val === selectedDetails.value && !isSelected;

            // Conflict detection
            const hasConflict = conflicts.has(idx);

            // 3x3 block thick borders
            const borderRightThick = c === 2 || c === 5;
            const borderBottomThick = r === 2 || r === 5;

            const cellNotes = notes[idx] || [];

            return (
              <div
                key={idx}
                className={`sudoku-cell ${borderRightThick ? 'border-right-thick' : ''} ${
                  borderBottomThick ? 'border-bottom-thick' : ''
                } ${isSelected ? 'is-selected' : ''} ${isPeer ? 'is-peer' : ''} ${
                  isSameDigit ? 'is-same-digit' : ''
                } ${hasConflict ? 'is-conflict' : ''}`}
                onClick={() => setSelectedCell(idx)}
              >
                {val !== '0' ? (
                  <span className={`sudoku-digit ${isGiven ? 'sudoku-digit--given' : 'sudoku-digit--user'}`}>
                    {val}
                  </span>
                ) : (
                  cellNotes.length > 0 && (
                    <div className="sudoku-notes-grid">
                      {Array.from({ length: 9 }).map((_, nIdx) => {
                        const noteNum = nIdx + 1;
                        return (
                          <span key={noteNum} className="sudoku-note-num">
                            {cellNotes.includes(noteNum) ? noteNum : ''}
                          </span>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Action Bar (Undo, Erase, Notes mode) */}
      <div className="sudoku-actions-bar">
        <button
          type="button"
          onClick={handleUndo}
          disabled={history.length === 0 || isCompleted}
          className="sudoku-action-btn"
          title="Annuler le dernier coup (Ctrl+Z)"
        >
          <Undo2 size={16} />
          <span>Annuler</span>
        </button>

        <button
          type="button"
          onClick={handleErase}
          disabled={isCompleted || selectedCell === null || gridData?.initial_grid[selectedCell] !== '0'}
          className="sudoku-action-btn"
          title="Effacer (Retour arrière)"
        >
          <Eraser size={16} />
          <span>Effacer</span>
        </button>

        <button
          type="button"
          onClick={() => setIsNotesMode((prev) => !prev)}
          className={`sudoku-action-btn ${isNotesMode ? 'is-active' : ''}`}
          title="Activer/Désactiver le mode Crayon (Touche N)"
        >
          <PenTool size={16} />
          <span>Notes {isNotesMode ? '(ON)' : '(OFF)'}</span>
        </button>
      </div>

      {/* 5. Keypad 1 to 9 */}
      <div className="sudoku-keypad">
        {Array.from({ length: 9 }).map((_, idx) => {
          const digit = idx + 1;
          const remaining = remainingCounts[digit];
          const isDone = remaining === 0;

          return (
            <button
              key={digit}
              type="button"
              onClick={() => handleInputDigit(digit)}
              disabled={isCompleted || (isDone && !isNotesMode)}
              className="sudoku-key-btn"
              title={`Insérer le chiffre ${digit}`}
            >
              <span className="sudoku-key-digit">{digit}</span>
              <span className="sudoku-key-count">{isDone ? '✓' : remaining}</span>
            </button>
          );
        })}
      </div>

      {/* 6. Victory Modal */}
      {showVictoryModal && (
        <div className="sudoku-modal-overlay">
          <div className="sudoku-modal-card">
            <button
              type="button"
              onClick={() => setShowVictoryModal(false)}
              className="sudoku-modal-close"
            >
              <X size={20} />
            </button>

            <div className="sudoku-victory-icon-circle">
              <Trophy size={32} />
            </div>

            <h2 style={{ color: '#f8fafc', margin: '0 0 8px', fontFamily: 'Cabinet Grotesk' }}>
              {isPractice ? "Entraînement Réussi !" : "Grille Quotidienne Réussie !"}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              {isPractice
                ? "Bravo ! Tu as complété cette grille d'entraînement sans aucune erreur."
                : `Félicitations, tu as complété la grille classique du ${formatShortDateFrench(todayStr)} sans aucune erreur !`}
            </p>

            <div className="sudoku-victory-stats">
              <div className="sudoku-stat-pill">
                <small>Temps écoulé</small>
                <strong>{formatTime(timerSeconds)}</strong>
              </div>
              <div className="sudoku-stat-pill">
                <small>Récompense</small>
                <strong style={{ color: '#facc15' }}>
                  +{userState?.coins_awarded || (isPractice ? 10 : 60)} Omnis · +{userState?.score_awarded || (isPractice ? 8 : 25)} XP
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={loadPracticeGrid}
                className="btn btn--primary"
                style={{ padding: '10px 18px', gap: 8 }}
              >
                <Dumbbell size={16} />
                <span>{isPractice ? "Autre grille" : "Enchaîner en entraînement"}</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="btn btn--secondary"
                style={{ padding: '10px 18px', gap: 8 }}
              >
                <Share2 size={16} />
                <span>{copiedShare ? "Grille copiée !" : "Partager"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowVictoryModal(false)}
                className="btn btn--secondary"
                style={{ padding: '10px 16px' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="sudoku-modal-overlay" onClick={() => setShowRulesModal(false)}>
          <div className="sudoku-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="sudoku-modal-close"
              onClick={() => setShowRulesModal(false)}
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
            <div className="sudoku-victory-icon-circle" style={{ borderColor: '#a855f7', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
              <HelpCircle size={32} />
            </div>
            <h2 className="sudoku-modal-title" style={{ fontSize: '1.3rem', marginBottom: '10px' }}>
              Règles du Sudoku
            </h2>
            <div style={{ textAlign: 'left', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.55', margin: '14px 0 20px' }}>
              <p style={{ margin: '0 0 10px' }}>
                Remplis la grille 9x9 avec les chiffres de <strong>1 à 9</strong> en respectant 3 règles fondamentales :
              </p>
              <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Chaque chiffre n'apparaît qu'<strong>une seule fois par ligne</strong>.</li>
                <li>Chaque chiffre n'apparaît qu'<strong>une seule fois par colonne</strong>.</li>
                <li>Chaque chiffre n'apparaît qu'<strong>une seule fois par région 3x3</strong>.</li>
                <li>Active le <strong>Mode Notes (Crayon)</strong> pour noter temporairement tes hypothèses dans les cases.</li>
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
