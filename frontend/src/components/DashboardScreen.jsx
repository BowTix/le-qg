import React, { useEffect, useState } from 'react';
import { api, PUBLIC_BASE } from '../utils/api';
import { 
  Trophy, Play, Plus, Users, User, ShieldAlert, BookOpen, 
  ChevronRight, Gamepad2, Globe, ArrowRight, Award, Zap, 
  Coins, Sparkles, Star, Sparkle, Clock
} from 'lucide-react';
import { getLevel, getUsernameStyle, getLevelBadge, getLevelProgressDetails } from '../utils/progression';
import GameCard from './GameCard';

export default function DashboardScreen({ 
  user, onLogout, onStartSolo, onCreateLobby, onJoinLobby, 
  onOpenAdmin, onOpenCreator, onOpenLeaderboard, onOpenProfile, onStartDailyQuiz,
  onUpdateUserStats, onOpenShop, onOpenCollection
}) {
  const [collectionData, setCollectionData] = useState(() => {
    try {
      const cached = localStorage.getItem('cache_collection');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [createError, setCreateError] = useState('');
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

  // Quests States
  const [quests, setQuests] = useState(() => {
    try {
      const cached = localStorage.getItem('cache_quests');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loadingQuests, setLoadingQuests] = useState(false);
  const [activeTab, setActiveTab] = useState('daily');
  const [claimingQuestId, setClaimingQuestId] = useState(null);

  // Load collection and quests on mount
  useEffect(() => {
    fetchCollection();
    fetchQuests();
  }, []);

  const fetchCollection = async () => {
    setLoadingCollection(true);
    try {
      const data = await api.get('/shop/collection');
      if (data) {
        setCollectionData(data);
        localStorage.setItem('cache_collection', JSON.stringify(data));
      }
    } catch (err) {
      console.error("Failed to fetch collection data", err);
    } finally {
      setLoadingCollection(false);
    }
  };

  const fetchQuests = async () => {
    setLoadingQuests(true);
    try {
      const data = await api.get('/quests');
      if (data && data.success) {
        setQuests(data.quests || []);
        localStorage.setItem('cache_quests', JSON.stringify(data.quests));
      }
    } catch (err) {
      console.error("Failed to fetch quests", err);
    } finally {
      setLoadingQuests(false);
    }
  };

  const handleClaimQuest = async (userQuestId) => {
    if (claimingQuestId) return;
    setClaimingQuestId(userQuestId);
    try {
      const data = await api.post('/quests/claim', { user_quest_id: userQuestId });
      if (data && data.success) {
        // Update global user coins and score
        if (onUpdateUserStats) {
          onUpdateUserStats({
            coins: data.coins,
            global_score: data.global_score
          });
        }
        // Reload quests
        fetchQuests();
      }
    } catch (err) {
      console.error("Failed to claim quest", err);
    } finally {
      setClaimingQuestId(null);
    }
  };

  const formatTimeLeft = (seconds) => {
    if (!seconds || seconds <= 0) return 'Expiré';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}j ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Profile progression stats
  const lvl = getLevel(user.global_score);
  const badgeLabel = getLevelBadge(lvl);
  const nameStyle = getUsernameStyle(user.global_score);
  const { currentLevelXp, xpNeededForNextLevel } = getLevelProgressDetails(user.global_score);
  const xpPercentage = xpNeededForNextLevel > 0 ? Math.min(Math.round((currentLevelXp / xpNeededForNextLevel) * 100), 100) : 0;

  // Collection computations
  const totalCardsInCatalog = collectionData?.catalog?.cards?.length || 0;
  const unlockedCardsMap = collectionData?.unlocked_cards || {};
  const unlockedCount = Object.keys(unlockedCardsMap).length;
  const collectionPercentage = totalCardsInCatalog > 0 ? Math.round((unlockedCount / totalCardsInCatalog) * 100) : 0;

  // Find latest 4 unlocked cards based on backend last_unlocked timeline
  const latestCards = [];
  if (collectionData && collectionData.last_unlocked && collectionData.catalog?.cards) {
    const catalogCardsMap = new Map(collectionData.catalog.cards.map(c => [c.id, c]));
    for (const lu of collectionData.last_unlocked) {
      const card = catalogCardsMap.get(lu.card_id);
      if (card) {
        latestCards.push({
          ...card,
          quantity: unlockedCardsMap[card.id] || 1
        });
      }
      if (latestCards.length >= 4) break;
    }
  }

  const handleStartSolo = () => {
    onStartSolo(0, 'kculture');
  };

  const handleCreateLobby = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const data = await api.post('/lobby/create', { 
        pack_id: 0,
        game_mode: 'kculture'
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

  const getRarityLabel = (rarity) => {
    switch (rarity) {
      case 'legendary': return 'Légendaire';
      case 'epic': return 'Épique';
      case 'rare': return 'Rare';
      default: return 'Commune';
    }
  };

  return (
    <div className="container dashboard-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingTop: '24px', paddingBottom: '40px' }}>
      
      {/* 1. PROGRESS WIDGETS ROW */}
      <div className="grid-widgets" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        {/* WIDGET 1: PROGRES & NIVEAU */}
        <div className="dashboard-widget" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Award size={20} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Progression</span>
            </div>
            <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--border-color)', fontWeight: 700, color: 'var(--text-muted)' }}>
              {badgeLabel}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)' }}>Niveau {lvl}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{user.global_score} XP total</span>
          </div>

          {/* XP Bar */}
          <div style={{ width: '100%', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>XP du niveau</span>
              <span>{currentLevelXp} / {xpNeededForNextLevel} XP</span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)' }}>
              <div style={{ width: `${xpPercentage}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent) 0%, #a78bfa 100%)', borderRadius: '10px', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* WIDGET 2: COLLECTION & DECK */}
        <div className="dashboard-widget" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={20} style={{ color: '#ffb300' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Album & Deck</span>
            </div>
            <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(255, 179, 0, 0.1)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(255,179,0,0.2)', fontWeight: 700, color: '#ffb300' }}>
              Collection
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)' }}>{collectionPercentage}%</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{unlockedCount} / {totalCardsInCatalog} cartes</span>
          </div>

          {/* Collection completion Bar */}
          <div style={{ width: '100%', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>Complétion globale</span>
              <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent)' }} onClick={() => onOpenCollection()}>Voir l'album</span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)' }}>
              <div style={{ width: `${collectionPercentage}%`, height: '100%', background: 'linear-gradient(90deg, #ffb300 0%, #f59e0b 100%)', borderRadius: '10px', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* WIDGET 3: SOLDE & ECO */}
        <div className="dashboard-widget" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Coins size={20} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Portefeuille</span>
            </div>
            <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.2)', fontWeight: 700, color: '#f59e0b' }}>
              Banque
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {user.coins || 0}
              <span style={{ fontSize: '1.4rem' }}>🪙</span>
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Pièces disponibles</span>
          </div>

          {/* Quick links */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.75rem' }}>
            <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent)', fontWeight: 600 }} onClick={() => onOpenLeaderboard()}>
              🏆 Classement
            </span>
            <span style={{ cursor: 'pointer', textDecoration: 'underline', color: '#ffb300', fontWeight: 600 }} onClick={() => onOpenShop()}>
              🛍️ Ouvrir des Boosters
            </span>
          </div>
        </div>

      </div>

      {/* 2. HERO HEADER & GAME PRESENTATION */}
      <div className="hero-section" style={{ textAlign: 'center', padding: '16px 0', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '250px', height: '250px', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', filter: 'blur(30px)', pointerEvents: 'none' }} />

        <h1 style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          fontSize: '3rem',
          fontWeight: 900,
          letterSpacing: '-1px',
          lineHeight: '1.1',
          margin: '0 0 12px 0',
          background: 'linear-gradient(135deg, var(--text-primary) 30%, #a78bfa 70%, var(--accent) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          <Sparkle size={36} style={{ color: 'var(--text-primary)', animation: 'pulse 1.5s infinite' }} />
          LE GRAND QUIZ
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '650px', margin: '0 auto', lineHeight: '1.5' }}>
          Le quiz ultime de culture générale. Mesurez-vous à l'arène ou entraînez-vous pour remporter des pièces, acheter des boosters et compléter votre album.
        </p>
      </div>

      {/* 3. GAMING CARDS GRID */}
      <div className="grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px' }}>
        
        {/* CARD 1: SOLO TRAINING */}
        <div className="gaming-card solo">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-badge solo">
              <BookOpen size={12} />
              <span>Solo</span>
            </div>
            <Star size={18} style={{ color: 'var(--color-purple)', opacity: 0.8 }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Entraînement</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: '1.4', margin: 0 }}>
              Testez vos connaissances sans pression. Répondez aux QCM, blind tests visuels et questions ouvertes à votre propre rythme.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={13} style={{ color: 'var(--color-purple)' }} />
              <span>Gagnez des pièces à chaque bonne réponse</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={13} style={{ color: 'var(--color-purple)' }} />
              <span>Questions infinies et thèmes mélangés</span>
            </div>
          </div>

          <button 
            className="btn-primary" 
            onClick={handleStartSolo}
            style={{ 
              marginTop: 'auto', 
              padding: '14px', 
              fontSize: '0.95rem',
              background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
              boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: '#fff',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
          >
            <Play size={16} fill="#fff" />
            Lancer l'Entraînement
          </button>
        </div>

        {/* CARD 2: MULTIPLAYER ARENA */}
        <div className="gaming-card online">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-badge online">
              <Globe size={12} />
              <span>En Ligne</span>
            </div>
            <Users size={18} style={{ color: 'var(--color-orange)', opacity: 0.8 }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Arène Multijoueur</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: '1.4', margin: 0 }}>
              Défiez vos amis ou d'autres joueurs en temps réel. Créez un salon ou rejoignez un groupe pour prouver qui est le roi de la culture générale.
            </p>
          </div>

          {/* Formulaires creation/jointure */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px' }}>
            
            {/* Créer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button 
                className="btn-primary" 
                onClick={handleCreateLobby}
                disabled={creating}
                style={{ 
                  padding: '12px', 
                  fontSize: '0.88rem',
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 700,
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                {creating ? 'Création du salon...' : 'Créer un salon'}
              </button>
              {createError && <div style={{ color: 'var(--error)', fontSize: '0.74rem', marginTop: '2px', textAlign: 'center' }}>{createError}</div>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '-4px 0' }}>
              <div style={{ height: '1.5px', backgroundColor: 'rgba(255,255,255,0.05)', flex: 1 }} />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>ou</span>
              <div style={{ height: '1.5px', backgroundColor: 'rgba(255,255,255,0.05)', flex: 1 }} />
            </div>

            {/* Rejoindre */}
            <form onSubmit={handleJoinLobby} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="CODE SALON (EX: W9H0L)"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  style={{
                    flex: 1,
                    textTransform: 'uppercase', 
                    textAlign: 'center',
                    fontSize: '0.85rem', 
                    letterSpacing: '1.5px', 
                    fontWeight: 800,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--border-color)',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  required
                />
                <button 
                  type="submit" 
                  className="btn-secondary" 
                  disabled={joining}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: '4px', 
                    padding: '0 16px', 
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  {joining ? '...' : 'Rejoindre'}
                  <ArrowRight size={14} />
                </button>
              </div>
              {joinError && <div style={{ color: 'var(--error)', fontSize: '0.74rem', marginTop: '2px', textAlign: 'center' }}>{joinError}</div>}
            </form>

          </div>
        </div>

      </div>

      {/* 3. SYSTEME DE QUETES */}
      {quests.length > 0 && (
        <div className="quests-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Missions & Objectifs</h3>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Tab Selector */}
              <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-color)' }}>
                <button
                  onClick={() => setActiveTab('daily')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: activeTab === 'daily' ? 'var(--accent)' : 'transparent',
                    color: activeTab === 'daily' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  Quotidiennes
                  {quests.filter(q => q.type === 'daily' && q.progress >= q.target_value && !q.is_claimed).length > 0 && (
                    <span style={{ marginLeft: '6px', backgroundColor: 'var(--error)', color: '#fff', fontSize: '0.62rem', padding: '1px 5px', borderRadius: '10px', fontWeight: 800 }}>
                      {quests.filter(q => q.type === 'daily' && q.progress >= q.target_value && !q.is_claimed).length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('weekly')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: activeTab === 'weekly' ? 'var(--accent)' : 'transparent',
                    color: activeTab === 'weekly' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  Hebdomadaires
                  {quests.filter(q => q.type === 'weekly' && q.progress >= q.target_value && !q.is_claimed).length > 0 && (
                    <span style={{ marginLeft: '6px', backgroundColor: 'var(--error)', color: '#fff', fontSize: '0.62rem', padding: '1px 5px', borderRadius: '10px', fontWeight: 800 }}>
                      {quests.filter(q => q.type === 'weekly' && q.progress >= q.target_value && !q.is_claimed).length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {quests.filter(q => q.type === activeTab).map((q) => {
              const pct = Math.min(100, Math.round((q.progress / q.target_value) * 100));
              const isCompleted = q.progress >= q.target_value;

              return (
                <div
                  key={q.user_quest_id}
                  className="glass-card"
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    justifyContent: 'space-between',
                    border: q.is_claimed ? '1px solid rgba(255,255,255,0.02)' : isCompleted ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--border-color)',
                    opacity: q.is_claimed ? 0.6 : 1,
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  {/* Quest Title & Expiry */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>{q.title}</span>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{q.description}</span>
                    </div>
                    {/* Time Left Badge */}
                    <span 
                      style={{ 
                        fontSize: '0.66rem', 
                        color: 'var(--text-secondary)', 
                        backgroundColor: 'rgba(255,255,255,0.02)', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                        whiteSpace: 'nowrap'
                      }}
                      title="Temps restant"
                    >
                      <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                      <span>{formatTimeLeft(q.time_left_seconds)}</span>
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600 }}>
                      <span style={{ color: isCompleted ? 'var(--accent)' : 'var(--text-secondary)' }}>
                        {isCompleted ? 'Complété !' : 'Progression'}
                      </span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {q.progress} / {q.target_value}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.01)' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: isCompleted ? 'linear-gradient(90deg, var(--accent) 0%, #a78bfa 100%)' : 'var(--text-secondary)',
                          borderRadius: '10px',
                          transition: 'width 0.4s ease-out'
                        }}
                      />
                    </div>
                  </div>

                  {/* Rewards and Claim Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                    {/* Rewards list */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Gain :</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b' }}>
                        <span>+{q.reward_coins}</span>
                        <span>🪙</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent)' }}>
                        <span>+{q.reward_xp}</span>
                        <span style={{ fontSize: '0.75rem' }}>XP</span>
                      </div>
                    </div>

                    {/* Button */}
                    {q.is_claimed ? (
                      <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                        Réclamé
                      </span>
                    ) : isCompleted ? (
                      <button
                        onClick={() => handleClaimQuest(q.user_quest_id)}
                        disabled={claimingQuestId === q.user_quest_id}
                        className="claim-quest-btn"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          backgroundColor: 'var(--accent)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          boxShadow: '0 0 12px rgba(139, 92, 246, 0.4)',
                          animation: 'pulseGlow 1.8s infinite',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {claimingQuestId === q.user_quest_id ? (
                          <span className="spinner spinner-xs" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                        ) : 'Récupérer'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.02)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        En cours
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. SHOWCASE DECK DE COLLECTION */}
      <div className="collection-showcase" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18} style={{ color: '#ffb300' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Dernières acquisitions</h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }} onClick={() => onOpenCollection()}>
            Voir l'album complet
          </span>
        </div>

        {latestCards.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '24px 16px', justifyContent: 'center' }}>
            {latestCards.map((card) => (
              <GameCard 
                key={card.id} 
                card={card}
                quantity={card.quantity}
                isFoil={true}
                onClick={() => onOpenCollection()}
              />
            ))}
          </div>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '2rem' }}>📦</span>
            <div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 2px 0' }}>Aucune carte dans l'album</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>Accumulez des pièces et achetez vos premiers boosters dans la boutique pour compléter votre collection !</p>
            </div>
            <button className="btn-secondary" style={{ display: 'inline-flex', gap: '4px', fontSize: '0.8rem', padding: '6px 14px', borderRadius: '8px' }} onClick={() => onOpenShop()}>
              <Sparkles size={13} style={{ color: '#ffb300' }} />
              Ouvrir la Boutique
            </button>
          </div>
        )}
      </div>

      {/* 5. PREMIUM CSS STYLES INJECTED */}
      <style>{`
        .dashboard-container {
          --color-purple: #8b5cf6;
          --color-pink: #d946ef;
          --color-orange: #f97316;
          --color-red: #ef4444;
          --color-gold: #f59e0b;
        }

        .dashboard-widget {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(12px);
          border: 1.5px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 20px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        .dashboard-widget:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        }

        .gaming-card {
          position: relative;
          overflow: hidden;
          border-radius: 20px;
          padding: 28px;
          background: rgba(20, 20, 25, 0.65);
          border: 1.5px solid rgba(255, 255, 255, 0.04);
          transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 4px 25px rgba(0, 0, 0, 0.2);
        }

        .gaming-card::before {
          content: '';
          position: absolute;
          top: 0; right: 0; bottom: 0; left: 0;
          opacity: 0.04;
          transition: opacity 0.4s ease;
          pointer-events: none;
        }

        .gaming-card.solo::before {
          background: radial-gradient(circle at top right, var(--color-purple) 0%, transparent 65%);
        }

        .gaming-card.online::before {
          background: radial-gradient(circle at top right, var(--color-orange) 0%, transparent 65%);
        }

        .gaming-card:hover {
          transform: translateY(-6px);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .gaming-card.solo:hover {
          box-shadow: 0 20px 40px rgba(139, 92, 246, 0.12), inset 0 0 15px rgba(139, 92, 246, 0.03);
          border-color: rgba(139, 92, 246, 0.35);
        }

        .gaming-card.online:hover {
          box-shadow: 0 20px 40px rgba(249, 115, 22, 0.12), inset 0 0 15px rgba(249, 115, 22, 0.03);
          border-color: rgba(249, 115, 22, 0.35);
        }

        .card-badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.68rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .card-badge.solo {
          background: rgba(139, 92, 246, 0.1);
          color: #a78bfa;
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .card-badge.online {
          background: rgba(249, 115, 22, 0.1);
          color: #fb923c;
          border: 1px solid rgba(249, 115, 22, 0.2);
        }



        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 12px rgba(139, 92, 246, 0.4); }
          50% { box-shadow: 0 0 24px rgba(139, 92, 246, 0.8); }
        }
      `}</style>
    </div>
  );
}
