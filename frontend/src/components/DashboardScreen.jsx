import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { LogOut, Trophy, Play, Plus, Users, ShieldAlert, BookOpen, ChevronLeft, ChevronRight, Gamepad2, Globe, ArrowRight } from 'lucide-react';

export default function DashboardScreen({ user, onLogout, onStartSolo, onCreateLobby, onJoinLobby, onOpenAdmin, onOpenCreator }) {
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
  const [activePackIndex, setActivePackIndex] = useState(0);
  const [animateClass, setAnimateClass] = useState('animate-fade-in');

  useEffect(() => {
    fetchPacks();
  }, []);

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

  const triggerAnimation = () => {
    setAnimateClass('');
    setTimeout(() => {
      setAnimateClass('animate-fade-in');
    }, 20);
  };

  const handlePrevPack = () => {
    if (filteredPacks.length === 0) return;
    const nextIdx = (activePackIndex - 1 + filteredPacks.length) % filteredPacks.length;
    setActivePackIndex(nextIdx);
    
    const activePack = filteredPacks[nextIdx];
    setSelectedPackSolo(activePack.id.toString());
    setSelectedPackLobby(activePack.id.toString());
    triggerAnimation();
  };

  const handleNextPack = () => {
    if (filteredPacks.length === 0) return;
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
      onStartSolo(parseInt(selectedPackSolo));
    }
  };

  const handleCreateLobby = async () => {
    if (!selectedPackLobby) return;
    setCreating(true);
    setCreateError('');
    try {
      const data = await api.post('/lobby/create', { pack_id: parseInt(selectedPackLobby) });
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
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '680px', width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      
      {/* Header Profile Bar */}
      <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', padding: '20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            color: '#12121c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            fontWeight: 800
          }}>
            {user.username.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Salut, {user.username} !</h2>
            <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', marginTop: '2px' }}>
              <Trophy size={15} style={{ color: 'var(--accent)' }} />
              Score Global : <strong style={{ color: '#fff' }}>{user.global_score} pts</strong>
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {user.role === 'admin' && (
            <button className="btn-secondary" onClick={onOpenAdmin} style={{ borderColor: 'rgba(255, 59, 105, 0.4)', color: 'var(--error)', padding: '10px 16px', fontSize: '0.9rem' }}>
              <ShieldAlert size={16} />
              Admin
            </button>
          )}
          <button className="btn-secondary" onClick={onOpenCreator} style={{ padding: '10px 16px', fontSize: '0.9rem' }}>
            <Plus size={16} style={{ color: 'var(--accent)' }} />
            Créer un Thème
          </button>
          <button className="btn-secondary" onClick={onLogout} style={{ padding: '10px 16px', fontSize: '0.9rem' }}>
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Central Control Hub Card */}
      <div className="glass-card max-w-2xl w-full mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '28px', padding: '36px' }}>
        
        {/* Sliding Segmented Tab Toggles */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-input)',
          borderRadius: '12px',
          padding: '4px',
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => setMode('solo')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '1rem',
              transition: 'var(--transition-smooth)',
              backgroundColor: mode === 'solo' ? 'var(--accent)' : 'transparent',
              color: mode === 'solo' ? '#12121c' : 'var(--text-secondary)',
              boxShadow: mode === 'solo' ? '0 4px 12px rgba(255, 247, 0, 0.15)' : 'none'
            }}
          >
            <BookOpen size={18} />
            Mode Entraînement
          </button>
          <button
            onClick={() => setMode('online')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '1rem',
              transition: 'var(--transition-smooth)',
              backgroundColor: mode === 'online' ? 'var(--accent)' : 'transparent',
              color: mode === 'online' ? '#12121c' : 'var(--text-secondary)',
              boxShadow: mode === 'online' ? '0 4px 12px rgba(255, 247, 0, 0.15)' : 'none'
            }}
          >
            <Globe size={18} />
            Mode En Ligne
          </button>
        </div>

        {/* Theme Selection Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Choisir un Thème
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {mode === 'online' ? '🔒 Uniquement thèmes validés' : '🔓 Thèmes publics & privés'}
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
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
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
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
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
              Entraînez-vous sans stress sur un pack de questions aléatoires. <br />
              Remportez <strong style={{ color: '#fff' }}>10 points de score global</strong> pour chaque bonne réponse !
            </p>
            <button 
              className="btn-primary" 
              onClick={handleStartSolo}
              disabled={filteredPacks.length === 0}
              style={{ padding: '14px', fontSize: '1rem', width: '100%', maxWidth: '320px', margin: '0 auto' }}
            >
              <Play size={18} />
              Commencer l'Entraînement
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
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', lineHeight: '1.4', flexGrow: 1, marginBottom: '8px' }}>
                Générez un salon de jeu en direct sur le thème sélectionné et invitez vos amis.
              </p>
              <button 
                className="btn-primary" 
                onClick={handleCreateLobby}
                disabled={creating || filteredPacks.length === 0}
                style={{ padding: '12px', fontSize: '0.9rem' }}
              >
                Créer un Salon
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
