import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import AuthScreen from './components/AuthScreen';
import DashboardScreen from './components/DashboardScreen';
import SoloQuizScreen from './components/SoloQuizScreen';
import MultiplayerArena from './components/MultiplayerArena';
import AdminScreen from './components/AdminScreen';
import CreatorScreen from './components/CreatorScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import ProfileScreen from './components/ProfileScreen';
import DailyQuizScreen from './components/DailyQuizScreen';
import ShopScreen from './components/ShopScreen';
import { api, PUBLIC_BASE } from './utils/api';
import {
  User,
  LogOut,
  ShieldAlert,
  ChevronDown,
  Sun,
  Moon,
  Gem,
  CircleHelp,
} from 'lucide-react';
import { getLevel } from './utils/progression';

// ── Protected Route wrapper ─────────────────────────────────────────────────
// authLoading=true means we haven't checked localStorage yet → don't redirect
function PrivateRoute({ user, authLoading, children }) {
  if (authLoading) return null; // wait silently, no flash
  if (!user) return <Navigate to="/" replace />;
  return children;
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // true until localStorage check done
  const [showDropdown, setShowDropdown] = useState(false);
  const [dailyStatus, setDailyStatus] = useState({ scheduled: false, completed: false });

  // Navigation params passed via router state
  const { soloPackId, soloGameMode, roomCode } = location.state || {};

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
    return localStorage.getItem('quiz_theme') || 'light';
  });

  // Sync theme to <html> attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('quiz_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // 1. Restore Auth Session on Mount
  useEffect(() => {
    const savedToken = localStorage.getItem('quiz_token');
    const savedUser = localStorage.getItem('quiz_user');

    if (savedToken && savedUser) {
      setUser(JSON.parse(savedUser));
      // Only redirect to /dashboard if we landed on the auth page itself
      if (location.pathname === '/') {
        navigate('/dashboard', { replace: true });
      }
      // Otherwise stay on the current URL (e.g. /boutique after F5)
    }

    // Mark auth check as done — PrivateRoute can now make decisions
    setAuthLoading(false);

    const handleSessionExpired = () => {
      setUser(null);
      navigate('/', { replace: true });
    };
    window.addEventListener('auth_session_expired', handleSessionExpired);
    return () => window.removeEventListener('auth_session_expired', handleSessionExpired);
  }, []);

  // 2. Auto-Refresh profile stats when on dashboard
  useEffect(() => {
    if (location.pathname === '/dashboard' && user) {
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
  }, [location.pathname]);

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

  useEffect(() => {
    if (user) {
      fetchDailyStatus();
    }
  }, [user, location.pathname]);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    navigate('/dashboard', { replace: true });
  };

  const handleLogout = () => {
    localStorage.removeItem('quiz_token');
    localStorage.removeItem('quiz_user');
    setUser(null);
    navigate('/', { replace: true });
  };

  const updateUserStats = (stats) => {
    if (user) {
      const updatedUser = { ...user, ...stats };
      setUser(updatedUser);
      localStorage.setItem('quiz_user', JSON.stringify(updatedUser));
    }
  };

  const isAuth = location.pathname === '/';

  return (
    <div className="layout-page" style={{ background: 'transparent', minHeight: '100vh' }}>

      {/* ── Global CSS for floating background blobs ── */}
      <style>{`
        @keyframes floatTeal {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(120px, -80px) scale(1.25); }
          66% { transform: translate(-70px, 50px) scale(0.85); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes floatFuchsia {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(-100px, 120px) scale(0.8); }
          66% { transform: translate(90px, -70px) scale(1.3); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes floatAmber {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(80px, 90px) scale(1.25); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
      `}</style>

      {/* ── Global Fixed Background ── */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: '#0f172a',
          zIndex: -2,
          pointerEvents: 'none',
        }}
      />
      {/* Ambient glowing blobs */}
      <div
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          left: '-8rem',
          top: '10rem',
          width: '430px',
          height: '430px',
          borderRadius: '50%',
          background: 'rgba(45,212,191,0.18)',
          filter: 'blur(140px)',
          zIndex: -1,
          animation: 'floatTeal 15s infinite ease-in-out',
        }}
      />
      <div
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          right: '-8rem',
          top: '-6rem',
          width: '460px',
          height: '460px',
          borderRadius: '50%',
          background: 'rgba(217,70,239,0.18)',
          filter: 'blur(150px)',
          zIndex: -1,
          animation: 'floatFuchsia 18s infinite ease-in-out',
        }}
      />
      <div
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          bottom: 0,
          left: '30%',
          width: '350px',
          height: '350px',
          borderRadius: '50%',
          background: 'rgba(251,191,36,0.09)',
          filter: 'blur(140px)',
          zIndex: -1,
          animation: 'floatAmber 13s infinite ease-in-out',
        }}
      />

      {/* ── Global Header ── */}
      {user && !isAuth && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '64px',
            padding: '0 20px',
            margin: '12px 16px 0',
            borderRadius: '18px',
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'rgba(15,23,42,0.72)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(2,6,23,0.28)',
            position: 'sticky',
            top: '12px',
            zIndex: 100,
          }}
        >
          {/* Logo */}
          <div
            onClick={() => navigate('/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <div
              style={{
                width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '11px',
                background: '#2dd4bf',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: '14px',
                  fontWeight: 800,
                  letterSpacing: '-0.08em',
                  color: '#062a2b',
                }}
              >
                QG
              </span>
            </div>
            <span
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '18px',
                fontWeight: 800,
                letterSpacing: '-0.05em',
                color: '#fff',
              }}
            >
              Le QG
            </span>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            {/* Coins */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '7px 13px',
                borderRadius: '12px',
                background: 'rgba(30,41,59,0.7)',
                border: '1px solid rgba(255,255,255,0.09)',
                fontSize: '13px',
                fontWeight: 700,
                color: '#fff',
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              <Gem size={15} style={{ color: '#fbbf24', flexShrink: 0 }} />
              {(user.coins || 0).toLocaleString('fr-FR')}
            </div>

            {/* Help button */}
            <button
              aria-label="Aide"
              title="Aide"
              style={{
                width: '38px', height: '38px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '12px',
                background: 'rgba(30,41,59,0.7)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: '#aab7ce',
                cursor: 'pointer',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#aab7ce')}
            >
              <CircleHelp size={17} />
            </button>

            {/* Profile dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '5px 12px 5px 5px',
                  borderRadius: '12px',
                  background: 'rgba(30,41,59,0.7)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(51,65,85,0.8)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(30,41,59,0.7)')}
              >
                {/* Avatar */}
                {user.avatar_url ? (
                  user.avatar_url.startsWith('/uploads/') ? (
                    <img src={`${PUBLIC_BASE}${user.avatar_url}`} alt="Avatar" className={`avatar ${user.equipped_border || ''}`} style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
                  ) : user.avatar_url.startsWith('http') ? (
                    <img src={user.avatar_url} alt="Avatar" className={`avatar ${user.equipped_border || ''}`} style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
                  ) : (
                    <div
                      style={{
                        width: '28px', height: '28px',
                        borderRadius: '8px',
                        background: '#2dd4bf',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontSize: '12px', fontWeight: 800,
                        color: '#062a2b',
                      }}
                    >
                      {user.avatar_url}
                    </div>
                  )
                ) : (
                  <div
                    style={{
                      width: '28px', height: '28px',
                      borderRadius: '8px',
                      background: '#2dd4bf',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: '12px', fontWeight: 800,
                      color: '#062a2b',
                    }}
                  >
                    {user.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#fff',
                    fontFamily: "'Manrope', sans-serif",
                  }}
                >
                  {user.username}
                </span>
                <ChevronDown size={13} style={{ color: '#aab7ce' }} />
              </button>

              {/* Dropdown */}
              {showDropdown && (
                <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                  <div className="dropdown-header">
                    <div
                      style={{ fontWeight: 700, fontSize: '0.9rem', color: user.equipped_color && !['rainbow', 'cyberpunk'].includes(user.equipped_color) ? user.equipped_color : undefined }}
                      className={`truncate ${user.equipped_color === 'rainbow' ? 'text-rainbow' : (user.equipped_color === 'cyberpunk' ? 'text-cyberpunk' : '')}`}
                    >
                      {user.username}
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.78rem' }}>#{user.discriminator}</span>
                    </div>
                    {user.equipped_title && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '1px' }}>
                        "{user.equipped_title}"
                      </div>
                    )}
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {user.role === 'admin' ? 'Administrateur' : 'Joueur'}
                    </div>
                  </div>

                  {user.role === 'admin' && (
                    <button className="dropdown-item danger" onClick={() => { navigate('/admin'); setShowDropdown(false); }}>
                      <ShieldAlert size={14} />
                      Espace Admin
                    </button>
                  )}

                  <button className="dropdown-item" onClick={() => { navigate('/profil'); setShowDropdown(false); }}>
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
          </div>
        </header>
      )}

      {/* Auth header (logo seul, pas de nav) */}
      {!user && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '60px',
            padding: '0 24px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '9px',
                background: 'var(--accent)',
              }}
            >
              <span style={{ fontWeight: 800, fontSize: '12px', letterSpacing: '-0.05em', color: '#fff' }}>QG</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>Le QG</span>
          </div>
          {/* Theme toggle on login page */}
          <button className="btn-icon" onClick={toggleTheme} title="Changer de thème" style={{ marginLeft: 'auto' }}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>
      )}

      {/* ── Main Content Router ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Routes>
          {/* Public route — show nothing while checking auth to avoid flash */}
          <Route
            path="/"
            element={
              authLoading
                ? null
                : user
                  ? <Navigate to="/dashboard" replace />
                  : <AuthScreen onAuthSuccess={handleAuthSuccess} />
            }
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute user={user} authLoading={authLoading}>
                <DashboardScreen
                  user={user}
                  dailyStatus={dailyStatus}
                  onLogout={handleLogout}
                  onStartSolo={(packId, mode) => navigate('/quiz/solo', { state: { soloPackId: packId, soloGameMode: mode } })}
                  onCreateLobby={(code) => navigate(`/quiz/multi/${code}`, { state: { roomCode: code } })}
                  onJoinLobby={(code) => navigate(`/quiz/multi/${code}`, { state: { roomCode: code } })}
                  onOpenAdmin={() => navigate('/admin')}
                  onOpenCreator={() => navigate('/creer')}
                  onOpenLeaderboard={() => navigate('/classement')}
                  onOpenProfile={() => navigate('/profil')}
                  onStartDailyQuiz={() => navigate('/quiz/jour')}
                  onUpdateUserStats={updateUserStats}
                  onOpenShop={() => navigate('/boutique')}
                  onOpenCollection={() => navigate('/collection')}
                />
              </PrivateRoute>
            }
          />

          <Route
            path="/quiz/jour"
            element={
              <PrivateRoute user={user} authLoading={authLoading}>
                <DailyQuizScreen
                  onBack={() => navigate('/dashboard')}
                  onUpdateUserStats={updateUserStats}
                />
              </PrivateRoute>
            }
          />

          <Route
            path="/quiz/solo"
            element={
              <PrivateRoute user={user} authLoading={authLoading}>
                <SoloQuizScreen
                  packId={soloPackId}
                  gameMode={soloGameMode || 'classic'}
                  onBack={() => navigate('/dashboard')}
                  onUpdateUserStats={updateUserStats}
                />
              </PrivateRoute>
            }
          />

          <Route
            path="/quiz/multi/:roomCode"
            element={
              <PrivateRoute user={user} authLoading={authLoading}>
                <MultiplayerArena
                  roomCode={roomCode}
                  user={user}
                  onBack={() => navigate('/dashboard')}
                />
              </PrivateRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <PrivateRoute user={user} authLoading={authLoading}>
                <AdminScreen onBack={() => navigate('/dashboard')} />
              </PrivateRoute>
            }
          />

          <Route
            path="/creer"
            element={
              <PrivateRoute user={user} authLoading={authLoading}>
                <CreatorScreen onBack={() => navigate('/dashboard')} />
              </PrivateRoute>
            }
          />

          <Route
            path="/classement"
            element={
              <PrivateRoute user={user} authLoading={authLoading}>
                <LeaderboardScreen onBack={() => navigate('/dashboard')} />
              </PrivateRoute>
            }
          />

          <Route
            path="/profil"
            element={
              <PrivateRoute user={user} authLoading={authLoading}>
                <ProfileScreen
                  user={user}
                  onBack={() => navigate('/dashboard')}
                  onUpdateUserStats={updateUserStats}
                />
              </PrivateRoute>
            }
          />

          <Route
            path="/boutique"
            element={
              <PrivateRoute user={user} authLoading={authLoading}>
                <ShopScreen
                  key="shop"
                  user={user}
                  mode="shop"
                  onRefreshProfile={updateUserStats}
                  onBack={() => navigate('/dashboard')}
                />
              </PrivateRoute>
            }
          />

          <Route
            path="/collection"
            element={
              <PrivateRoute user={user} authLoading={authLoading}>
                <ShopScreen
                  key="collection"
                  user={user}
                  mode="collection"
                  onRefreshProfile={updateUserStats}
                  onBack={() => navigate('/dashboard')}
                />
              </PrivateRoute>
            }
          />

          {/* Fallback: redirect everything unknown to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
