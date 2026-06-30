import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { LogOut, Trophy, Play, Plus, Users, User, ShieldAlert, BookOpen, ChevronLeft, ChevronRight, Gamepad2, Globe, ArrowRight, Award, Zap, Skull, Calculator, Gavel } from 'lucide-react';
import { getLevel, getUsernameStyle, getLevelBadge, getLevelProgressDetails } from '../utils/progression';

export default function DashboardScreen({ user, onLogout, onStartSolo, onCreateLobby, onJoinLobby, onOpenAdmin, onOpenCreator, onOpenLeaderboard, onOpenProfile, onStartDailyQuiz }) {
  const [packs, setPacks] = useState([]);
  const [selectedPackSolo, setSelectedPackSolo] = useState('');
  const [selectedPackLobby, setSelectedPackLobby] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [createError, setCreateError] = useState('');
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

  // Redesign State
  const [mode, setMode] = useState('solo'); // 'solo' or 'online'
  const [gameMode, setGameMode] = useState('classic'); // 'classic' | 'speed_blitz' | 'sudden_death' | 'guess_number'
  const [activePackIndex, setActivePackIndex] = useState(0);
  const [animateClass, setAnimateClass] = useState('animate-fade-in');

  // Daily Quiz State
  const [dailyStatus, setDailyStatus] = useState({ scheduled: false, completed: false });

  useEffect(() => {
    fetchPacks();
    fetchDailyStatus();
  }, []);

  const fetchDailyStatus = async () => {
    try {
      const res = await api.get('/quiz/daily/status');
      if (res.success) {
        setDailyStatus(res);
      }
    } catch (err) {
      console.error("Failed to fetch daily quiz status", err);
    }
  };

  const fetchPacks = async () => {
    setLoadingPacks(true);
    try {
      const data = await api.get('/quiz/packs');
      setPacks(data);
      if (data.length > 0) {
        setSelectedPackSolo(data[0].id.toString());
        setSelectedPackLobby(data[0].id.toString());
        setActivePackIndex(0);
      }
    } catch (err) {
      console.error("Failed to fetch packs", err);
    } finally {
      setLoadingPacks(false);
    }
  };

  // Dynamic Filtering based on Mode
  // Solo mode shows all packs (including creator's own unvalidated packs)
  // Online mode shows ONLY validated packs
  const filteredPacks = mode === 'solo' 
    ? packs 
    : packs.filter(p => parseInt(p.is_validated) === 1);

  // Progression computations
  const lvl = getLevel(user.global_score);
  const badgeLabel = getLevelBadge(lvl);
  const nameStyle = getUsernameStyle(user.global_score);
  const { currentLevelXp, xpNeededForNextLevel } = getLevelProgressDetails(user.global_score);

  // Handle index boundaries and pack selections on mode/pack changes
  useEffect(() => {
    if (filteredPacks.length > 0) {
      const maxIndex = filteredPacks.length - 1;
      const newIndex = activePackIndex > maxIndex ? 0 : activePackIndex;
      setActivePackIndex(newIndex);
      
      const activePack = filteredPacks[newIndex];
      setSelectedPackSolo(activePack.id.toString());
      setSelectedPackLobby(activePack.id.toString());
    } else {
      setSelectedPackSolo('');
      setSelectedPackLobby('');
      setActivePackIndex(0);
    }
  }, [mode, packs]);

  // Lock logic for "Le Juste Nombre" theme when guess_number mode is active
  useEffect(() => {
    if (gameMode === 'guess_number' && filteredPacks.length > 0) {
      const targetIdx = filteredPacks.findIndex(p => 
        p.name.toLowerCase().includes("juste nombre") || 
        p.name.toLowerCase().includes("estimation") || 
        parseInt(p.id) === 3 || 
        parseInt(p.id) === 4
      );
      if (targetIdx !== -1) {
        setActivePackIndex(targetIdx);
        setSelectedPackSolo(filteredPacks[targetIdx].id.toString());
        setSelectedPackLobby(filteredPacks[targetIdx].id.toString());
        triggerAnimation();
      }
    }
    if (gameMode === 'tribunal' && filteredPacks.length > 0) {
      const targetIdx = filteredPacks.findIndex(p => 
        p.name.toLowerCase().includes("tribunal") || 
        parseInt(p.id) === 5
      );
      if (targetIdx !== -1) {
        setActivePackIndex(targetIdx);
        setSelectedPackSolo(filteredPacks[targetIdx].id.toString());
        setSelectedPackLobby(filteredPacks[targetIdx].id.toString());
        triggerAnimation();
      }
    }
  }, [gameMode, filteredPacks]);

  const triggerAnimation = () => {
    setAnimateClass('');
    setTimeout(() => {
      setAnimateClass('animate-fade-in');
    }, 20);
  };

  const handlePrevPack = () => {
    if (filteredPacks.length === 0 || gameMode === 'guess_number') return;
    const nextIdx = (activePackIndex - 1 + filteredPacks.length) % filteredPacks.length;
    setActivePackIndex(nextIdx);
    
    const activePack = filteredPacks[nextIdx];
    setSelectedPackSolo(activePack.id.toString());
    setSelectedPackLobby(activePack.id.toString());
    triggerAnimation();
  };

  const handleNextPack = () => {
    if (filteredPacks.length === 0 || gameMode === 'guess_number') return;
    const nextIdx = (activePackIndex + 1) % filteredPacks.length;
    setActivePackIndex(nextIdx);
    
    const activePack = filteredPacks[nextIdx];
    setSelectedPackSolo(activePack.id.toString());
    setSelectedPackLobby(activePack.id.toString());
    triggerAnimation();
  };

  const getPackBg = (pack) => {
    if (!pack) return '/images/default.png';
    const name = pack.name.toLowerCase();
    if (name.includes('geek') || name.includes('progr') || name.includes('code') || name.includes('tech')) {
      return '/images/tech.png';
    }
    if (name.includes('cult') || name.includes('géné') || name.includes('hist') || name.includes('géo') || name.includes('div') || name.includes('générale')) {
      return '/images/general.png';
    }
    return '/images/default.png';
  };

  const handleStartSolo = () => {
    if (selectedPackSolo) {
      onStartSolo(parseInt(selectedPackSolo), gameMode);
    }
  };

  const handleCreateLobby = async () => {
    if (!selectedPackLobby) return;
    setCreating(true);
    setCreateError('');
    try {
      const data = await api.post('/lobby/create', { 
        pack_id: parseInt(selectedPackLobby),
        game_mode: gameMode
      });
      if (data.success && data.room_code) {
        onCreateLobby(data.room_code);
      }
    } catch (err) {
      setCreateError(err.message || "Impossible de créer le salon.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinLobby = async (e) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 5) {
      setJoinError("Le code doit faire exactement 5 caractères.");
      return;
    }
    setJoining(true);
    setJoinError('');
    try {
      const data = await api.post('/lobby/join', { room_code: code });
      if (data.success) {
        onJoinLobby(code);
      }
    } catch (err) {
      setJoinError(err.message || "Impossible de rejoindre ce salon.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="container animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 📅 DAILY QUIZ PANEL */}
      {dailyStatus.scheduled && (
        <div 
          className="glass-card max-w-2xl w-full mx-auto" 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px', 
            padding: '24px 36px', 
            background: 'linear-gradient(135deg, rgba(255, 247, 0, 0.03) 0%, rgba(255, 255, 255, 0.02) 100%)',
            borderLeft: '4px solid var(--accent)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            marginBottom: '-8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>📅</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', margin: 0 }}>
                Le Quiz du Jour
              </h3>
            </div>
            
            {dailyStatus.completed ? (
              <span style={{ 
                backgroundColor: 'rgba(0, 255, 157, 0.1)', 
                color: 'var(--success)', 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                padding: '4px 10px', 
                borderRadius: '20px',
                border: '1px solid rgba(0, 255, 157, 0.2)'
              }}>
                Complété
              </span>
            ) : (
              <span style={{ 
                backgroundColor: 'rgba(255, 247, 0, 0.1)', 
                color: 'var(--accent)', 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                padding: '4px 10px', 
                borderRadius: '20px',
                border: '1px solid rgba(255, 247, 0, 0.2)'
              }}>
                Disponible
              </span>
            )}
          </div>

          {dailyStatus.completed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>Votre résultat aujourd'hui :</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)' }}>
                      {(() => {
                        const correctCount = [dailyStatus.attempt.q1_correct, dailyStatus.attempt.q2_correct, dailyStatus.attempt.q3_correct].filter(Boolean).length;
                        return `${correctCount}/3`;
                      })()}
                    </span>
                    <span style={{ fontSize: '1.2rem', letterSpacing: '2px' }}>
                      {dailyStatus.attempt.q1_correct ? '🟩' : '🟥'}
                      {dailyStatus.attempt.q2_correct ? '🟩' : '🟥'}
                      {dailyStatus.attempt.q3_correct ? '🟩' : '🟥'}
                    </span>
                  </div>
                </div>

                {/* Share Button */}
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    const correctCount = [dailyStatus.attempt.q1_correct, dailyStatus.attempt.q2_correct, dailyStatus.attempt.q3_correct].filter(Boolean).length;
                    const dateObj = new Date();
                    const d = String(dateObj.getDate()).padStart(2, '0');
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const shareText = `Le QG - Quiz du Jour #${d}-${m} 📅\n${dailyStatus.attempt.q1_correct ? '🟩' : '🟥'}${dailyStatus.attempt.q2_correct ? '🟩' : '🟥'}${dailyStatus.attempt.q3_correct ? '🟩' : '🟥'} (${correctCount}/3)\nJouez vous aussi sur : ${window.location.origin}`;
                    
                    navigator.clipboard.writeText(shareText);
                    alert("Résultats copiés dans le presse-papiers !");
                  }}
                  style={{ alignSelf: 'center', padding: '10px 20px', fontSize: '0.9rem' }}
                >
                  Partager mon résultat
                </button>
              </div>

              {/* Stats Section */}
              {dailyStatus.stats && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Taux de réussite global ({dailyStatus.stats.total} participants) :
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span>Q1</span>
                        <strong>{dailyStatus.stats.q1_pct}%</strong>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${dailyStatus.stats.q1_pct}%`, height: '100%', backgroundColor: 'var(--success)', borderRadius: '3px' }}></div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span>Q2</span>
                        <strong>{dailyStatus.stats.q2_pct}%</strong>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${dailyStatus.stats.q2_pct}%`, height: '100%', backgroundColor: 'var(--success)', borderRadius: '3px' }}></div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span>Q3</span>
                        <strong>{dailyStatus.stats.q3_pct}%</strong>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${dailyStatus.stats.q3_pct}%`, height: '100%', backgroundColor: 'var(--success)', borderRadius: '3px' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '400px' }}>
                Un nouveau défi vous attend ! 3 questions uniques partagées par tous les joueurs. Une seule tentative possible.
              </p>
              <button 
                className="btn-primary" 
                onClick={onStartDailyQuiz}
                style={{ padding: '10px 24px', fontSize: '0.9rem' }}
              >
                Lancer le Quiz
              </button>
            </div>
          )}
        </div>
      )}

      {/* Central Control Hub Card */}
      <div className="glass-card max-w-2xl w-full mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '28px', padding: '36px' }}>
        
        {/* Segmented Tab Control */}
        <div className="tab-group">
          <button
            className={`tab-btn${mode === 'solo' ? ' active' : ''}`}
            onClick={() => { setMode('solo'); if (gameMode === 'tribunal') setGameMode('classic'); }}
          >
            <BookOpen size={17} />
            Mode Entraînement
          </button>
          <button
            className={`tab-btn${mode === 'online' ? ' active' : ''}`}
            onClick={() => setMode('online')}
          >
            <Globe size={17} />
            Mode En Ligne
          </button>
        </div>

        {/* Game Mode Selector Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span className="section-label">Choisir un Mode de Jeu</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            
            {/* Mode Classique */}
            <div 
              onClick={() => setGameMode('classic')}
              style={{
                padding: '16px 12px',
                borderRadius: '10px',
                border: `2.5px solid ${gameMode === 'classic' ? 'var(--accent)' : 'var(--border-color)'}`,
                backgroundColor: gameMode === 'classic' ? 'var(--bg-hover)' : 'var(--bg-card)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'var(--transition)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Gamepad2 size={22} style={{ color: gameMode === 'classic' ? 'var(--accent)' : 'var(--text-secondary)' }} />
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Classique</div>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>10 QCM standard avec bonus de vitesse.</p>
            </div>

            {/* Mode Speed Blitz */}
            <div 
              onClick={() => setGameMode('speed_blitz')}
              style={{
                padding: '16px 12px',
                borderRadius: '10px',
                border: `2.5px solid ${gameMode === 'speed_blitz' ? 'var(--accent)' : 'var(--border-color)'}`,
                backgroundColor: gameMode === 'speed_blitz' ? 'var(--bg-hover)' : 'var(--bg-card)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'var(--transition)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Zap size={22} style={{ color: gameMode === 'speed_blitz' ? 'var(--accent)' : 'var(--text-secondary)' }} />
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Speed Blitz</div>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>Chrono réduit à 5s. Rapidité maximale.</p>
            </div>

            {/* Mode Mort Subite */}
            <div 
              onClick={() => setGameMode('sudden_death')}
              style={{
                padding: '16px 12px',
                borderRadius: '10px',
                border: `2.5px solid ${gameMode === 'sudden_death' ? 'var(--accent)' : 'var(--border-color)'}`,
                backgroundColor: gameMode === 'sudden_death' ? 'var(--bg-hover)' : 'var(--bg-card)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'var(--transition)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Skull size={22} style={{ color: gameMode === 'sudden_death' ? 'var(--accent)' : 'var(--text-secondary)' }} />
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Mort Subite</div>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>La moindre erreur vous élimine.</p>
            </div>

            {/* Mode Le Juste Nombre */}
            <div 
              onClick={() => setGameMode('guess_number')}
              style={{
                padding: '16px 12px',
                borderRadius: '10px',
                border: `2.5px solid ${gameMode === 'guess_number' ? 'var(--accent)' : 'var(--border-color)'}`,
                backgroundColor: gameMode === 'guess_number' ? 'var(--bg-hover)' : 'var(--bg-card)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'var(--transition)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Calculator size={22} style={{ color: gameMode === 'guess_number' ? 'var(--accent)' : 'var(--text-secondary)' }} />
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Juste Nombre</div>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>Estimez de tête les valeurs chiffrées.</p>
            </div>

            {/* Mode Le Tribunal */}
            {mode === 'online' && (
              <div 
                onClick={() => setGameMode('tribunal')}
                style={{
                  padding: '16px 12px',
                  borderRadius: '10px',
                  border: `2.5px solid ${gameMode === 'tribunal' ? 'var(--accent)' : 'var(--border-color)'}`,
                  backgroundColor: gameMode === 'tribunal' ? 'var(--bg-hover)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'var(--transition)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Gavel size={22} style={{ color: gameMode === 'tribunal' ? 'var(--accent)' : 'var(--text-secondary)' }} />
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Le Tribunal</div>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>Dilemmes ouverts. Rédigez et votez.</p>
              </div>
            )}

          </div>
        </div>

        {/* Theme Selection Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-label">Choisir un Thème</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {mode === 'online' ? 'Thèmes validés uniquement' : 'Thèmes publics & privés'}
            </span>
          </div>

          {loadingPacks ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div className="spinner" style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.05)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block', marginBottom: '8px' }} />
              <div>Chargement des thèmes...</div>
            </div>
          ) : filteredPacks.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              
              {/* Carousel Left button */}
              <button
                onClick={handlePrevPack}
                disabled={gameMode === 'guess_number'}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: gameMode === 'guess_number' ? 'not-allowed' : 'pointer',
                  opacity: gameMode === 'guess_number' ? 0.3 : 1,
                  transition: 'var(--transition-smooth)',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  if (gameMode !== 'guess_number') {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (gameMode !== 'guess_number') {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }
                }}
              >
                <ChevronLeft size={18} />
              </button>

              {/* Theme card */}
              <div
                className={animateClass}
                style={{
                  flex: 1,
                  height: '150px',
                  background: `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.85)), url(${getPackBg(filteredPacks[activePackIndex])}) center/cover no-repeat`,
                  borderRadius: '12px',
                  padding: '20px',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  transition: 'transform 0.2s ease'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 0, right: 0, bottom: 0, left: 0,
                  background: 'radial-gradient(circle at top right, rgba(255, 255, 255, 0.12) 0%, transparent 60%)',
                  pointerEvents: 'none'
                }} />

                {/* Badge Top-Right */}
                <span style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  color: 'var(--accent)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  {filteredPacks[activePackIndex].question_count} Questions
                </span>

                {/* Status indicator for unvalidated packs (Solo only) */}
                {parseInt(filteredPacks[activePackIndex].is_validated) === 0 && (
                  <span style={{
                    position: 'absolute',
                    bottom: '16px',
                    right: '16px',
                    backgroundColor: 'rgba(255, 247, 0, 0.1)',
                    color: 'var(--accent)',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--accent)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    En attente
                  </span>
                )}

                {/* Text Content */}
                <div>
                  <h4 style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    marginBottom: '4px',
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                  }}>
                    {filteredPacks[activePackIndex].name}
                  </h4>
                  <p style={{
                    fontSize: '0.8rem',
                    color: 'rgba(255, 255, 255, 0.75)',
                    lineHeight: '1.35',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    marginRight: '60px' // Leave room for status badge
                  }}>
                    {filteredPacks[activePackIndex].description || "Aucune description fournie pour ce thème."}
                  </p>
                </div>

                <span style={{
                  fontSize: '0.65rem',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontWeight: 600
                }}>
                  Thème {activePackIndex + 1} sur {filteredPacks.length}
                </span>
              </div>

              {/* Carousel Right button */}
              <button
                onClick={handleNextPack}
                disabled={gameMode === 'guess_number'}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: gameMode === 'guess_number' ? 'not-allowed' : 'pointer',
                  opacity: gameMode === 'guess_number' ? 0.3 : 1,
                  transition: 'var(--transition-smooth)',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  if (gameMode !== 'guess_number') {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (gameMode !== 'guess_number') {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }
                }}
              >
                <ChevronRight size={18} />
              </button>

            </div>
          ) : (
            <div style={{
              padding: '32px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              backgroundColor: 'rgba(0,0,0,0.1)',
              borderRadius: '12px',
              border: '1px dashed var(--border-color)',
              fontSize: '0.9rem'
            }}>
              Aucun thème disponible pour ce mode.
            </div>
          )}
        </div>

        {/* Action Panel Divider */}
        <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

        {/* Contextual Action Areas */}
        {mode === 'solo' ? (
          /* SOLO MODE ACTIONS */
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
              Mode sélectionné : <strong style={{ color: 'var(--accent)' }}>
                {gameMode === 'classic' && "Classique"}
                {gameMode === 'speed_blitz' && "Speed Blitz"}
                {gameMode === 'sudden_death' && "Mort Subite"}
                {gameMode === 'guess_number' && "Le Juste Nombre"}
              </strong>. <br />
              {gameMode === 'classic' && "Entraînez-vous avec 15s par question."}
              {gameMode === 'speed_blitz' && "Chrono ultra rapide de 5s par question !"}
              {gameMode === 'sudden_death' && "La moindre erreur termine la partie."}
              {gameMode === 'guess_number' && "Saisissez votre estimation au clavier."}
            </p>
            <button 
              className="btn-primary" 
              onClick={handleStartSolo}
              disabled={filteredPacks.length === 0}
              style={{ padding: '14px', fontSize: '1rem', width: '100%', maxWidth: '320px', margin: '0 auto' }}
            >
              <Play size={18} />
              Lancer la partie Solo
            </button>
          </div>
        ) : (
          /* ONLINE MODE ACTIONS (SIDE-BY-SIDE ON LARGE, STACKED ON MOBILE) */
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '28px' }}>
            
            {/* Create Room */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '12px', borderRight: '1px solid var(--border-color)', borderRightColor: window.innerWidth < 640 ? 'transparent' : 'var(--border-color)' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} style={{ color: 'var(--accent)' }} />
                Créer une Partie
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', lineHeight: '1.4', marginBottom: '8px' }}>
                Créer un salon en mode <strong style={{ color: 'var(--accent)' }}>
                  {gameMode === 'classic' && "Classique"}
                  {gameMode === 'speed_blitz' && "Speed Blitz"}
                  {gameMode === 'sudden_death' && "Mort Subite"}
                  {gameMode === 'guess_number' && "Le Juste Nombre"}
                  {gameMode === 'tribunal' && "Le Tribunal"}
                </strong>.
              </p>

              <button 
                className="btn-primary" 
                onClick={handleCreateLobby}
                disabled={creating || filteredPacks.length === 0}
                style={{ padding: '12px', fontSize: '0.9rem' }}
              >
                Créer le Salon
              </button>
              {createError && <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '4px' }}>{createError}</div>}
            </div>

            {/* Join Room */}
            <form onSubmit={handleJoinLobby} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} style={{ color: 'var(--accent)' }} />
                Rejoindre une Partie
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', lineHeight: '1.4', flexGrow: 1, marginBottom: '8px' }}>
                Entrez le code à 5 caractères communiqué par vos amis.
              </p>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="CODE (ex: X9A2B)"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  style={{
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    fontSize: '1rem',
                    letterSpacing: '1px',
                    fontWeight: 700,
                    padding: '10px'
                  }}
                  required
                />
                <button 
                  type="submit" 
                  className="btn-secondary" 
                  style={{ display: 'flex', gap: '4px', padding: '0 16px', fontSize: '0.9rem' }}
                  disabled={joining}
                >
                  Go
                  <ArrowRight size={16} />
                </button>
              </div>
              {joinError && <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '4px' }}>{joinError}</div>}
            </form>

          </div>
        )}

      </div>

      {/* Spinner keyframes inject */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          animation: spin 0.6s linear infinite;
        }
      `}</style>
    </div>
  );
}
