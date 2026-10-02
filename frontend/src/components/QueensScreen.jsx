import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Crown,
  X,
  RotateCcw,
  Undo2,
  Share2,
  Trophy,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Eraser,
  Dumbbell,
  Check
} from 'lucide-react';
import { api } from '../utils/api';
import '../queens.css';

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

export default function QueensScreen({ onBack, onUpdateUserStats }) {
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

  // Board state: 64-character string ('.', 'X', 'Q')
  const [board, setBoard] = useState('.'.repeat(64));
  const [selectedCell, setSelectedCell] = useState(null);
  const [inputMode, setInputMode] = useState('cycle'); // 'cycle' | 'queen' | 'cross'
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Undo history: stack of board strings
  const [history, setHistory] = useState([]);

  // UI state
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('error');
  const [validating, setValidating] = useState(false);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [isPractice, setIsPractice] = useState(false);
  const [practiceToken, setPracticeToken] = useState(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const saveTimerRef = useRef(null);
  const gridWrapperRef = useRef(null);
  const liveBoardRef = useRef(board);
  const dragStateRef = useRef({
    isDown: false,
    hasMoved: false,
    startCell: null,
    lastCell: null,
    mode: null,
    initialBoard: null,
  });
  const wasDraggingRef = useRef(false);

  useEffect(() => {
    liveBoardRef.current = board;
  }, [board]);

  // 1. Load Daily Grid
  const loadDailyGrid = useCallback(() => {
    setLoading(true);
    setToastMessage(null);
    setSelectedCell(null);
    setHistory([]);
    setIsPractice(false);
    setPracticeToken(null);

    api.get(`/queens/grid?date=${todayStr}`)
      .then((res) => {
        setGridData(res.grid);
        setUserState(res.user_state);

        const savedState = res.user_state?.grid_state || '.'.repeat(64);
        setBoard(savedState);
        setTimerSeconds(res.user_state?.time_spent_seconds || 0);

        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load Queens grid:', err);
        setToastMessage(err.message || 'Impossible de charger la grille.');
        setToastType('error');
        setLoading(false);
      });
  }, [todayStr]);

  // Load Random Practice Grid
  const loadPracticeGrid = useCallback(() => {
    setLoading(true);
    setToastMessage(null);
    setSelectedCell(null);
    setHistory([]);
    setIsPractice(true);
    setShowVictoryModal(false);

    api.get('/queens/practice')
      .then((res) => {
        setGridData(res.grid);
        setPracticeToken(res.practice_token);
        setUserState({ status: 'in_progress', coins_awarded: 0, score_awarded: 0 });

        setBoard('.'.repeat(64));
        setTimerSeconds(0);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load practice Queens:', err);
        setToastMessage(err.message || "Impossible de charger l'entraînement.");
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

  // 3. Auto-save (only for daily grid)
  const triggerAutoSave = useCallback((currentBoard, currentTime) => {
    if (isPractice || userState?.status === 'completed') return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      api.post('/queens/save', {
        date: todayStr,
        grid_state: currentBoard,
        time_spent: currentTime
      }).catch((err) => {
        console.warn('Queens auto-save silent error:', err);
      });
    }, 1000);
  }, [todayStr, isPractice, userState?.status]);

  // 4. Queens placed count
  const queensCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 64; i++) {
      if (board[i] === 'Q') count++;
    }
    return count;
  }, [board]);

  // 5. Conflict detection (real-time visual feedback)
  const conflictCells = useMemo(() => {
    if (!gridData?.regions) return new Set();
    const size = 8;
    const conflicts = new Set();
    const queens = [];

    for (let i = 0; i < 64; i++) {
      if (board[i] === 'Q') {
        const r = Math.floor(i / size);
        const c = i % size;
        const reg = gridData.regions[i];
        queens.push({ idx: i, r, c, reg });
      }
    }

    for (let i = 0; i < queens.length; i++) {
      for (let j = i + 1; j < queens.length; j++) {
        const q1 = queens[i];
        const q2 = queens[j];

        const sameRow = q1.r === q2.r;
        const sameCol = q1.c === q2.c;
        const sameReg = q1.reg === q2.reg;
        const dr = Math.abs(q1.r - q2.r);
        const dc = Math.abs(q1.c - q2.c);
        const touch = dr <= 1 && dc <= 1;

        if (sameRow || sameCol || sameReg || touch) {
          conflicts.add(q1.idx);
          conflicts.add(q2.idx);
        }
      }
    }

    return conflicts;
  }, [board, gridData]);

  // 6. Drag-to-place-crosses interaction
  const getCellFromEvent = useCallback((e) => {
    if (!gridWrapperRef.current) return null;
    const rect = gridWrapperRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    if (
      e.clientX < rect.left - 40 ||
      e.clientX > rect.right + 40 ||
      e.clientY < rect.top - 40 ||
      e.clientY > rect.bottom + 40
    ) {
      return null;
    }

    const clampedX = Math.max(0, Math.min(rect.width - 1, e.clientX - rect.left));
    const clampedY = Math.max(0, Math.min(rect.height - 1, e.clientY - rect.top));

    const col = Math.floor((clampedX / rect.width) * 8);
    const row = Math.floor((clampedY / rect.height) * 8);
    const c = Math.max(0, Math.min(7, col));
    const r = Math.max(0, Math.min(7, row));
    return r * 8 + c;
  }, []);

  const getLineCells = useCallback((idx1, idx2) => {
    if (idx1 === idx2) return [idx1];
    const r1 = Math.floor(idx1 / 8);
    const c1 = idx1 % 8;
    const r2 = Math.floor(idx2 / 8);
    const c2 = idx2 % 8;

    const dr = Math.abs(r2 - r1);
    const dc = Math.abs(c2 - c1);
    const steps = Math.max(dr, dc);
    const cells = [];

    for (let s = 0; s <= steps; s++) {
      const r = Math.round(r1 + (r2 - r1) * (s / steps));
      const c = Math.round(c1 + (c2 - c1) * (s / steps));
      cells.push(r * 8 + c);
    }
    return cells;
  }, []);

  const applyDragToCells = useCallback((cellIndices, mode) => {
    let currentBoard = liveBoardRef.current;
    let modified = false;

    cellIndices.forEach((cIdx) => {
      const char = currentBoard[cIdx] || '.';
      if (mode === 'cross') {
        if (char === '.') {
          currentBoard = currentBoard.substring(0, cIdx) + 'X' + currentBoard.substring(cIdx + 1);
          modified = true;
        }
      } else if (mode === 'erase') {
        if (char === 'X') {
          currentBoard = currentBoard.substring(0, cIdx) + '.' + currentBoard.substring(cIdx + 1);
          modified = true;
        }
      }
    });

    if (modified) {
      liveBoardRef.current = currentBoard;
      setBoard(currentBoard);
    }
  }, []);

  const handlePointerDown = (e) => {
    if (userState?.status === 'completed') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const cellIdx = getCellFromEvent(e);
    if (cellIdx === null) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      // Ignore
    }

    const curChar = liveBoardRef.current[cellIdx] || '.';
    const mode = curChar === 'X' ? 'erase' : 'cross';

    dragStateRef.current = {
      isDown: true,
      hasMoved: false,
      startCell: cellIdx,
      lastCell: cellIdx,
      mode,
      initialBoard: liveBoardRef.current,
    };
    wasDraggingRef.current = false;
    setSelectedCell(cellIdx);
  };

  const handlePointerMove = (e) => {
    if (!dragStateRef.current.isDown || userState?.status === 'completed') return;

    const currentCell = getCellFromEvent(e);
    if (currentCell === null) return;

    if (!dragStateRef.current.hasMoved) {
      if (currentCell !== dragStateRef.current.startCell) {
        dragStateRef.current.hasMoved = true;
        wasDraggingRef.current = true;
        applyDragToCells([dragStateRef.current.startCell], dragStateRef.current.mode);
      }
    }

    if (dragStateRef.current.hasMoved) {
      setSelectedCell(currentCell);
      const lineCells = getLineCells(dragStateRef.current.lastCell, currentCell);
      applyDragToCells(lineCells, dragStateRef.current.mode);
      dragStateRef.current.lastCell = currentCell;
    }
  };

  const handlePointerUp = (e) => {
    if (!dragStateRef.current.isDown) return;

    try {
      if (e?.currentTarget?.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (err) {
      // Ignore
    }

    const { hasMoved, initialBoard } = dragStateRef.current;
    dragStateRef.current.isDown = false;

    if (hasMoved) {
      if (liveBoardRef.current !== initialBoard) {
        setHistory((prev) => [...prev, initialBoard]);
        triggerAutoSave(liveBoardRef.current, timerSeconds);
      }
    }

    dragStateRef.current = {
      isDown: false,
      hasMoved: false,
      startCell: null,
      lastCell: null,
      mode: null,
      initialBoard: null,
    };
  };

  // 7. Cell click interaction
  const handleCellClick = (idx, e) => {
    if (userState?.status === 'completed') return;
    setSelectedCell(idx);

    const currentChar = board[idx] || '.';
    let nextChar = currentChar;

    if (inputMode === 'queen') {
      nextChar = currentChar === 'Q' ? '.' : 'Q';
    } else if (inputMode === 'cross') {
      nextChar = currentChar === 'X' ? '.' : 'X';
    } else {
      // Default cycle: Empty ('.') -> Cross ('X') -> Queen ('Q') -> Empty ('.')
      if (currentChar === '.') nextChar = 'X';
      else if (currentChar === 'X') nextChar = 'Q';
      else nextChar = '.';
    }

    if (nextChar !== currentChar) {
      setHistory((prev) => [...prev, board]);
      const nextBoard = board.substring(0, idx) + nextChar + board.substring(idx + 1);
      setBoard(nextBoard);
      triggerAutoSave(nextBoard, timerSeconds);
    }
  };

  // Right click toggles Queen directly
  const handleCellContextMenu = (idx, e) => {
    e.preventDefault();
    if (userState?.status === 'completed') return;
    setSelectedCell(idx);

    const currentChar = board[idx] || '.';
    const nextChar = currentChar === 'Q' ? '.' : 'Q';

    setHistory((prev) => [...prev, board]);
    const nextBoard = board.substring(0, idx) + nextChar + board.substring(idx + 1);
    setBoard(nextBoard);
    triggerAutoSave(nextBoard, timerSeconds);
  };

  // 7. Undo
  const handleUndo = useCallback(() => {
    if (history.length === 0 || userState?.status === 'completed') return;
    const last = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setBoard(last);
    triggerAutoSave(last, timerSeconds);
  }, [history, userState, timerSeconds, triggerAutoSave]);

  // 8. Clear all user marks
  const handleResetBoard = () => {
    if (userState?.status === 'completed') return;
    if (board === '.'.repeat(64)) return;
    setHistory((prev) => [...prev, board]);
    const cleared = '.'.repeat(64);
    setBoard(cleared);
    triggerAutoSave(cleared, timerSeconds);
  };

  // 9. Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showVictoryModal || showArchiveModal) return;

      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'q' || e.key === 'Q' || e.key === ' ') {
        e.preventDefault();
        if (selectedCell !== null) {
          handleCellContextMenu(selectedCell, e);
        }
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        if (selectedCell !== null) {
          const cur = board[selectedCell];
          const nextChar = cur === 'X' ? '.' : 'X';
          setHistory((prev) => [...prev, board]);
          const nextBoard = board.substring(0, selectedCell) + nextChar + board.substring(selectedCell + 1);
          setBoard(nextBoard);
          triggerAutoSave(nextBoard, timerSeconds);
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        if (selectedCell !== null) {
          setHistory((prev) => [...prev, board]);
          const nextBoard = board.substring(0, selectedCell) + '.' + board.substring(selectedCell + 1);
          setBoard(nextBoard);
          triggerAutoSave(nextBoard, timerSeconds);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedCell((prev) => (prev === null ? 0 : (prev % 8 === 7 ? prev : prev + 1)));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedCell((prev) => (prev === null ? 0 : (prev % 8 === 0 ? prev : prev - 1)));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCell((prev) => (prev === null ? 0 : (prev >= 56 ? prev : prev + 8)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCell((prev) => (prev === null ? 0 : (prev < 8 ? prev : prev - 8)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showVictoryModal, selectedCell, board, timerSeconds, handleUndo, triggerAutoSave]);

  // 10. Validate solution
  const handleValidateGrid = () => {
    setValidating(true);
    setToastMessage(null);

    const payload = isPractice
      ? { practice_token: practiceToken, grid_state: board, time_spent: timerSeconds }
      : { date: todayStr, grid_state: board, time_spent: timerSeconds };

    api.post('/queens/validate', payload)
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
          setToastMessage(res.message || "La solution n'est pas valide.");
          setToastType('error');
        }
      })
      .catch((err) => {
        setValidating(false);
        console.error('Queens validation error:', err);
        setToastMessage(err.message || 'Erreur lors de la validation.');
        setToastType('error');
      });
  };

  // 11. Share score
  const handleShare = () => {
    const timeFormatted = formatTime(timerSeconds);
    const modeTitle = isPractice ? "Queens • Entraînement" : `Queens du ${formatShortDateFrench(todayStr)}`;
    const shareText = `👑 Omnia — ${modeTitle}\n⏱️ Temps : ${timeFormatted}\n🎯 8/8 Reines sans contact !\nJouez sur ${window.location.origin}/solo/queens`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText).then(() => {
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2500);
      });
    }
  };

  // 12. Cell Region Border Classes
  const getCellBorderClasses = (r, c) => {
    if (!gridData?.regions) return '';
    const size = 8;
    const curReg = gridData.regions[r * size + c];
    const classes = [];

    // Top
    if (r === 0 || gridData.regions[(r - 1) * size + c] !== curReg) {
      classes.push('border-top-diff');
    } else {
      classes.push('border-top-same');
    }

    // Bottom
    if (r === size - 1 || gridData.regions[(r + 1) * size + c] !== curReg) {
      classes.push('border-bottom-diff');
    } else {
      classes.push('border-bottom-same');
    }

    // Left
    if (c === 0 || gridData.regions[r * size + (c - 1)] !== curReg) {
      classes.push('border-left-diff');
    } else {
      classes.push('border-left-same');
    }

    // Right
    if (c === size - 1 || gridData.regions[r * size + (c + 1)] !== curReg) {
      classes.push('border-right-diff');
    } else {
      classes.push('border-right-same');
    }

    return classes.join(' ');
  };

  return (
    <div className="queens-page">
      {/* 1. Header */}
      <header className="queens-top-header">
        <div className="queens-header-left">
          <h1 className="queens-main-title">
            <button className="queens-tool-btn" onClick={onBack} title="Retour">
              <ArrowLeft size={18} />
            </button>
            <Crown size={26} className="queens-crown-icon" />
            {isPractice ? "Queens • Entraînement Libre" : "Queens du Jour"}
          </h1>
          <p className="queens-sub-title">
            {isPractice
              ? "Grille aléatoire illimitée · +10 pièces · +8 XP"
              : `${formatDateFrench(todayStr)} · Grille #${gridData?.grid_number || 1} · +60 pièces · +25 XP`}
          </p>
        </div>

        {isPractice ? (
          <button
            className="queens-all-grids-btn"
            onClick={loadDailyGrid}
            style={{ background: 'rgba(234, 179, 8, 0.15)', borderColor: '#eab308', color: '#fef08a' }}
          >
            <Calendar size={16} /> Grille Quotidienne
          </button>
        ) : (
          <button className="queens-all-grids-btn" onClick={loadPracticeGrid}>
            <Dumbbell size={16} /> Mode Entraînement (Illimité)
          </button>
        )}
      </header>

      {/* 2. Control Toolbar */}
      <div className="queens-toolbar">
        {/* Left: Timer & Reset (practice only) */}
        <div className="queens-toolbar-group">
          <div className="queens-tool-timer">
            <Clock size={16} />
            <span>{formatTime(timerSeconds)}</span>
          </div>

          {isPractice && (
            <button
              type="button"
              onClick={handleResetBoard}
              disabled={board === '.'.repeat(64) || userState?.status === 'completed'}
              className="queens-tool-btn"
              title="Réinitialiser la grille"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>

        {/* Right: Practice New Grid & Validate */}
        <div className="queens-toolbar-group">
          {isPractice && (
            <button
              type="button"
              onClick={loadPracticeGrid}
              className="queens-nav-btn"
              title="Générer une autre grille d'entraînement"
              style={{ padding: '6px 12px' }}
            >
              <RotateCcw size={15} />
              <span>Autre grille</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleValidateGrid}
            disabled={validating || userState?.status === 'completed'}
            className="btn btn--primary"
            style={{ padding: '7px 18px', fontSize: '0.88rem' }}
          >
            <Check size={16} />
            <span>{validating ? 'Vérification…' : userState?.status === 'completed' ? 'Complété' : 'Valider'}</span>
          </button>
        </div>
      </div>

      {/* 3. Board Card */}
      <div className="queens-board-card">
        <div className="queens-board-meta">
          <div className="queens-counter">
            <span>Reines :</span>
            <span className={`queens-counter-pill ${queensCount === 8 ? 'is-complete' : ''}`}>
              {queensCount} / 8
            </span>
          </div>

          <span className="queens-rules-hint">
            1 reine par ligne, colonne et zone · Sans contact
          </span>
        </div>

        {/* 4. 8x8 Grid */}
        <div
          ref={gridWrapperRef}
          className="queens-grid-wrapper"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {Array.from({ length: 64 }).map((_, idx) => {
            const r = Math.floor(idx / 8);
            const c = idx % 8;
            const regionId = gridData?.regions ? gridData.regions[idx] : 0;
            const char = board[idx] || '.';
            const isSelected = selectedCell === idx;
            const hasConflict = conflictCells.has(idx);
            const borderClasses = getCellBorderClasses(r, c);

            return (
              <div
                key={idx}
                className={`queens-cell reg-${regionId} ${borderClasses} ${isSelected ? 'is-selected' : ''} ${hasConflict ? 'has-conflict' : ''}`}
                onClick={(e) => {
                  if (wasDraggingRef.current) {
                    wasDraggingRef.current = false;
                    return;
                  }
                  handleCellClick(idx, e);
                }}
                onContextMenu={(e) => handleCellContextMenu(idx, e)}
              >
                {char === 'Q' && (
                  <Crown size={28} className="queens-piece-crown" />
                )}
                {char === 'X' && (
                  <span className="queens-piece-cross">✕</span>
                )}
              </div>
            );
          })}
        </div>

        {/* 5. Quick Actions Bar */}
        <div className="queens-actions-bar">
          <div className="queens-mode-toggle">
            <button
              className={`queens-mode-btn ${inputMode === 'cycle' ? 'is-active' : ''}`}
              onClick={() => setInputMode('cycle')}
              title="Cycle automatique : Croix -> Reine -> Vide"
            >
              Auto
            </button>
            <button
              className={`queens-mode-btn queen-mode ${inputMode === 'queen' ? 'is-active' : ''}`}
              onClick={() => setInputMode('queen')}
              title="Poser directement une reine"
            >
              <Crown size={15} /> Reine
            </button>
            <button
              className={`queens-mode-btn ${inputMode === 'cross' ? 'is-active' : ''}`}
              onClick={() => setInputMode('cross')}
              title="Poser directement une croix"
            >
              <X size={15} /> Croix
            </button>
          </div>

          <div className="queens-toolbar-group">
            <button
              className="queens-action-btn"
              onClick={handleUndo}
              disabled={history.length === 0 || userState?.status === 'completed'}
              title="Annuler (Ctrl+Z)"
            >
              <Undo2 size={15} /> Annuler
            </button>

            {isPractice && (
              <button
                className="queens-action-btn"
                onClick={handleResetBoard}
                disabled={board === '.'.repeat(64) || userState?.status === 'completed'}
                title="Tout effacer"
              >
                <Eraser size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className={`queens-toast queens-toast--${toastType}`}>
            {toastType === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      {/* 6. Victory Modal */}
      {showVictoryModal && (
        <div className="queens-modal-backdrop" onClick={() => setShowVictoryModal(false)}>
          <div className="queens-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="queens-victory-crown">
              <Crown size={38} />
            </div>

            <h2 className="queens-modal-title">
              {isPractice ? "Entraînement Réussi !" : "Victoire Royale !"}
            </h2>
            <p className="queens-modal-desc">
              {isPractice
                ? "Tu as couronné le royaume sans aucun conflit !"
                : `Grille quotidienne du ${formatShortDateFrench(todayStr)} résolue sans faute !`}
            </p>

            <div className="queens-stats-row">
              <div className="queens-stat-box">
                <span className="queens-stat-val">{formatTime(timerSeconds)}</span>
                <span className="queens-stat-lbl">Temps</span>
              </div>
              <div className="queens-stat-box">
                <span className="queens-stat-val">+{userState?.score_awarded || (isPractice ? 8 : 25)}</span>
                <span className="queens-stat-lbl">XP</span>
              </div>
              <div className="queens-stat-box">
                <span className="queens-stat-val">+{userState?.coins_awarded || (isPractice ? 10 : 60)}</span>
                <span className="queens-stat-lbl">Pièces</span>
              </div>
            </div>

            <div className="queens-modal-btns" style={{ flexWrap: 'wrap' }}>
              <button
                className="queens-modal-btn queens-modal-btn--primary"
                onClick={loadPracticeGrid}
                style={{ gap: 8 }}
              >
                <Dumbbell size={16} />
                <span>{isPractice ? "Autre grille" : "Enchaîner en entraînement"}</span>
              </button>

              <button className="queens-modal-btn queens-modal-btn--secondary" onClick={handleShare}>
                <Share2 size={16} />
                {copiedShare ? 'Copié !' : 'Partager'}
              </button>

              <button className="queens-modal-btn queens-modal-btn--secondary" onClick={() => setShowVictoryModal(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
