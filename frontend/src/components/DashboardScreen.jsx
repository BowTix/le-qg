import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { LogOut, Trophy, Play, Plus, Users, ShieldAlert, BookOpen } from 'lucide-react';

export default function DashboardScreen({ user, onLogout, onStartSolo, onCreateLobby, onJoinLobby, onOpenAdmin }) {
  const [packs, setPacks] = useState([]);
  const [selectedPackSolo, setSelectedPackSolo] = useState('');
  const [selectedPackLobby, setSelectedPackLobby] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [createError, setCreateError] = useState('');
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

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
      }
    } catch (err) {
      console.error("Failed to fetch packs", err);
    } finally {
      setLoadingPacks(false);
    }
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
    <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header Profile Bar */}
      <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            color: '#12121c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 800
          }}>
            {user.username.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Salut, {user.username} !</h2>
            <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', marginTop: '4px' }}>
              <Trophy size={16} style={{ color: 'var(--accent)' }} />
              Score Global : <strong style={{ color: '#fff' }}>{user.global_score} pts</strong>
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {user.role === 'admin' && (
            <button className="btn-secondary" onClick={onOpenAdmin} style={{ borderColor: 'rgba(255, 59, 105, 0.4)', color: 'var(--error)' }}>
              <ShieldAlert size={18} />
              Admin
            </button>
          )}
          <button className="btn-secondary" onClick={onLogout}>
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', md: '1fr 1fr', gap: '32px', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        
        {/* Solo Training Module */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <BookOpen size={24} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: '1.3rem' }}>Mode Entraînement</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '24px', flexGrow: 1 }}>
            Entraînez-vous en solo sur un pack de questions aléatoires. Pas de temps limite restrictif, parfait pour réviser et gonfler votre score global de 10 points par bonne réponse !
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: 'auto' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Choisir un thème
              </label>
              {loadingPacks ? (
                <div style={{ padding: '12px', color: 'var(--text-secondary)' }}>Chargement des packs...</div>
              ) : (
                <select 
                  value={selectedPackSolo} 
                  onChange={(e) => setSelectedPackSolo(e.target.value)}
                >
                  {packs.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.question_count} Qs)</option>
                  ))}
                </select>
              )}
            </div>
            
            <button 
              className="btn-primary" 
              onClick={handleStartSolo}
              disabled={packs.length === 0}
              style={{ width: '100%' }}
            >
              <Play size={18} />
              Lancer l'Entraînement
            </button>
          </div>
        </div>

        {/* Multiplayer Lobby Module */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Users size={24} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: '1.3rem' }}>Arène Multijoueur</h3>
          </div>
          
          {/* Join Room Box */}
          <form onSubmit={handleJoinLobby} style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Rejoindre un salon</h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                maxLength={5}
                placeholder="CODE (ex: A7Z9B)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                style={{ textTransform: 'uppercase', textAlign: 'center', fontSize: '1.1rem', letterSpacing: '2px', fontWeight: 700 }}
              />
              <button 
                type="submit" 
                className="btn-secondary" 
                style={{ padding: '0 24px' }}
                disabled={joining}
              >
                {joining ? 'Connexion...' : 'Rejoindre'}
              </button>
            </div>
            {joinError && <div style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{joinError}</div>}
          </form>

          {/* Create Room Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Créer une partie</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <select 
                  value={selectedPackLobby} 
                  onChange={(e) => setSelectedPackLobby(e.target.value)}
                >
                  {packs.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.question_count} Qs)</option>
                  ))}
                </select>
              </div>
              <button 
                className="btn-primary" 
                onClick={handleCreateLobby}
                disabled={creating || packs.length === 0}
                style={{ width: '100%' }}
              >
                <Plus size={18} />
                {creating ? 'Création...' : 'Créer un Salon'}
              </button>
            </div>
            {createError && <div style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{createError}</div>}
          </div>
          
        </div>

      </div>
    </div>
  );
}
