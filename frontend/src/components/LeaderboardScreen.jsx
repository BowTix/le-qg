import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, PUBLIC_BASE } from '../utils/api';
import { getLevel } from '../utils/progression';
import {
  ArrowLeft,
  Trophy,
  Crown,
  Medal,
  Calendar,
  Clock,
  Sparkles,
  Zap,
  Grid3X3,
  Boxes,
  Type,
  Swords,
  Search,
  ChevronRight,
  TrendingUp,
  BarChart3,
  History,
  Layers,
  CheckCircle2,
  Gamepad2,
  Coins,
  ArrowRight,
  Flame,
  Shield,
  Star
} from 'lucide-react';
import '../performance.css';

function PlayerAvatar({ player, size = 42, className = '' }) {
  const value = player?.avatar_url;
  const hasBorder = !!player?.equipped_border;
  const borderClass = player?.equipped_border || '';
  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    objectFit: 'cover',
    border: hasBorder ? undefined : 'none',
    boxShadow: hasBorder ? undefined : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: size > 50 ? '1.4rem' : '1rem',
    background: '#334155',
    color: '#fff',
    flexShrink: 0
  };

  if (value?.startsWith('/uploads/')) {
    return <img src={`${PUBLIC_BASE}${value}`} alt="" className={`${borderClass} ${className}`.trim()} style={style} />;
  }
  if (value?.startsWith('http')) {
    return <img src={value} alt="" className={`${borderClass} ${className}`.trim()} style={style} />;
  }
  return (
    <span className={`${borderClass} ${className}`.trim()} style={style}>
      {value || player?.username?.[0]?.toUpperCase() || 'U'}
    </span>
  );
}

