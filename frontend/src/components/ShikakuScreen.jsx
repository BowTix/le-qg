import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Boxes,
  RotateCcw,
  Undo2,
  Share2,
  Trophy,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Eraser,
  X,
  Dumbbell,
  Check
} from 'lucide-react';
import { api } from '../utils/api';
import '../shikaku.css';

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

export default function ShikakuScreen({ onBack, onUpdateUserStats }) {
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

  // Placed rectangles: array of { id, r, c, w, h }
  const [rectangles, setRectangles] = useState([]);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Interaction: Drag & click
  const [anchorCell, setAnchorCell] = useState(null); // { r, c }
  const [hoverCell, setHoverCell] = useState(null);   // { r, c }
  const [isPointerDown, setIsPointerDown] = useState(false);

  // Undo history: stack of rectangles arrays
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
  const gridContainerRef = useRef(null);

  // 1. Load Daily Grid
  const loadDailyGrid = useCallback(() => {
    setLoading(true);
    setToastMessage(null);
    setAnchorCell(null);
    setHoverCell(null);
    setHistory([]);
    setIsPractice(false);
    setPracticeToken(null);

    api.get(`/shikaku/grid?date=${todayStr}`)
      .then((res) => {
        setGridData(res.grid);
        setUserState(res.user_state);

        const savedRects = res.user_state?.rectangles_state || [];
        setRectangles(savedRects);
        setTimerSeconds(res.user_state?.time_spent_seconds || 0);

        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load Shikaku grid:', err);
        setToastMessage(err.message || 'Impossible de charger la grille.');
        setToastType('error');
        setLoading(false);
      });
  }, [todayStr]);

  // Load Random Practice Grid
  const loadPracticeGrid = useCallback(() => {
    setLoading(true);
    setToastMessage(null);
    setAnchorCell(null);
    setHoverCell(null);
    setHistory([]);
    setIsPractice(true);
    setShowVictoryModal(false);

    api.get('/shikaku/practice')
      .then((res) => {
        setGridData(res.grid);
        setPracticeToken(res.practice_token);
        setUserState({ status: 'in_progress', coins_awarded: 0, score_awarded: 0 });

        setRectangles([]);
        setTimerSeconds(0);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load practice Shikaku:', err);
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
  const triggerAutoSave = useCallback((currentRects, currentTime) => {
    if (isPractice || userState?.status === 'completed') return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      api.post('/shikaku/save', {
        date: todayStr,
        rectangles_state: currentRects,
        time_spent: currentTime
      }).catch((err) => {
        console.warn('Shikaku auto-save silent error:', err);
      });
    }, 1000);
  }, [todayStr, isPractice, userState?.status]);

  // 4. Clue map & coverage calculation
  const clueMap = useMemo(() => {
    const map = {};
    if (!gridData?.clues) return map;
    gridData.clues.forEach((clue) => {
      map[`${clue.r}_${clue.c}`] = clue.val;
    });
    return map;
  }, [gridData]);

  // Real-time evaluation of rectangles and covered cells
  const { coveredCount, rectStatuses, clueStatuses } = useMemo(() => {
    const w = gridData?.grid_width || 12;
    const h = gridData?.grid_height || 12;
    const cellCover = {};
    const rStatuses = [];
    const cStatuses = {};

    rectangles.forEach((rect, idx) => {
      const { r, c, w: rw, h: rh } = rect;
      const area = rw * rh;
      const cluesInside = [];

      for (let dr = 0; dr < rh; dr++) {
        for (let dc = 0; dc < rw; dc++) {
          const key = `${r + dr}_${c + dc}`;
          cellCover[key] = (cellCover[key] || 0) + 1;
          if (clueMap[key] !== undefined) {
            cluesInside.push({ r: r + dr, c: c + dc, val: clueMap[key] });
          }
        }
      }

      const isValid = cluesInside.length === 1 && cluesInside[0].val === area;
      rStatuses.push({ isValid, clue: cluesInside[0] || null });

      if (cluesInside.length === 1) {
        const cKey = `${cluesInside[0].r}_${cluesInside[0].c}`;
        cStatuses[cKey] = isValid ? 'satisfied' : 'error';
      } else if (cluesInside.length > 1) {
        cluesInside.forEach((ci) => {
          cStatuses[`${ci.r}_${ci.c}`] = 'error';
        });
      }
    });

    const covered = Object.keys(cellCover).length;
    return { coveredCount: covered, rectStatuses: rStatuses, clueStatuses: cStatuses };
  }, [rectangles, clueMap, gridData]);

  // 5. Drag & Tap Rectangle Handling
  const getCellFromEvent = (e) => {
    if (!gridContainerRef.current) return null;
    const rect = gridContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

    const w = gridData?.grid_width || 12;
    const h = gridData?.grid_height || 12;

    const c = Math.floor((x / rect.width) * w);
    const r = Math.floor((y / rect.height) * h);
    return { r: Math.max(0, Math.min(h - 1, r)), c: Math.max(0, Math.min(w - 1, c)) };
  };

  const handlePointerDown = (r, c, e) => {
    if (userState?.status === 'completed') return;
    setIsPointerDown(true);

    if (!anchorCell) {
      setAnchorCell({ r, c });
      setHoverCell({ r, c });
    } else {
      // Complete rectangle from anchorCell to this cell
      createRectangle(anchorCell, { r, c });
      setAnchorCell(null);
      setHoverCell(null);
      setIsPointerDown(false);
    }
  };

  const handlePointerMove = (e) => {
    if (!isPointerDown || !anchorCell) return;
    const cell = getCellFromEvent(e);
    if (cell) {
      setHoverCell(cell);
    }
  };

  const handlePointerUp = (e) => {
    if (!isPointerDown) return;
    setIsPointerDown(false);

    if (anchorCell && hoverCell && (anchorCell.r !== hoverCell.r || anchorCell.c !== hoverCell.c)) {
      createRectangle(anchorCell, hoverCell);
      setAnchorCell(null);
      setHoverCell(null);
    }
  };

  const createRectangle = (p1, p2) => {
    const minR = Math.min(p1.r, p2.r);
    const maxR = Math.max(p1.r, p2.r);
    const minC = Math.min(p1.c, p2.c);
    const maxC = Math.max(p1.c, p2.c);
    const w = maxC - minC + 1;
    const h = maxR - minR + 1;

    // Remove any rectangles that are completely covered by or identical to this one
    setHistory((prev) => [...prev, rectangles]);
    const filtered = rectangles.filter((rect) => !(rect.r === minR && rect.c === minC && rect.w === w && rect.h === h));
    const nextRects = [...filtered, { id: Date.now() + Math.random(), r: minR, c: minC, w, h }];

    setRectangles(nextRects);
    triggerAutoSave(nextRects, timerSeconds);
  };

  // Click on a rectangle to delete it
  const handleDeleteRect = (index, e) => {
    e.stopPropagation();
    if (userState?.status === 'completed') return;

    setHistory((prev) => [...prev, rectangles]);
    const nextRects = rectangles.filter((_, i) => i !== index);
    setRectangles(nextRects);
    triggerAutoSave(nextRects, timerSeconds);
  };

  // 6. Undo
  const handleUndo = useCallback(() => {
    if (history.length === 0 || userState?.status === 'completed') return;
    const last = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setRectangles(last);
    triggerAutoSave(last, timerSeconds);
  }, [history, userState, timerSeconds, triggerAutoSave]);

  // 7. Clear All
  const handleClearAll = () => {
    if (rectangles.length === 0 || userState?.status === 'completed') return;
    setHistory((prev) => [...prev, rectangles]);
    setRectangles([]);
    if (!isPractice) {
      triggerAutoSave([], timerSeconds);
    }
  };

  // 8. Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showVictoryModal) return;

      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'Escape') {
        setAnchorCell(null);
        setHoverCell(null);
        setIsPointerDown(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showVictoryModal, handleUndo]);

  // 9. Validate solution
  const handleValidateGrid = () => {
    setValidating(true);
    setToastMessage(null);

    const payload = isPractice
      ? { practice_token: practiceToken, rectangles_state: rectangles, time_spent: timerSeconds }
      : { date: todayStr, rectangles_state: rectangles, time_spent: timerSeconds };

    api.post('/shikaku/validate', payload)
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
          setToastMessage(res.message || "Le découpage n'est pas correct.");
          setToastType('error');
        }
      })
      .catch((err) => {
        setValidating(false);
        console.error('Shikaku validation error:', err);
        setToastMessage(err.message || 'Erreur lors de la validation.');
        setToastType('error');
      });
  };

  // 10. Share score
  const handleShare = () => {
    const timeFormatted = formatTime(timerSeconds);
    const totalRects = gridData?.clues?.length || rectangles.length;
    const modeTitle = isPractice ? "Shikaku • Entraînement" : `Shikaku du ${formatShortDateFrench(todayStr)}`;
    const shareText = `🔲 Omnia — ${modeTitle}\n⏱️ Temps : ${timeFormatted}\n🎯 ${totalRects} rectangles parfaits !\nJouez sur ${window.location.origin}/solo/shikaku`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText).then(() => {
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2500);
      });
    }
  };

  // Preview dimensions for dragging
  const dragPreview = useMemo(() => {
    if (!anchorCell || !hoverCell) return null;
    const minR = Math.min(anchorCell.r, hoverCell.r);
    const maxR = Math.max(anchorCell.r, hoverCell.r);
    const minC = Math.min(anchorCell.c, hoverCell.c);
    const maxC = Math.max(anchorCell.c, hoverCell.c);
    const w = maxC - minC + 1;
    const h = maxR - minR + 1;
    return { r: minR, c: minC, w, h, area: w * h };
  }, [anchorCell, hoverCell]);

  return (
    <div
      className="shikaku-page"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* 1. Header */}
      <header className="shikaku-top-header">
        <div className="shikaku-header-left">
          <h1 className="shikaku-main-title">
            <button className="shikaku-tool-btn" onClick={onBack} title="Retour">
              <ArrowLeft size={18} />
            </button>
            <Boxes size={26} className="shikaku-boxes-icon" />
            {isPractice ? "Shikaku • Entraînement Libre" : "Shikaku du Jour"}
          </h1>
          <p className="shikaku-sub-title">
            {isPractice
              ? "Grille aléatoire illimitée · +10 pièces · +8 XP"
              : `${formatDateFrench(todayStr)} · Grille #${gridData?.grid_number || 1} · +60 pièces · +25 XP`}
          </p>
        </div>

        {isPractice ? (
          <button
            className="shikaku-all-grids-btn"
            onClick={loadDailyGrid}
            style={{ background: 'rgba(234, 179, 8, 0.15)', borderColor: '#eab308', color: '#fef08a' }}
          >
            <Calendar size={16} /> Grille Quotidienne
          </button>
        ) : (
          <button className="shikaku-all-grids-btn" onClick={loadPracticeGrid}>
            <Dumbbell size={16} /> Mode Entraînement (Illimité)
          </button>
        )}
      </header>

      {/* 2. Control Toolbar */}
      <div className="shikaku-toolbar">
        {/* Left: Timer & Reset (practice only) */}
        <div className="shikaku-toolbar-group">
          <div className="shikaku-tool-timer">
            <Clock size={16} />
            <span>{formatTime(timerSeconds)}</span>
          </div>

          {isPractice && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={rectangles.length === 0 || userState?.status === 'completed'}
              className="shikaku-tool-btn"
              title="Réinitialiser la grille"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>

        {/* Right: Practice New Grid & Validate */}
        <div className="shikaku-toolbar-group">
          {isPractice && (
            <button
              type="button"
              onClick={loadPracticeGrid}
              className="shikaku-nav-btn"
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
      <div className="shikaku-board-card">
        <div className="shikaku-board-meta">
          <div className="shikaku-counter-group">
            <span className={`shikaku-pill ${coveredCount === ((gridData?.grid_width || 12) * (gridData?.grid_height || 12)) ? 'is-complete' : ''}`}>
              Couverture : {coveredCount} / {(gridData?.grid_width || 12) * (gridData?.grid_height || 12)}
            </span>
            <span className="shikaku-pill">
              Rectangles : {rectangles.length} / {gridData?.clues?.length || 0}
            </span>
          </div>

          <span className="shikaku-rules-hint">
            Glisse ou clique 2 coins pour tracer · Clic sur un rectangle pour l’effacer
          </span>
        </div>

        {/* 4. The Grid Container */}
        {(() => {
          const gridW = gridData?.grid_width || 12;
          const gridH = gridData?.grid_height || 12;
          const totalCells = gridW * gridH;

          return (
            <div
              className="shikaku-grid-container"
              ref={gridContainerRef}
              style={{
                gridTemplateColumns: `repeat(${gridW}, 1fr)`,
                gridTemplateRows: `repeat(${gridH}, 1fr)`
              }}
            >
              {/* Base Grid Cells */}
              {Array.from({ length: totalCells }).map((_, idx) => {
                const r = Math.floor(idx / gridW);
                const c = idx % gridW;
                const clueVal = clueMap[`${r}_${c}`];
                const isAnchor = anchorCell && anchorCell.r === r && anchorCell.c === c;
                const clueStatus = clueStatuses[`${r}_${c}`];

                return (
                  <div
                    key={idx}
                    className={`shikaku-cell ${isAnchor ? 'is-anchor' : ''}`}
                    onPointerDown={(e) => handlePointerDown(r, c, e)}
                  >
                    {clueVal !== undefined && (
                      <span className={`shikaku-clue-badge ${clueStatus === 'satisfied' ? 'is-satisfied' : clueStatus === 'error' ? 'is-error' : ''}`}>
                        {clueVal}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Placed Rectangles Overlay */}
              {rectangles.map((rect, idx) => {
                const status = rectStatuses[idx];
                const isInvalid = status && !status.isValid;
                const colorClass = `shikaku-rect-color-${idx % 8}`;

                return (
                  <div
                    key={rect.id || idx}
                    className={`shikaku-rect-overlay ${colorClass} ${isInvalid ? 'is-invalid' : ''}`}
                    style={{
                      top: `${(rect.r / gridH) * 100}%`,
                      left: `${(rect.c / gridW) * 100}%`,
                      width: `${(rect.w / gridW) * 100}%`,
                      height: `${(rect.h / gridH) * 100}%`
                    }}
                    onClick={(e) => handleDeleteRect(idx, e)}
                    title="Cliquer pour supprimer ce rectangle"
                  />
                );
              })}

              {/* Active Drag Preview */}
              {dragPreview && (
                <div
                  className="shikaku-drag-preview"
                  style={{
                    top: `${(dragPreview.r / gridH) * 100}%`,
                    left: `${(dragPreview.c / gridW) * 100}%`,
                    width: `${(dragPreview.w / gridW) * 100}%`,
                    height: `${(dragPreview.h / gridH) * 100}%`
                  }}
                >
                  <span className="shikaku-drag-badge">
                    {dragPreview.w}×{dragPreview.h} = {dragPreview.area}
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {/* 5. Action Bar */}
        <div className="shikaku-actions-bar">
          <button
            className="shikaku-action-btn"
            onClick={handleUndo}
            disabled={history.length === 0 || userState?.status === 'completed'}
            title="Annuler (Ctrl+Z)"
          >
            <Undo2 size={15} /> Annuler
          </button>

          {isPractice && (
            <button
              className="shikaku-action-btn"
              onClick={handleClearAll}
              disabled={rectangles.length === 0 || userState?.status === 'completed'}
              title="Tout effacer"
            >
              <Eraser size={15} /> Tout effacer
            </button>
          )}
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className={`shikaku-toast shikaku-toast--${toastType}`}>
            {toastType === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      {/* 6. Victory Modal */}
      {showVictoryModal && (
        <div className="shikaku-modal-backdrop" onClick={() => setShowVictoryModal(false)}>
          <div className="shikaku-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="shikaku-victory-icon">
              <Boxes size={38} />
            </div>

            <h2 className="shikaku-modal-title">
              {isPractice ? "Entraînement Réussi !" : "Découpage Parfait !"}
            </h2>
            <p className="shikaku-modal-desc">
              {isPractice
                ? "Tous les rectangles sont ajustés sans aucune erreur !"
                : `Grille quotidienne du ${formatShortDateFrench(todayStr)} résolue sans aucune erreur !`}
            </p>

            <div className="shikaku-stats-row">
              <div className="shikaku-stat-box">
                <span className="shikaku-stat-val">{formatTime(timerSeconds)}</span>
                <span className="shikaku-stat-lbl">Temps</span>
              </div>
              <div className="shikaku-stat-box">
                <span className="shikaku-stat-val">+{userState?.score_awarded || (isPractice ? 8 : 25)}</span>
                <span className="shikaku-stat-lbl">XP</span>
              </div>
              <div className="shikaku-stat-box">
                <span className="shikaku-stat-val">+{userState?.coins_awarded || (isPractice ? 10 : 60)}</span>
                <span className="shikaku-stat-lbl">Pièces</span>
              </div>
            </div>

            <div className="shikaku-modal-btns" style={{ flexWrap: 'wrap' }}>
              <button
                className="shikaku-modal-btn shikaku-modal-btn--primary"
                onClick={loadPracticeGrid}
                style={{ gap: 8 }}
              >
                <Dumbbell size={16} />
                <span>{isPractice ? "Autre grille" : "Enchaîner en entraînement"}</span>
              </button>

              <button className="shikaku-modal-btn shikaku-modal-btn--secondary" onClick={handleShare}>
                <Share2 size={16} />
                {copiedShare ? 'Copié !' : 'Partager'}
              </button>

              <button className="shikaku-modal-btn shikaku-modal-btn--secondary" onClick={() => setShowVictoryModal(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
