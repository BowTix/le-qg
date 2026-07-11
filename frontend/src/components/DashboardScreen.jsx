import React, { useEffect, useState, useRef } from 'react';
import { api } from '../utils/api';
import { LogOut, Trophy, Play, Plus, Users, User, ShieldAlert, BookOpen, ChevronLeft, ChevronRight, Gamepad2, Globe, ArrowRight, Award, Zap, Skull, Calculator, Gavel, Lock, EyeOff } from 'lucide-react';
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
  const [selectedGame, setSelectedGame] = useState(null);
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
    if (!selectedPackLobby && gameMode !== 'imposteur') return;
    setCreating(true);
    setCreateError('');
    try {
      const data = await api.post('/lobby/create', { 
        pack_id: gameMode === 'imposteur' ? 1 : parseInt(selectedPackLobby),
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

  const gameDetails = {
    classic: {
      title: "Classique",
      icon: <Gamepad2 size={36} style={{ color: 'var(--accent)' }} />,
      desc: "Le mode classique du QG. Vous devez répondre à 10 questions de culture générale à choix multiples. Plus vous répondez vite, plus vous marquez de points !",
      rules: [
        "10 questions à choix multiples (QCM).",
        "15 secondes maximum par question.",
        "Score calculé sur la vitesse (jusqu'à 100 points par question).",
        "Idéal pour s'échauffer en solo ou s'affronter en groupe."
      ]
    },
    speed_blitz: {
      title: "Speed Blitz",
      icon: <Zap size={36} style={{ color: 'var(--accent)' }} />,
      desc: "Un mode survitaminé pour tester vos réflexes et votre intuition. Pas le temps de douter, il faut cliquer !",
      rules: [
        "10 questions à choix multiples.",
        "Seulement 5 secondes de réflexion par question.",
        "Pression temporelle maximale !",
        "Parfait pour tester votre culture générale spontanée."
      ]
    },
    sudden_death: {
      title: "Mort Subite",
      icon: <Skull size={36} style={{ color: 'var(--accent)' }} />,
      desc: "La moindre erreur vous élimine de la partie. Serez-vous capable de réaliser le sans-faute parfait ?",
      rules: [
        "Enchaînement de questions à choix multiples.",
        "La première réponse fausse met fin à votre partie (élimination).",
        "Le vainqueur est le dernier survivant ou celui avec le plus de points.",
        "Gros enjeu intellectuel et tactique."
      ]
    },
    guess_number: {
      title: "Le Juste Nombre",
      icon: <Calculator size={36} style={{ color: 'var(--accent)' }} />,
      desc: "Pas de QCM ici. Vous devez estimer une valeur numérique exacte et saisir votre réponse au clavier. La réponse la plus proche l'emporte !",
      rules: [
        "Saisie numérique libre.",
        "Questions basées sur des estimations (années, tailles, statistiques).",
        "Calcul des points selon la marge d'erreur par rapport à la bonne réponse.",
        "Faites chauffer votre logique mathématique."
      ]
    },
    tribunal: {
      title: "Le Tribunal",
      icon: <Gavel size={36} style={{ color: 'var(--accent)' }} />,
      desc: "Un jeu social et délirant où l'imagination et l'humour priment. Écrivez les réponses les plus drôles à des dilemmes absurdes et votez pour vos favorites.",
      rules: [
        "Phase 1 : Rédigez une réponse secrète (limite de 180 caractères) à 5 dilemmes ouverts.",
        "Phase 2 : Votez anonymement pour la meilleure réponse parmi celles du salon.",
        "Phase 3 : Découvrez qui a écrit quoi et récoltez les points du jury.",
        "Exclusivement multijoueur (3 joueurs minimum recommandés)."
      ]
    }
  };

  const selectedCategory = (gameMode === 'tribunal' || gameMode === 'imposteur') ? 'party' : 'quiz';

  const cultureQuizGames = [
    {
      id: 'classic',
      title: 'Classique',
      desc: '10 QCM standard avec bonus de rapidité pour marquer un maximum de points.',
      icon: <Play size={20} />,
      color: '#3dbdad',
      glow: 'rgba(61, 189, 173, 0.12)',
      gradient: 'linear-gradient(135deg, #3dbdad, #2a9d8f)',
      onClick: () => {
        setGameMode('classic');
        setSelectedGame('classic');
        if (mode === 'online') setMode('solo');
      }
    },
    {
      id: 'speed_blitz',
      title: 'Speed Blitz',
      desc: 'Le temps de réflexion est réduit à 5 secondes. Rapidité et intuition exigées !',
      icon: <Zap size={20} />,
      color: '#ff9f1c',
      glow: 'rgba(255, 159, 28, 0.12)',
      gradient: 'linear-gradient(135deg, #ffd166, #ff9f1c)',
      onClick: () => {
        setGameMode('speed_blitz');
        setSelectedGame('speed_blitz');
        if (mode === 'online') setMode('solo');
      }
    },
    {
      id: 'sudden_death',
      title: 'Mort Subite',
      desc: 'Chaque erreur est fatale. Répondez correctement ou vous serez éliminé.',
      icon: <Skull size={20} />,
      color: '#e63946',
      glow: 'rgba(230, 57, 70, 0.12)',
      gradient: 'linear-gradient(135deg, #ff4d6d, #e63946)',
      onClick: () => {
        setGameMode('sudden_death');
        setSelectedGame('sudden_death');
        if (mode === 'online') setMode('solo');
      }
    },
    {
      id: 'guess_number',
      title: 'Juste Nombre',
      desc: 'Estimez des valeurs chiffrées précises et tapez votre réponse au clavier.',
      icon: <Calculator size={20} />,
      color: '#00b4db',
      glow: 'rgba(0, 180, 219, 0.12)',
      gradient: 'linear-gradient(135deg, #00d2ff, #0083b0)',
      onClick: () => {
        setGameMode('guess_number');
        setSelectedGame('guess_number');
        if (mode === 'online') setMode('solo');
      }
    }
  ];

  const partyGames = [
    {
      id: 'tribunal',
      title: 'Le Tribunal',
      desc: 'Rédigez des réponses absurdes à des dilemmes ouverts et votez anonymement.',
      icon: <Gavel size={20} />,
      badge: 'Multijoueur 👥',
      color: '#9b5de5',
      glow: 'rgba(155, 93, 229, 0.12)',
      gradient: 'linear-gradient(135deg, #da22ff, #9733ee)',
      onClick: () => {
        setGameMode('tribunal');
        setSelectedGame('tribunal');
        setMode('online');
      }
    },
    {
      id: 'imposteur',
      title: "L'Imposteur",
      desc: 'Un jeu de bluff et de déduction sociale. Trouvez qui cache son mot secret.',
      icon: <EyeOff size={20} />,
      badge: 'Multijoueur 👥',
      color: '#ff2a85',
      glow: 'rgba(255, 42, 133, 0.12)',
      gradient: 'linear-gradient(135deg, #ff007f, #7f00ff)',
      onClick: () => {
        setGameMode('imposteur');
        setSelectedGame('imposteur');
        setMode('online');
      }
    },
    {
      id: 'decodeur',
      title: 'Décodeur',
      desc: 'Faites deviner des codes chiffrés à vos coéquipiers en transmettant des indices.',
      icon: <Lock size={20} />,
      badge: 'Bientôt 🚀',
      color: '#6c757d',
      glow: 'rgba(0, 0, 0, 0)',
      gradient: 'linear-gradient(135deg, #495057, #343a40)',
      disabled: true
    }
  ];

  return (
    <div className="container animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      

      {selectedGame === null ? (
        /* ============================================================
           STAGE 1: CATALOG VIEW
           ============================================================ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* CATEGORY 1: QUIZ CULTURE */}
          <div>
            <h3 className="game-category-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Gamepad2 size={16} /> Quiz de Culture & Connaissances
            </h3>
            <GameCarousel3D items={cultureQuizGames} />
          </div>

          {/* CATEGORY 2: JEUX DE SOIREE */}
          <div>
            <h3 className="game-category-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Users size={16} /> Jeux de Soirée & Rôles Sociaux
            </h3>
            <GameCarousel3D items={partyGames} />
          </div>

        </div>
      ) : (
        /* ============================================================
           STAGE 2: GAME SETUP VIEW (TWO COLUMNS)
           ============================================================ */
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Back button */}
          <button 
            onClick={() => setSelectedGame(null)}
            className="btn-secondary"
            style={{ 
              alignSelf: 'flex-start', 
              padding: '8px 16px', 
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              background: 'rgba(255,255,255,0.05)'
            }}
          >
            <ChevronLeft size={16} />
            Retour au catalogue
          </button>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '32px',
            marginTop: '8px',
            alignItems: 'start'
          }} className="grid-auto">
            
            {/* Left Column: Game Presentation */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ 
                  width: '64px', height: '64px', borderRadius: '12px',
                  backgroundColor: 'var(--bg-surface)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  {gameDetails[selectedGame]?.icon}
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    {selectedCategory === 'quiz' ? "Quiz de culture" : "Jeu de Soirée"}
                  </span>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
                    {gameDetails[selectedGame]?.title}
                  </h2>
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5, margin: 0 }}>
                {gameDetails[selectedGame]?.desc}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Règles du jeu :
                </span>
                <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {gameDetails[selectedGame]?.rules.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Column: Game Setup Options */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '32px' }}>
              
              {selectedCategory === 'quiz' ? (
                /* OPTION VIEW FOR STANDARD QUIZ */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Mode Tabs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span className="section-label">Choix de la formule</span>
                    <div className="tab-group">
                      <button
                        className={`tab-btn${mode === 'solo' ? ' active' : ''}`}
                        onClick={() => setMode('solo')}
                      >
                        <BookOpen size={16} />
                        Entraînement (Solo)
                      </button>
                      <button
                        className={`tab-btn${mode === 'online' ? ' active' : ''}`}
                        onClick={() => setMode('online')}
                      >
                        <Globe size={16} />
                        En Ligne (Multi)
                      </button>
                    </div>
                  </div>

                  {/* Theme Select */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="section-label">Sélectionner un Thème</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {mode === 'online' ? 'Thèmes officiels' : 'Tous les thèmes'}
                      </span>
                    </div>

                    {loadingPacks ? (
                      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div className="spinner" style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.05)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} />
                        <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>Chargement des thèmes...</div>
                      </div>
                    ) : filteredPacks.length > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          onClick={handlePrevPack}
                          disabled={gameMode === 'guess_number'}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '50%', width: '36px', height: '36px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-primary)', cursor: gameMode === 'guess_number' ? 'not-allowed' : 'pointer',
                            opacity: gameMode === 'guess_number' ? 0.3 : 1
                          }}
                        >
                          <ChevronLeft size={16} />
                        </button>

                        <div
                          className={animateClass}
                          style={{
                            flex: 1, height: '130px',
                            background: `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.85)), url(${getPackBg(filteredPacks[activePackIndex])}) center/cover no-repeat`,
                            borderRadius: '10px', padding: '16px 20px', position: 'relative', overflow: 'hidden',
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                            border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)'
                          }}
                        >
                          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: 'radial-gradient(circle at top right, rgba(255, 255, 255, 0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />

                          <span style={{
                            position: 'absolute', top: '12px', right: '12px', backgroundColor: 'rgba(0, 0, 0, 0.4)',
                            color: 'var(--accent)', fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: '20px'
                          }}>
                            {filteredPacks[activePackIndex].question_count} Questions
                          </span>

                          {parseInt(filteredPacks[activePackIndex].is_validated) === 0 && (
                            <span style={{
                              position: 'absolute', bottom: '12px', right: '12px', backgroundColor: 'rgba(255, 247, 0, 0.1)',
                              color: 'var(--accent)', fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--accent)'
                            }}>
                              En attente
                            </span>
                          )}

                          <div>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>
                              {filteredPacks[activePackIndex].name}
                            </h4>
                            <p style={{
                              fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.3,
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginRight: '60px'
                            }}>
                              {filteredPacks[activePackIndex].description || "Aucune description."}
                            </p>
                          </div>

                          <span style={{ fontSize: '0.62rem', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>
                            Thème {activePackIndex + 1} sur {filteredPacks.length}
                          </span>
                        </div>

                        <button
                          onClick={handleNextPack}
                          disabled={gameMode === 'guess_number'}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '50%', width: '36px', height: '36px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-primary)', cursor: gameMode === 'guess_number' ? 'not-allowed' : 'pointer',
                            opacity: gameMode === 'guess_number' ? 0.3 : 1
                          }}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.85rem' }}>
                        Aucun thème disponible pour ce mode.
                      </div>
                    )}
                  </div>

                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)', marginTop: '8px' }} />

                  {/* Actions (Solo / Lobby) */}
                  {mode === 'solo' ? (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.4', margin: 0 }}>
                        Lancer une session d'entraînement solo sur ce thème.
                      </p>
                      <button 
                        className="btn-primary" 
                        onClick={handleStartSolo}
                        disabled={filteredPacks.length === 0}
                        style={{ padding: '12px 24px', fontSize: '0.95rem', width: '100%', maxWidth: '280px', margin: '0 auto' }}
                      >
                        <Play size={16} />
                        Jouer Solo
                      </button>
                    </div>
                  ) : (
                    /* ONLINE LOBBY */
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      
                      {/* Create */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span className="section-label">Création d'une salle</span>
                        <button 
                          className="btn-primary" 
                          onClick={handleCreateLobby}
                          disabled={creating || filteredPacks.length === 0}
                          style={{ padding: '12px', fontSize: '0.9rem', width: '100%' }}
                        >
                          {creating ? 'Création...' : 'Créer un salon en ligne'}
                        </button>
                        {createError && <div style={{ color: 'var(--error)', fontSize: '0.78rem', marginTop: '2px' }}>{createError}</div>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ height: '1px', backgroundColor: 'var(--border-color)', flex: 1 }} />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>ou</span>
                        <div style={{ height: '1px', backgroundColor: 'var(--border-color)', flex: 1 }} />
                      </div>

                      {/* Join */}
                      <form onSubmit={handleJoinLobby} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span className="section-label">Rejoindre via un code</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            maxLength={5}
                            placeholder="CODE (ex: W9H0L)"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value)}
                            style={{
                              textTransform: 'uppercase', textAlign: 'center',
                              fontSize: '0.9rem', letterSpacing: '1px', fontWeight: 700,
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
                            Rejoindre
                            <ArrowRight size={16} />
                          </button>
                        </div>
                        {joinError && <div style={{ color: 'var(--error)', fontSize: '0.78rem', marginTop: '2px' }}>{joinError}</div>}
                      </form>

                    </div>
                  )}

                </div>
              ) : (
                /* OPTION VIEW FOR PARTY SOCIAL GAMES (Le Tribunal) */
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Create */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span className="section-label">Création d'une salle</span>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 4px 0' }}>
                      Générez un code de salon et invitez vos amis à vous rejoindre en ligne.
                    </p>
                    <button 
                      className="btn-primary" 
                      onClick={handleCreateLobby}
                      disabled={creating || (gameMode !== 'imposteur' && filteredPacks.length === 0)}
                      style={{ padding: '12px', fontSize: '0.9rem', width: '100%' }}
                    >
                      {creating ? 'Création...' : gameMode === 'imposteur' ? "Créer un salon L'Imposteur" : 'Créer un salon Le Tribunal'}
                    </button>
                    {createError && <div style={{ color: 'var(--error)', fontSize: '0.78rem', marginTop: '2px' }}>{createError}</div>}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', flex: 1 }} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>ou</span>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', flex: 1 }} />
                  </div>

                  {/* Join */}
                  <form onSubmit={handleJoinLobby} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span className="section-label">Rejoindre un salon</span>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 4px 0' }}>
                      Saisissez le code de salon fourni par l'hôte.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        maxLength={5}
                        placeholder="CODE (ex: W9H0L)"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        style={{
                          textTransform: 'uppercase', textAlign: 'center',
                          fontSize: '0.9rem', letterSpacing: '1px', fontWeight: 700,
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
                        Rejoindre
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    {joinError && <div style={{ color: 'var(--error)', fontSize: '0.78rem', marginTop: '2px' }}>{joinError}</div>}
                  </form>

                </div>
              )}

            </div>
          </div>
        </div>
      )}
      {/* Spinner and pulse keyframes inject */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          animation: spin 0.6s linear infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: translateX(0); }
          50% { opacity: 1; transform: translateX(3px); }
        }
        
        /* 3D Carousel perspective fixes for mobile */
        @media (max-width: 768px) {
          .active-3d {
            transform: scale(0.9) !important;
          }
        }
      `}</style>
    </div>
  );
}

// 📅 REDESIGNED MODERN GAME CAROUSEL COMPONENT
function GameCarousel3D({ items }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseDown = (e) => {
    setStartX(e.clientX);
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const diff = e.clientX - startX;
    if (diff > 60) {
      setActiveIndex(prev => (prev - 1 + items.length) % items.length);
      setStartX(e.clientX);
      setIsDragging(false);
    } else if (diff < -60) {
      setActiveIndex(prev => (prev + 1) % items.length);
      setStartX(e.clientX);
      setIsDragging(false);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - startX;
    if (diff > 50) {
      setActiveIndex(prev => (prev - 1 + items.length) % items.length);
      setStartX(e.touches[0].clientX);
      setIsDragging(false);
    } else if (diff < -50) {
      setActiveIndex(prev => (prev + 1) % items.length);
      setStartX(e.touches[0].clientX);
      setIsDragging(false);
    }
  };

  const next = () => setActiveIndex(prev => (prev + 1) % items.length);
  const prev = () => setActiveIndex(prev => (prev - 1 + items.length) % items.length);

  const isMobile = windowWidth < 768;
  const translateXVal = isMobile ? 180 : 260;
  const cardWidth = isMobile ? '260px' : '320px';
  const cardHeight = isMobile ? '230px' : '260px';

  return (
    <div 
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        marginTop: '8px',
        marginBottom: '16px'
      }}
    >
      <div 
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: isMobile ? '260px' : '310px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          userSelect: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        {/* CARDS WRAPPER */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {items.map((item, index) => {
            let offset = index - activeIndex;
            
            // Compute circular offset
            if (offset < -items.length / 2) offset += items.length;
            if (offset > items.length / 2) offset -= items.length;

            const absOffset = Math.abs(offset);
            const isActive = offset === 0;

            const scale = isActive ? 1.05 : (absOffset === 1 ? 0.9 : 0.75);
            const opacity = isActive ? 1 : (absOffset === 1 ? 1 : 0);
            const zIndex = 100 - absOffset;
            const translateX = offset * translateXVal;

            return (
              <div
                key={index}
                className={`game-card${item.disabled ? ' disabled' : ''}${isActive ? ' active-card' : ' inactive-card'}`}
                onClick={(e) => {
                  if (!isActive) {
                    setActiveIndex(index);
                    e.stopPropagation();
                  } else if (!item.disabled && item.onClick) {
                    item.onClick();
                  }
                }}
                style={{
                  position: 'absolute',
                  width: cardWidth,
                  height: cardHeight,
                  transition: 'all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)',
                  transform: `translateX(${translateX}px) scale(${scale})`,
                  opacity: opacity,
                  zIndex: zIndex,
                  pointerEvents: opacity > 0 ? 'auto' : 'none',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                }}
              >
                <div 
                  className="game-card-body"
                  style={{
                    padding: isMobile ? '20px' : '28px',
                    border: isActive ? `2px solid ${item.color}` : '1px solid var(--border-color)',
                    boxShadow: isActive 
                      ? `0 8px 24px ${item.glow}, 0 2px 6px rgba(0, 0, 0, 0.12)` 
                      : '0 4px 12px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  {/* Card content */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="game-card-icon" style={{
                        background: isActive ? item.gradient : 'var(--bg-surface)',
                        color: isActive ? '#ffffff' : 'var(--text-secondary)',
                        width: isMobile ? '34px' : '42px',
                        height: isMobile ? '34px' : '42px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s ease',
                        boxShadow: isActive ? `0 4px 10px ${item.glow}` : 'none',
                      }}>
                        {item.icon}
                      </div>
                      {item.badge && (
                        <div className="game-card-badge" style={{
                          margin: 0,
                          backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255,255,255,0.05)',
                          borderColor: isActive ? item.color : 'var(--border-color)',
                          color: isActive ? item.color : 'var(--text-secondary)',
                          fontSize: isMobile ? '0.6rem' : '0.68rem',
                          padding: '2px 8px',
                          borderRadius: '20px',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          position: 'static',
                        }}>
                          {item.badge}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 style={{ 
                        fontSize: isMobile ? '1.05rem' : '1.25rem', 
                        fontWeight: 800, 
                        margin: '0 0 4px 0', 
                        color: 'var(--text-primary)',
                      }}>
                        {item.title}
                      </h4>
                      <p style={{ 
                        fontSize: isMobile ? '0.75rem' : '0.82rem', 
                        color: 'var(--text-secondary)', 
                        margin: 0, 
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: isMobile ? 2 : 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  {isActive && !item.disabled && (
                    <div className="configure-partie-btn" style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      color: item.color, 
                      fontSize: isMobile ? '0.78rem' : '0.85rem', 
                      fontWeight: 700, 
                      alignSelf: 'flex-start',
                      marginTop: '8px',
                    }}>
                      <span>Configurer la partie</span>
                      <ArrowRight size={isMobile ? 12 : 14} className="arrow-pulse" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Nav Controls */}
        <button 
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="carousel-nav-btn prev"
          aria-label="Previous game"
          style={{
            position: 'absolute',
            left: '10px',
            zIndex: 200,
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
            transition: 'all 0.2s ease',
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="carousel-nav-btn next"
          aria-label="Next game"
          style={{
            position: 'absolute',
            right: '10px',
            zIndex: 200,
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
            transition: 'all 0.2s ease',
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Pagination indicators (Dots) */}
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: '-4px',
        height: '10px',
      }}>
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              style={{
                width: isActive ? '20px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: isActive ? item.color : 'var(--border-color)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                boxShadow: isActive ? `0 0 8px ${item.glow}` : 'none',
              }}
              title={item.title}
            />
          );
        })}
      </div>
    </div>
  );
}

