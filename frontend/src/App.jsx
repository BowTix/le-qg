import React, { useEffect, useState } from 'react';
import AuthScreen from './components/AuthScreen';
import DashboardScreen from './components/DashboardScreen';
import SoloQuizScreen from './components/SoloQuizScreen';
import MultiplayerArena from './components/MultiplayerArena';
import AdminScreen from './components/AdminScreen';
import CreatorScreen from './components/CreatorScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import ProfileScreen from './components/ProfileScreen';
import { api, PUBLIC_BASE } from './utils/api';
import { Trophy, Plus, User, LogOut, ShieldAlert, ChevronDown, Sun, Moon, Coins, Gamepad2 } from 'lucide-react';
import { getEloRank } from './utils/progression';

export default function App() {
  const [view, setView] = useState('auth');
  const [user, setUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = () => setShowDropdown(false);
    if (showDropdown) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [showDropdown]);

  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('quiz_theme') || 'dark';
  });

  // Sync theme to <html> attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('quiz_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Navigation state
  const [soloPackId, setSoloPackId] = useState(null);
  const [roomCode, setRoomCode] = useState('');

  // 1. Restore Auth Session on Mount
  useEffect(() => {
    const savedToken = localStorage.getItem('quiz_token');
    const savedUser = localStorage.getItem('quiz_user');

    if (savedToken && savedUser) {
      setUser(JSON.parse(savedUser));
      setView('dashboard');
    }

    const handleSessionExpired = () => {
      setUser(null);
      setView('auth');
    };
    window.addEventListener('auth_session_expired', handleSessionExpired);
    return () => window.removeEventListener('auth_session_expired', handleSessionExpired);
  }, []);

  // 2. Auto-Refresh profile stats on dashboard entry
  useEffect(() => {
    if (view === 'dashboard') {
      const refreshProfile = async () => {
        try {
          const res = await api.get('/auth/profile');
          if (res.success && res.user) {
            setUser(res.user);
            localStorage.setItem('quiz_user', JSON.stringify(res.user));
          }
        } catch (err) {
          console.error('Failed to refresh user profile statistics:', err);
        }
      };
      refreshProfile();
    }
  }, [view]);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    setView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('quiz_token');
    localStorage.removeItem('quiz_user');
    setUser(null);
    setView('auth');
  };

  const updateUserStats = (stats) => {
    if (user) {
      const updatedUser = { ...user, ...stats };
      setUser(updatedUser);
      localStorage.setItem('quiz_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <div className="layout-page">

      {/* Animated shimmer accent bar at top */}
      <div className="accent-bar" />

      {/* ── Global Header ── */}
      <header className="header-nav">

        {/* Logo */}
        <div
          className="header-logo"
          onClick={() => user && setView('dashboard')}
          style={{ cursor: user ? 'pointer' : 'default' }}
        >
          <Gamepad2 size={22} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span>LE QG</span>
        </div>

        {/* Right-side actions */}
        <div className="header-actions">

          {user && view !== 'auth' && (
            <>
              {/* Nav shortcuts */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="btn-secondary"
                  onClick={() => setView('leaderboard')}
                  style={{ padding: '7px 12px', fontSize: '0.825rem' }}
                  title="Classement"
                >
                  <Trophy size={14} style={{ color: 'var(--accent)' }} />
                  <span className="hide-mobile">Classement</span>
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setView('creator')}
                  style={{ padding: '7px 12px', fontSize: '0.825rem' }}
                  title="Créer un thème"
                >
                  <Plus size={14} style={{ color: 'var(--accent)' }} />
                  <span className="hide-mobile">Créer Thème</span>
                </button>
              </div>

              {/* Stats pill */}
              <div className="header-stats">
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }} title="Pièces">
                  <Coins size={14} style={{ color: '#f59e0b' }} />
                  <span>{user.coins || 0}</span>
                </span>
                {(() => {
                  const rank = getEloRank(user.elo);
                  return (
                    <span
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', color: rank.color, textShadow: rank.glow }}
                      title={`${user.elo} Elo — ${rank.name}`}
                    >
                      <Trophy size={14} style={{ color: rank.color }} />
                      <span>{rank.name}</span>
                    </span>
                  );
                })()}
              </div>
            </>
          )}

          {/* Theme toggle — only when logged out */}
          {!user && (
            <button className="btn-icon" onClick={toggleTheme} title="Changer de thème">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          )}

          {/* Profile dropdown */}
          {user && view !== 'auth' && (
            <div style={{ position: 'relative' }}>
              {/* Avatar trigger */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                  padding: '4px 8px', borderRadius: '10px',
                  border: '1.5px solid var(--border-color)',
                  background: 'var(--bg-hover)',
                  transition: 'var(--transition)'
                }}
                onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
              >
                {user.avatar_url ? (
                  user.avatar_url.startsWith('/uploads/') ? (
                    <img src={`${PUBLIC_BASE}${user.avatar_url}`} alt="Avatar" className="avatar" style={{ width: '28px', height: '28px' }} />
                  ) : user.avatar_url.startsWith('http') ? (
                    <img src={user.avatar_url} alt="Avatar" className="avatar" style={{ width: '28px', height: '28px' }} />
                  ) : (
                    <div className="avatar-placeholder" style={{ width: '28px', height: '28px', fontSize: '1rem' }}>{user.avatar_url}</div>
                  )
                ) : (
                  <div className="avatar-placeholder" style={{ width: '28px', height: '28px' }}>
                    <User size={14} />
                  </div>
                )}
                <ChevronDown size={13} style={{ color: 'var(--text-secondary)' }} />
              </div>

              {/* Dropdown */}
              {showDropdown && (
                <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                  <div className="dropdown-header">
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }} className="truncate">
                      {user.username}
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.78rem' }}>#{user.discriminator}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {user.role === 'admin' ? 'Administrateur' : 'Joueur'}
                    </div>
                  </div>

                  {user.role === 'admin' && (
                    <button className="dropdown-item danger" onClick={() => { setView('admin'); setShowDropdown(false); }}>
                      <ShieldAlert size={14} />
                      Espace Admin
                    </button>
                  )}

                  <button className="dropdown-item" onClick={() => { setView('profile'); setShowDropdown(false); }}>
                    <User size={14} style={{ color: 'var(--accent)' }} />
                    Mon Profil
                  </button>

                  <button className="dropdown-item" onClick={() => toggleTheme()}>
                    {theme === 'dark'
                      ? <Sun size={14} style={{ color: 'var(--accent)' }} />
                      : <Moon size={14} style={{ color: 'var(--accent)' }} />
                    }
                    {theme === 'dark' ? 'Mode Clair' : 'Mode Sombre'}
                  </button>

                  <div className="dropdown-divider" />

                  <button className="dropdown-item" onClick={() => { handleLogout(); setShowDropdown(false); }}>
                    <LogOut size={14} />
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Main Content Router ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        {view === 'auth' && (
          <AuthScreen onAuthSuccess={handleAuthSuccess} />
        )}

        {view === 'dashboard' && user && (
          <DashboardScreen
            user={user}
            onLogout={handleLogout}
            onStartSolo={(packId) => { setSoloPackId(packId); setView('solo'); }}
            onCreateLobby={(code) => { setRoomCode(code); setView('lobby'); }}
            onJoinLobby={(code) => { setRoomCode(code); setView('lobby'); }}
            onOpenAdmin={() => setView('admin')}
            onOpenCreator={() => setView('creator')}
            onOpenLeaderboard={() => setView('leaderboard')}
            onOpenProfile={() => setView('profile')}
          />
        )}

        {view === 'solo' && (
          <SoloQuizScreen
            packId={soloPackId}
            onBack={() => setView('dashboard')}
            onUpdateUserStats={updateUserStats}
          />
        )}

        {view === 'lobby' && user && (
          <MultiplayerArena
            roomCode={roomCode}
            user={user}
            onBack={() => setView('dashboard')}
          />
        )}

        {view === 'admin' && (
          <AdminScreen onBack={() => setView('dashboard')} />
        )}

        {view === 'creator' && (
          <CreatorScreen onBack={() => setView('dashboard')} />
        )}

        {view === 'leaderboard' && (
          <LeaderboardScreen onBack={() => setView('dashboard')} />
        )}

        {view === 'profile' && user && (
          <ProfileScreen
            user={user}
            onBack={() => setView('dashboard')}
            onUpdateUserStats={updateUserStats}
          />
        )}
      </main>
    </div>
  );
}