function formatDateFriendly(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0 && now.getDate() === date.getDate()) {
    return `Aujourd'hui à ${timeStr}`;
  }
  if (diffDays <= 1) {
    return `Hier à ${timeStr}`;
  }
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function LeaderboardScreen({ user, onBack }) {
  const navigate = useNavigate();

  // Navigation tabs: 'classement' | 'historique' | 'stats'
  const [activeTab, setActiveTab] = useState('classement');

  // Sub-filter for leaderboard: 'collection' | 'score' | 'logic'
  const [leaderboardFilter, setLeaderboardFilter] = useState('collection');

  // Sub-filter for history: 'all' | 'daily_quiz' | 'logic' | 'arena'
  const [historyFilter, setHistoryFilter] = useState('all');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topPlayers, setTopPlayers] = useState([]);
  const [topScore, setTopScore] = useState([]);
  const [topLogic, setTopLogic] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/quiz/leaderboard');
      setTopPlayers(data.top_players || []);
      setTopScore(data.top_score || []);
      setTopLogic(data.top_logic || []);
      setUserStats(data.user_stats || null);
      setUserHistory(data.user_history || []);
      setRecentMatches(data.recent_matches || []);
    } catch (err) {
      console.error('Failed to load performance data:', err);
      setError("Impossible de charger les statistiques de performance.");
    } finally {
      setLoading(false);
    }
  };

  // Active ranking list based on filter
  const currentRankingList = useMemo(() => {
    let list = [];
    if (leaderboardFilter === 'collection') list = topPlayers;
    else if (leaderboardFilter === 'score') list = topScore;
    else if (leaderboardFilter === 'logic') list = topLogic;

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter((p) => p.username?.toLowerCase().includes(q));
  }, [leaderboardFilter, topPlayers, topScore, topLogic, searchQuery]);

  // Podium (Top 3) and Remainder (4+)
  const { first, second, third, remainder } = useMemo(() => {
    if (searchQuery.trim()) {
      return {
        first: currentRankingList[0] || null,
        second: currentRankingList[1] || null,
        third: currentRankingList[2] || null,
        remainder: currentRankingList.slice(3)
      };
    }
    return {
      first: currentRankingList[0] || null,
      second: currentRankingList[1] || null,
      third: currentRankingList[2] || null,
      remainder: currentRankingList.slice(3)
    };
  }, [currentRankingList, searchQuery]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return userHistory;
    if (historyFilter === 'daily_quiz') return userHistory.filter((h) => h.type === 'daily_quiz');
    if (historyFilter === 'logic') return userHistory.filter((h) => ['queens', 'sudoku', 'shikaku', 'mystery_word'].includes(h.type));
    if (historyFilter === 'arena') return [];
    return userHistory;
  }, [userHistory, historyFilter]);

  // Helper to format ranking metric
  const formatMetric = (player, filterType) => {
    if (filterType === 'collection') {
      return `${(player.collection_value || 0).toLocaleString()} pts`;
    }
    if (filterType === 'score') {
      return `${(player.global_score || 0).toLocaleString()} pts`;
    }
    if (filterType === 'logic') {
      const count = player.puzzles_solved || 0;
      return `${count} ${count > 1 ? 'résolus' : 'résolu'}`;
    }
    return '';
  };

  // Helper for game icons & colors
  const getGameIcon = (type) => {
    switch (type) {
      case 'queens':
        return <Crown size={20} />;
      case 'sudoku':
        return <Grid3X3 size={20} />;
      case 'shikaku':
        return <Boxes size={20} />;
      case 'mystery_word':
        return <Type size={20} />;
      case 'daily_quiz':
        return <Zap size={20} />;
      default:
        return <Swords size={20} />;
    }
  };

  const getModeLabel = (mode) => {
    switch (mode) {
      case 'sudden_death': return 'Mort Subite';
      case 'speed_blitz': return 'Blitz (5s)';
      case 'guess_number': return 'Juste Nombre';
      default: return 'Classique';
    }
  };

  return (
    <div className="perf-container animate-slide-up">
      {/* 1. Header Bar */}
      <header className="perf-header">
        <div className="perf-header__title-group">
          <div className="perf-header__icon-box">
            <Trophy size={26} />
          </div>
          <div>
            <h1 className="perf-header__title">Espace Performance</h1>
            <p className="perf-header__subtitle">
              Classements officiels, statistiques personnelles & historique complet
            </p>
          </div>
        </div>

        <button className="btn-secondary" onClick={onBack} style={{ padding: '8px 16px', fontSize: '0.88rem' }}>
          <ArrowLeft size={16} />
          Retour Accueil
        </button>
      </header>

      {/* 2. Top KPI Cards Strip */}
      <div className="perf-kpi-grid">
        <div className="perf-kpi-card">
          <div className="perf-kpi-card__icon perf-kpi-card__icon--gold">
            <Medal size={22} />
          </div>
          <div className="perf-kpi-card__content">
            <span className="perf-kpi-card__label">Rang Collection</span>
            <span className="perf-kpi-card__value">
              #{userStats?.collection_rank || 1}
            </span>
            <span className="perf-kpi-card__sub">
              {userStats?.collection_value?.toLocaleString() || 0} pts ({userStats?.cards_count || 0} cartes)
            </span>
          </div>
        </div>

        <div className="perf-kpi-card">
          <div className="perf-kpi-card__icon perf-kpi-card__icon--cyan">
            <Zap size={22} />
          </div>
          <div className="perf-kpi-card__content">
            <span className="perf-kpi-card__label">Rang Quiz Omnia</span>
            <span className="perf-kpi-card__value">
              #{userStats?.score_rank || 1}
            </span>
            <span className="perf-kpi-card__sub">
              Score total : {(user?.global_score || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="perf-kpi-card">
          <div className="perf-kpi-card__icon perf-kpi-card__icon--purple">
            <Sparkles size={22} />
          </div>
          <div className="perf-kpi-card__content">
            <span className="perf-kpi-card__label">Puzzles Résolus</span>
            <span className="perf-kpi-card__value">
              {userStats?.total_puzzles_solved || 0}
            </span>
            <span className="perf-kpi-card__sub">
              Quotidiennes & Défis réussis
            </span>
          </div>
        </div>

        <div className="perf-kpi-card">
          <div className="perf-kpi-card__icon perf-kpi-card__icon--emerald">
            <Swords size={22} />
          </div>
          <div className="perf-kpi-card__content">
            <span className="perf-kpi-card__label">Victoires Arène</span>
            <span className="perf-kpi-card__value">
              {userStats?.multi_wins || 0}
            </span>
            <span className="perf-kpi-card__sub">
              Matchs multijoueurs remportés
            </span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <nav className="perf-tabs" aria-label="Navigation des performances">
        <button
          className={`perf-tab-btn ${activeTab === 'classement' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('classement')}
        >
          <Trophy size={17} />
          <span>Classements</span>
          <span className="perf-tab-badge">Top 30</span>
        </button>

        <button
          className={`perf-tab-btn ${activeTab === 'historique' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('historique')}
        >
          <History size={17} />
          <span>Historique des Parties</span>
          <span className="perf-tab-badge">{userHistory.length + recentMatches.length}</span>
        </button>

        <button
          className={`perf-tab-btn ${activeTab === 'stats' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <BarChart3 size={17} />
          <span>Bilan & Statistiques</span>
        </button>
      </nav>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-state" style={{ minHeight: '320px' }}>
          <div className="spinner spinner-lg" />
          <p style={{ marginTop: '12px', color: '#94a3b8' }}>Chargement des données de performance…</p>
        </div>
      ) : (
        <>
          {/* =========================================================================
              TAB 1: CLASSEMENTS
              ========================================================================= */}
          {activeTab === 'classement' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Filters & Search */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div className="perf-subfilters">
                  <button
                    className={`perf-filter-pill ${leaderboardFilter === 'collection' ? 'is-active' : ''}`}
                    onClick={() => setLeaderboardFilter('collection')}
                  >
                    <Layers size={14} />
                    <span>Collection de Cartes</span>
                  </button>

                  <button
                    className={`perf-filter-pill ${leaderboardFilter === 'score' ? 'is-active' : ''}`}
                    onClick={() => setLeaderboardFilter('score')}
                  >
                    <Zap size={14} />
                    <span>Score Quiz Global</span>
                  </button>

                  <button
                    className={`perf-filter-pill ${leaderboardFilter === 'logic' ? 'is-active' : ''}`}
                    onClick={() => setLeaderboardFilter('logic')}
                  >
                    <Sparkles size={14} />
                    <span>Maîtres des Puzzles</span>
                  </button>
                </div>

                <div style={{ position: 'relative', minWidth: '220px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Chercher un joueur..."
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      borderRadius: '999px',
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      color: '#f8fafc',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>

              {/* Podium Showcase (Top 3) */}
              {!searchQuery && (first || second || third) && (
                <div className="perf-podium-card">
                  <span className="perf-podium-header">
                    <Crown size={18} />
                    Podium des Champions
                  </span>

                  <div className="perf-podium-stage">
                    {/* 2nd Place (Silver) */}
                    {second && (
                      <div className="perf-podium-col perf-podium-col--2">
                        <div className="perf-podium-avatar-wrapper">
                          <PlayerAvatar player={second} size={64} className="perf-podium-avatar" />
                          <span className="perf-podium-rank-badge">2</span>
                        </div>
                        <button className="perf-podium-name" onClick={() => navigate(`/joueur/${second.id}`)}>
                          {second.username}
                        </button>
                        <span className="perf-podium-title">
                          {second.equipped_title || `Niveau ${getLevel(second.global_score)}`}
                        </span>
                        <span className="perf-podium-score">
                          {formatMetric(second, leaderboardFilter)}
                        </span>
                        <div className="perf-podium-pedestal">2</div>
                      </div>
                    )}

                    {/* 1st Place (Gold) */}
                    {first && (
                      <div className="perf-podium-col perf-podium-col--1">
                        <div className="perf-podium-avatar-wrapper">
                          <Crown size={28} className="perf-podium-crown" />
                          <PlayerAvatar player={first} size={78} className="perf-podium-avatar" />
                          <span className="perf-podium-rank-badge">1</span>
                        </div>
                        <button className="perf-podium-name" onClick={() => navigate(`/joueur/${first.id}`)}>
                          {first.username}
                        </button>
                        <span className="perf-podium-title">
                          {first.equipped_title || `Niveau ${getLevel(first.global_score)}`}
                        </span>
                        <span className="perf-podium-score">
                          {formatMetric(first, leaderboardFilter)}
                        </span>
                        <div className="perf-podium-pedestal">1</div>
                      </div>
                    )}

                    {/* 3rd Place (Bronze) */}
                    {third && (
                      <div className="perf-podium-col perf-podium-col--3">
                        <div className="perf-podium-avatar-wrapper">
                          <PlayerAvatar player={third} size={64} className="perf-podium-avatar" />
                          <span className="perf-podium-rank-badge">3</span>
                        </div>
                        <button className="perf-podium-name" onClick={() => navigate(`/joueur/${third.id}`)}>
                          {third.username}
                        </button>
                        <span className="perf-podium-title">
                          {third.equipped_title || `Niveau ${getLevel(third.global_score)}`}
                        </span>
                        <span className="perf-podium-score">
                          {formatMetric(third, leaderboardFilter)}
                        </span>
                        <div className="perf-podium-pedestal">3</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Current User Highlight Banner */}
              {user && (
                <div className="perf-my-rank-banner">
                  <div className="perf-my-rank-left">
                    <span className="perf-my-rank-badge">
                      #{leaderboardFilter === 'collection'
                        ? (userStats?.collection_rank || 1)
                        : (userStats?.score_rank || 1)}
                    </span>
                    <div className="perf-my-rank-info">
                      <span className="perf-my-rank-title">Votre position actuelle</span>
                      <span className="perf-my-rank-desc">
                        {leaderboardFilter === 'collection' && `${userStats?.collection_value?.toLocaleString() || 0} pts de collection · ${userStats?.cards_count || 0} cartes`}
                        {leaderboardFilter === 'score' && `${(user?.global_score || 0).toLocaleString()} points XP Quiz`}
                        {leaderboardFilter === 'logic' && `${userStats?.total_puzzles_solved || 0} quotidiennes et énigmes résolues`}
                      </span>
                    </div>
                  </div>

                  <span className="perf-my-rank-score">
                    {leaderboardFilter === 'collection' && `${(userStats?.collection_value || 0).toLocaleString()} pts`}
                    {leaderboardFilter === 'score' && `${(user?.global_score || 0).toLocaleString()} pts`}
                    {leaderboardFilter === 'logic' && `${userStats?.total_puzzles_solved || 0} résolus`}
                  </span>
                </div>
              )}

              {/* Ranks Table (Places 4+) */}
              <div className="perf-table-card">
                <div className="perf-table-header">
                  <span>Joueur</span>
                  <span>
                    {leaderboardFilter === 'collection' && 'Valeur Collection'}
                    {leaderboardFilter === 'score' && 'Score Global'}
                    {leaderboardFilter === 'logic' && 'Puzzles Résolus'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {remainder.map((player, idx) => {
                    const rank = idx + 4;
                    const isMe = player.id === user?.id;

                    return (
                      <div key={player.id} className={`perf-row ${isMe ? 'is-me' : ''}`}>
                        <div className="perf-row__left">
                          <span className="perf-row__rank">#{rank}</span>
                          <PlayerAvatar player={player} size={38} className="perf-row__avatar" />
                          <div className="perf-row__player-info">
                            <div className="perf-row__name-line">
                              <button className="perf-row__name" onClick={() => navigate(`/joueur/${player.id}`)}>
                                {player.username}
                              </button>
                              <span className="perf-row__lvl-badge">Lvl {getLevel(player.global_score)}</span>
                              {isMe && <span className="perf-row__you-badge">VOUS</span>}
                            </div>
                            <span className="perf-row__title">
                              {player.equipped_title || (leaderboardFilter === 'collection' ? `${player.cards_count || 0} cartes` : '')}
                            </span>
                          </div>
                        </div>

                        <div className="perf-row__right">
                          <span className="perf-row__score">
                            {formatMetric(player, leaderboardFilter)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {remainder.length === 0 && (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                      {searchQuery ? "Aucun joueur ne correspond à votre recherche." : "Aucun autre joueur classé pour le moment."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: HISTORIQUE DES PARTIES
              ========================================================================= */}
          {activeTab === 'historique' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* History Subfilters */}
              <div className="perf-subfilters">
                <button
                  className={`perf-filter-pill ${historyFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setHistoryFilter('all')}
                >
                  <History size={14} />
                  <span>Toutes mes parties ({userHistory.length})</span>
                </button>

                <button
                  className={`perf-filter-pill ${historyFilter === 'daily_quiz' ? 'is-active' : ''}`}
                  onClick={() => setHistoryFilter('daily_quiz')}
                >
                  <Zap size={14} />
                  <span>Quiz Quotidiens</span>
                </button>

                <button
                  className={`perf-filter-pill ${historyFilter === 'logic' ? 'is-active' : ''}`}
                  onClick={() => setHistoryFilter('logic')}
                >
                  <Grid size={14} />
                  <span>Jeux de Logique</span>
                </button>

                <button
                  className={`perf-filter-pill ${historyFilter === 'arena' ? 'is-active' : ''}`}
                  onClick={() => setHistoryFilter('arena')}
                >
                  <Swords size={14} />
                  <span>Matchs de l'Arène ({recentMatches.length})</span>
                </button>
              </div>

              {/* Personal Games History */}
              {historyFilter !== 'arena' && (
                <div className="perf-history-list">
                  {filteredHistory.map((h, idx) => {
                    const isWin = !!h.success;
                    const durationStr = formatDuration(h.time_spent);

                    return (
                      <div key={idx} className="perf-history-item">
                        <div className="perf-history-item__left">
                          <div className={`perf-game-icon-box perf-game-icon-box--${h.type}`}>
                            {getGameIcon(h.type)}
                          </div>
                          <div className="perf-history-item__meta">
                            <div className="perf-history-item__title-row">
                              <span className="perf-history-item__title">{h.game_title}</span>
                              <span className={`perf-history-item__badge ${isWin ? 'perf-history-item__badge--success' : 'perf-history-item__badge--warn'}`}>
                                {isWin ? 'Résolu / Victoire' : 'Partie terminée'}
                              </span>
                            </div>
                            <span className="perf-history-item__date">
                              <Calendar size={13} />
                              {formatDateFriendly(h.created_at || h.played_date)}
                            </span>
                          </div>
                        </div>

                        <div className="perf-history-item__right">
                          {durationStr && (
                            <span className="perf-history-stat-tag">
                              <Clock size={13} />
                              Chrono : <strong>{durationStr}</strong>
                            </span>
                          )}

                          {h.score > 0 && (
                            <span className="perf-history-stat-tag" style={{ color: '#fbbf24' }}>
                              <Star size={13} />
                              +<strong>{h.score}</strong> pts
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {filteredHistory.length === 0 && (
                    <div className="perf-empty-state glass-card">
                      <Gamepad2 size={40} style={{ color: '#64748b' }} />
                      <h4>Aucune partie enregistrée</h4>
                      <p>
                        Vous n'avez pas encore terminé de défi dans cette catégorie. Lancez une grille quotidienne ou un quiz pour remplir votre historique !
                      </p>
                      <button className="btn-primary" onClick={() => navigate('/dashboard')} style={{ marginTop: '8px' }}>
                        Découvrir les jeux du jour
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Arena Matches List */}
              {historyFilter === 'arena' && (
                <div className="perf-history-list">
                  {recentMatches.map((m) => (
                    <div key={m.id} className="perf-history-item">
                      <div className="perf-history-item__left">
                        <div className="perf-game-icon-box perf-game-icon-box--arena">
                          <Swords size={20} />
                        </div>
                        <div className="perf-history-item__meta">
                          <div className="perf-history-item__title-row">
                            <span className="perf-history-item__title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Trophy size={15} style={{ color: '#fbbf24' }} /> Vainqueur : <strong>{m.winner_username}</strong>
                            </span>
                            <span className="perf-history-item__badge perf-history-item__badge--warn">
                              {getModeLabel(m.game_mode)}
                            </span>
                          </div>
                          <span className="perf-history-item__date">
                            Thème : <strong style={{ color: '#e2e8f0', marginLeft: '4px', marginRight: '8px' }}>{m.pack_name}</strong> ·
                            <Calendar size={13} style={{ marginLeft: '6px' }} />
                            {formatDateFriendly(m.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="perf-history-item__right">
                        <span className="perf-history-stat-tag">
                          Salle #{m.room_code}
                        </span>
                      </div>
                    </div>
                  ))}

                  {recentMatches.length === 0 && (
                    <div className="perf-empty-state glass-card">
                      <Swords size={40} style={{ color: '#64748b' }} />
                      <h4>Aucun match d'arène récent</h4>
                      <p>L'arène multijoueur est prête pour vos affrontements !</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 3: BILAN & STATISTIQUES PERSONNELLES
              ========================================================================= */}
          {activeTab === 'stats' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="perf-stats-grid">
                {/* Breakdown per game */}
                <div className="perf-stats-box">
                  <span className="perf-stats-box__title">
                    <Grid3X3 size={18} style={{ color: '#2dd4bf' }} />
                    Détail des Quotidiennes Résolues
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="perf-game-breakdown-row">
                      <div className="perf-game-breakdown-left">
                        <Crown size={16} color="#f59e0b" />
                        <span>Queens (Couronnes)</span>
                      </div>
                      <span className="perf-game-breakdown-count">{userStats?.queens_count || 0}</span>
                    </div>

                    <div className="perf-game-breakdown-row">
                      <div className="perf-game-breakdown-left">
                        <Grid3X3 size={16} color="#a855f7" />
                        <span>Sudoku 9x9</span>
                      </div>
                      <span className="perf-game-breakdown-count">{userStats?.sudoku_count || 0}</span>
                    </div>

                    <div className="perf-game-breakdown-row">
                      <div className="perf-game-breakdown-left">
                        <Boxes size={16} color="#818cf8" />
                        <span>Shikaku (Rectangles)</span>
                      </div>
                      <span className="perf-game-breakdown-count">{userStats?.shikaku_count || 0}</span>
                    </div>

                    <div className="perf-game-breakdown-row">
                      <div className="perf-game-breakdown-left">
                        <Type size={16} color="#10b981" />
                        <span>Mot Mystère (Wordle)</span>
                      </div>
                      <span className="perf-game-breakdown-count">{userStats?.mystery_word_count || 0}</span>
                    </div>

                    <div className="perf-game-breakdown-row">
                      <div className="perf-game-breakdown-left">
                        <Zap size={16} color="#06b6d4" />
                        <span>Quiz du Jour</span>
                      </div>
                      <span className="perf-game-breakdown-count">{userStats?.daily_quiz_count || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Profile Milestones & Overview */}
                <div className="perf-stats-box">
                  <span className="perf-stats-box__title">
                    <TrendingUp size={18} style={{ color: '#fbbf24' }} />
                    Profil Compétitif
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="perf-game-breakdown-row">
                      <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Niveau de Joueur</span>
                      <strong style={{ color: '#f8fafc', fontFamily: 'Space Grotesk' }}>
                        Niveau {getLevel(user?.global_score)}
                      </strong>
                    </div>

                    <div className="perf-game-breakdown-row">
                      <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Total Points XP</span>
                      <strong style={{ color: '#fbbf24', fontFamily: 'Space Grotesk' }}>
                        {(user?.global_score || 0).toLocaleString()} pts
                      </strong>
                    </div>

                    <div className="perf-game-breakdown-row">
                      <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Valeur du Deck de Cartes</span>
                      <strong style={{ color: '#5eead4', fontFamily: 'Space Grotesk' }}>
                        {(userStats?.collection_value || 0).toLocaleString()} pts
                      </strong>
                    </div>

                    <div className="perf-game-breakdown-row">
                      <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Cartes Rares & Supérieures</span>
                      <strong style={{ color: '#c084fc', fontFamily: 'Space Grotesk' }}>
                        {userStats?.cards_count || 0} cartes débloquées
                      </strong>
                    </div>

                    <div className="perf-game-breakdown-row">
                      <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Titres & Cosmétiques</span>
                      <strong style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                        {user?.equipped_title ? `« ${user.equipped_title} »` : 'Aucun titre'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Launch Banner */}
              <div className="perf-shortcut-banner">
                <div className="perf-shortcut-left">
                  <h3>Prêt pour votre prochain défi ?</h3>
                  <p>Améliorez votre classement en résolvant les grilles et quiz du jour !</p>
                </div>
                <div className="perf-shortcut-btns">
                  <button className="btn-primary" onClick={() => navigate('/solo/queens')}>
                    <Crown size={15} /> Queens
                  </button>
                  <button className="btn-primary" onClick={() => navigate('/solo/sudoku')}>
                    <Grid3X3 size={15} /> Sudoku
                  </button>
                  <button className="btn-primary" onClick={() => navigate('/solo/shikaku')}>
                    <Boxes size={15} /> Shikaku
                  </button>
                  <button className="btn-primary" onClick={() => navigate('/quiz/jour')}>
                    <Zap size={15} /> Quiz du Jour
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
