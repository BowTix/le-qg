import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { ArrowLeft, Trophy, Calendar, Zap, Skull, ShieldCheck, Gamepad } from 'lucide-react';
import { getLevel, getUsernameStyle } from '../utils/progression';

export default function LeaderboardScreen({ onBack }) {
  const [cachedData] = useState(() => {
    try {
      const cached = localStorage.getItem('cache_leaderboard');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [topPlayers, setTopPlayers] = useState(() => cachedData ? cachedData.top_players || [] : []);
  const [recentMatches, setRecentMatches] = useState(() => cachedData ? cachedData.recent_matches || [] : []);
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    if (!localStorage.getItem('cache_leaderboard')) {
      setLoading(true);
    }
    try {
      const data = await api.get('/quiz/leaderboard');
      setTopPlayers(data.top_players || []);
      setRecentMatches(data.recent_matches || []);
      localStorage.setItem('cache_leaderboard', JSON.stringify(data));
    } catch (err) {
      setError("Impossible de charger les statistiques.");
    } finally {
      setLoading(false);
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

  const getModeColor = (mode) => {
    switch (mode) {
      case 'sudden_death': return 'var(--error)';
      case 'speed_blitz': return '#ffaa00';
      case 'guess_number': return '#00d2ff';
      default: return 'var(--success)';
    }
  };

  // Separate top 3 for the podium
  const podium = topPlayers.slice(0, 3);
  const remainder = topPlayers.slice(3);

  // Map indices for podium rendering order: 2nd place (left), 1st place (center), 3rd place (right)
  const first = podium[0];
  const second = podium[1];
  const third = podium[2];

  return (
    <div className="container animate-slide-up">
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn-secondary" onClick={onBack} style={{ padding: '10px 16px', fontSize: '0.9rem' }}>
          <ArrowLeft size={16} />
          Retour Dashboard
        </button>
        <h2 style={{ fontSize: '1.5rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
          <Trophy size={22} style={{ color: 'var(--accent)' }} />
          Classement du QG
        </h2>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-state">
          <div className="spinner spinner-lg" />
          <div>Chargement du QG...</div>
        </div>
      ) : (
        <>
          {/* Visual Podium Section */}
          {podium.length > 0 && (
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Podium des Champions
              </span>

              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '16px', width: '100%', height: '180px', marginTop: '16px' }}>
                
                {/* 2nd Place (Left) */}
                {second && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
                    <span style={{ ...getUsernameStyle(second.global_score), fontSize: '0.85rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', marginBottom: '6px' }}>{second.username}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '8px' }}>
                      Collection : {second.collection_value || 0} pts
                    </span>
                    <div style={{
                      width: '100%',
                      height: '70px',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px 8px 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.8rem',
                      fontWeight: 800,
                      color: '#b0b5bc'
                    }}>
                      <Trophy size={28} style={{ color: '#b0b5bc' }} />
                    </div>
                  </div>
                )}

                {/* 1st Place (Center) */}
                {first && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%' }}>
                    <span style={{ ...getUsernameStyle(first.global_score), fontSize: '0.95rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', marginBottom: '6px' }}>{first.username}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 800, textShadow: '0 0 10px rgba(255,247,0,0.2)', marginBottom: '8px' }}>
                      Collection : {first.collection_value || 0} pts
                    </span>
                    <div style={{
                      width: '100%',
                      height: '100px',
                      backgroundColor: 'rgba(255,247,0,0.06)',
                      border: '2px solid var(--accent)',
                      borderRadius: '8px 8px 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2.2rem',
                      fontWeight: 800,
                      color: 'var(--accent)',
                      boxShadow: '0 0 20px rgba(255,247,0,0.12)'
                    }}>
                      <Trophy size={36} style={{ color: 'var(--accent)' }} />
                    </div>
                  </div>
                )}

                {/* 3rd Place (Right) */}
                {third && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
                    <span style={{ ...getUsernameStyle(third.global_score), fontSize: '0.85rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', marginBottom: '6px' }}>{third.username}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '8px' }}>
                      Collection : {third.collection_value || 0} pts
                    </span>
                    <div style={{
                      width: '100%',
                      height: '50px',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px 8px 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.6rem',
                      fontWeight: 800,
                      color: '#cd7f32'
                    }}>
                      <Trophy size={22} style={{ color: '#cd7f32' }} />
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Standings list (Positions 4+) */}
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Classement Général
            </span>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {remainder.map((p, idx) => (
                <div 
                  key={p.id} 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-secondary)', width: '20px' }}>#{idx + 4}</span>
                    <span style={{ ...getUsernameStyle(p.global_score), fontWeight: 600 }}>{p.username}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Lvl {getLevel(p.global_score)})</span>
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.85rem' }}>
                    Collection : {p.collection_value || 0} pts
                  </span>
                </div>
              ))}
              
              {remainder.length === 0 && podium.length <= 3 && (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Aucun autre joueur inscrit.
                </div>
              )}
            </div>
          </div>

          {/* Recent Match History Logs */}
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Historique des Matchs Recents
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentMatches.map(m => (
                <div 
                  key={m.id} 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '16px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>🏆 Gagnant : {m.winner_username}</span>
                    
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      color: getModeColor(m.game_mode),
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${getModeColor(m.game_mode)}`
                    }}>
                      {getModeLabel(m.game_mode)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '2px' }}>
                    <span>Thème : <strong style={{ color: 'var(--text-primary)' }}>{m.pack_name}</strong></span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} />
                      {new Date(m.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              {recentMatches.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Aucune partie enregistrée dans l'historique pour le moment.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Spinner keyframes inject */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

