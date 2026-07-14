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
  Trophy,
  Plus,
  User,
  LogOut,
  ShieldAlert,
  ChevronDown,
  Sun,
  Moon,
  Coins,
  Gamepad2,
  Calendar,
  Share2,
  Sparkles
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
  const [showDailyModal, setShowDailyModal] = useState(false);

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
    <div className="layout-page">

      {/* Animated shimmer accent bar at top */}
      <div className="accent-bar" />

      {/* ── Global Header ── */}
      <header className="header-nav">

        {/* Logo */}
        <div
          className="header-logo"
          onClick={() => user && navigate('/dashboard')}
          style={{ cursor: user ? 'pointer' : 'default' }}
        >
          <Gamepad2 size={22} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span>LE QG</span>
        </div>

        {/* Right-side actions */}
        <div className="header-actions">

          {user && !isAuth && (
            <>
              {/* Nav shortcuts */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="btn-secondary"
                  onClick={() => navigate('/classement')}
                  style={{ padding: '7px 12px', fontSize: '0.825rem' }}
                  title="Classement"
                >
                  <Trophy size={14} style={{ color: 'var(--accent)' }} />
                  <span className="hide-mobile">Classement</span>
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => navigate('/creer')}
                  style={{ padding: '7px 12px', fontSize: '0.825rem' }}
                  title="Créer un thème"
                >
                  <Plus size={14} style={{ color: 'var(--accent)' }} />
                  <span className="hide-mobile">Créer Thème</span>
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => navigate('/boutique')}
                  style={{ padding: '7px 12px', fontSize: '0.825rem' }}
                  title="Boutique"
                >
                  <Sparkles size={14} style={{ color: '#ffb300' }} />
                  <span className="hide-mobile">Boutique</span>
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => navigate('/collection')}
                  style={{ padding: '7px 12px', fontSize: '0.825rem' }}
                  title="Collection"
                >
                  <Trophy size={14} style={{ color: 'var(--accent)' }} />
                  <span className="hide-mobile">Collection</span>
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setShowDailyModal(true)}
                  style={{ 
                    padding: '7px 12px', 
                    fontSize: '0.825rem',
                    position: 'relative',
                    border: '1px solid rgba(255, 247, 0, 0.25)',
                    background: 'linear-gradient(135deg, rgba(255, 247, 0, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)'
                  }}
                  title="Quiz du Jour"
                >
                  <Calendar size={14} style={{ color: 'var(--accent)' }} />
                  <span className="hide-mobile">Quiz du Jour</span>
                  {dailyStatus.scheduled && !dailyStatus.completed && (
                    <span style={{
                      position: 'absolute',
                      top: '-3px',
                      right: '-3px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#ef4444',
                      boxShadow: '0 0 6px #ef4444'
                    }} />
                  )}
                </button>
              </div>

              {/* Stats pill */}
              <div className="header-stats">
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }} title="Pièces">
                  <Coins size={14} style={{ color: '#f59e0b' }} />
                  <span>{user.coins || 0}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent)' }} title={`Niveau ${getLevel(user.global_score)} (${user.global_score} XP)`}>
                  <Trophy size={14} style={{ color: 'var(--accent)' }} />
                  <span>Niveau {getLevel(user.global_score)}</span>
                </span>
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
          {user && !isAuth && (
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
                    <img src={`${PUBLIC_BASE}${user.avatar_url}`} alt="Avatar" className={`avatar ${user.equipped_border || ''}`} style={{ width: '28px', height: '28px' }} />
                  ) : user.avatar_url.startsWith('http') ? (
                    <img src={user.avatar_url} alt="Avatar" className={`avatar ${user.equipped_border || ''}`} style={{ width: '28px', height: '28px' }} />
                  ) : (
                    <div className={`avatar-placeholder ${user.equipped_border || ''}`} style={{ width: '28px', height: '28px', fontSize: '1rem' }}>{user.avatar_url}</div>
                  )
                ) : (
                  <div className={`avatar-placeholder ${user.equipped_border || ''}`} style={{ width: '28px', height: '28px' }}>
                    <User size={14} />
                  </div>
                )}
                <ChevronDown size={13} style={{ color: 'var(--text-secondary)' }} />
              </div>

              {/* Dropdown */}
              {showDropdown && (
                <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                  <div className="dropdown-header">
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: user.equipped_color && !['rainbow', 'cyberpunk'].includes(user.equipped_color) ? user.equipped_color : undefined
                      }}
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
          )}
        </div>
      </header>

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

      {/* 📅 DAILY QUIZ MODAL */}
      {showDailyModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => setShowDailyModal(false)}>
          <div 
            className="glass-card" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '20px', 
              padding: '36px', 
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              borderLeft: '4px solid var(--accent)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
              position: 'relative',
              maxWidth: '500px',
              width: '100%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>📅</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', margin: 0, color: 'var(--text-primary)' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center', backgroundColor: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Votre résultat aujourd'hui :</p>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent)', margin: '4px 0 0 0' }}>
                    {(() => {
                      const correctCount = [dailyStatus.attempt.q1_correct, dailyStatus.attempt.q2_correct, dailyStatus.attempt.q3_correct].filter(Boolean).length;
                      return `${correctCount}/3`;
                    })()}
                  </span>
                  <span style={{ fontSize: '1.4rem', letterSpacing: '4px' }}>
                    {dailyStatus.attempt.q1_correct ? '🟩' : '🟥'}
                    {dailyStatus.attempt.q2_correct ? '🟩' : '🟥'}
                    {dailyStatus.attempt.q3_correct ? '🟩' : '🟥'}
                  </span>
                  
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
                    style={{ marginTop: '12px', padding: '10px 20px', fontSize: '0.85rem' }}
                  >
                    <Share2 size={16} />
                    Partager mon résultat (Copier)
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                          <span>Q1</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{dailyStatus.stats.q1_pct}%</strong>
                        </div>
                        <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${dailyStatus.stats.q1_pct}%`, height: '100%', backgroundColor: 'var(--success)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                          <span>Q2</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{dailyStatus.stats.q2_pct}%</strong>
                        </div>
                        <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${dailyStatus.stats.q2_pct}%`, height: '100%', backgroundColor: 'var(--success)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                          <span>Q3</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{dailyStatus.stats.q3_pct}%</strong>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Un défi quotidien unique vous attend ! Répondez correctement à 3 questions partagées par toute la communauté. Attention, vous n'avez qu'une seule tentative par jour.
                </p>
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    setShowDailyModal(false);
                    navigate('/quiz/jour');
                  }}
                  style={{ padding: '12px 28px', fontSize: '0.9rem', marginTop: '8px' }}
                >
                  Lancer le Quiz du Jour
                </button>
              </div>
            )}

            <button 
              className="btn-secondary" 
              onClick={() => setShowDailyModal(false)}
              style={{ width: '100%', padding: '12px', marginTop: '8px' }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
