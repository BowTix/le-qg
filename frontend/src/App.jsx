import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AuthScreen from './components/AuthScreen';
import DashboardScreen from './components/DashboardScreen';
import AppShell, { AuthHeader } from './components/layout/AppShell';
import { api } from './utils/api';

const AdminScreen = lazy(() => import('./components/AdminScreen'));
const CreatorScreen = lazy(() => import('./components/CreatorScreen'));
const DailyQuizScreen = lazy(() => import('./components/DailyQuizScreen'));
const LeaderboardScreen = lazy(() => import('./components/LeaderboardScreen'));
const MultiplayerArena = lazy(() => import('./components/MultiplayerArena'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen'));
const PublicProfileScreen = lazy(() => import('./components/PublicProfileScreen'));
const ShopScreen = lazy(() => import('./components/ShopScreen'));
const SoloQuizScreen = lazy(() => import('./components/SoloQuizScreen'));

function PrivateRoute({ user, authLoading, children }) {
  if (authLoading) return null;
  return user ? children : <Navigate to="/" replace />;
}

function ScreenLoader() {
  return <div className="screen-loader"><span className="spinner spinner-lg" /><p>Chargement de l’espace…</p></div>;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dailyStatus, setDailyStatus] = useState({ scheduled: false, completed: false });
  const [theme, setTheme] = useState(() => localStorage.getItem('quiz_theme') || 'dark');
  const { soloPackId, soloGameMode, roomCode } = location.state || {};

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('quiz_theme', theme);
  }, [theme]);

  useEffect(() => {
    const savedToken = localStorage.getItem('quiz_token');
    const savedUser = localStorage.getItem('quiz_user');
    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        if (location.pathname === '/') navigate('/dashboard', { replace: true });
      } catch {
        localStorage.removeItem('quiz_token');
        localStorage.removeItem('quiz_user');
      }
    }
    setAuthLoading(false);

    const expireSession = () => { setUser(null); navigate('/', { replace: true }); };
    window.addEventListener('auth_session_expired', expireSession);
    return () => window.removeEventListener('auth_session_expired', expireSession);
  }, []);

  useEffect(() => {
    if (!user || location.pathname !== '/dashboard') return;
    api.get('/auth/profile').then((res) => {
      if (res.success && res.user) {
        setUser(res.user);
        localStorage.setItem('quiz_user', JSON.stringify(res.user));
      }
    }).catch((error) => console.error('Failed to refresh user profile statistics:', error));
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    api.get('/quiz/daily/status')
      .then((res) => { if (res.success) setDailyStatus(res); })
      .catch((error) => console.error('Failed to fetch daily quiz status', error));
  }, [user, location.pathname]);

  useEffect(() => {
    if (!user) return undefined;
    const refreshAfterTrade = () => {
      api.get('/auth/profile').then((res) => {
        if (res.success && res.user) {
          setUser(res.user);
          localStorage.setItem('quiz_user', JSON.stringify(res.user));
        }
      }).catch((error) => console.error('Failed to refresh after trade:', error));
    };
    window.addEventListener('trade_inventory_changed', refreshAfterTrade);
    return () => window.removeEventListener('trade_inventory_changed', refreshAfterTrade);
  }, [user]);

  const updateUserStats = (stats) => {
    setUser((current) => {
      if (!current) return current;
      const updated = { ...current, ...stats };
      localStorage.setItem('quiz_user', JSON.stringify(updated));
      return updated;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('quiz_token');
    localStorage.removeItem('quiz_user');
    setUser(null);
    navigate('/', { replace: true });
  };

  const protectedScreen = (screen) => (
    <PrivateRoute user={user} authLoading={authLoading}>{screen}</PrivateRoute>
  );

  return (
    <div className="redesign-root">
      {user ? (
        <AppShell
          user={user}
          theme={theme}
          onToggleTheme={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
          onLogout={handleLogout}
        >
          <Suspense fallback={<ScreenLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={protectedScreen(
              <DashboardScreen
                user={user}
                dailyStatus={dailyStatus}
                onStartSolo={(packId, mode) => navigate('/quiz/solo', { state: { soloPackId: packId, soloGameMode: mode } })}
                onCreateLobby={(code) => navigate(`/quiz/multi/${code}`, { state: { roomCode: code } })}
                onJoinLobby={(code) => navigate(`/quiz/multi/${code}`, { state: { roomCode: code } })}
                onOpenCreator={() => navigate('/creer')}
                onOpenLeaderboard={() => navigate('/classement')}
                onStartDailyQuiz={() => navigate('/quiz/jour')}
                onUpdateUserStats={updateUserStats}
                onOpenShop={() => navigate('/boutique')}
                onOpenCollection={() => navigate('/collection')}
              />
            )} />
            <Route path="/quiz/jour" element={protectedScreen(<DailyQuizScreen onBack={() => navigate('/dashboard')} onUpdateUserStats={updateUserStats} />)} />
            <Route path="/quiz/solo" element={protectedScreen(<SoloQuizScreen packId={soloPackId} gameMode={soloGameMode || 'classic'} onBack={() => navigate('/dashboard')} onUpdateUserStats={updateUserStats} />)} />
            <Route path="/quiz/multi/:roomCode" element={protectedScreen(<MultiplayerArena roomCode={roomCode} user={user} onBack={() => navigate('/dashboard')} />)} />
            <Route path="/admin" element={protectedScreen(<AdminScreen onBack={() => navigate('/dashboard')} />)} />
            <Route path="/creer" element={protectedScreen(<CreatorScreen onBack={() => navigate('/dashboard')} />)} />
            <Route path="/classement" element={protectedScreen(<LeaderboardScreen onBack={() => navigate('/dashboard')} />)} />
            <Route path="/profil" element={protectedScreen(<ProfileScreen user={user} onBack={() => navigate('/dashboard')} onUpdateUserStats={updateUserStats} />)} />
            <Route path="/joueur/:userId" element={protectedScreen(<PublicProfileScreen />)} />
            <Route path="/boutique" element={protectedScreen(<ShopScreen key="shop" user={user} mode="shop" onRefreshProfile={updateUserStats} onBack={() => navigate('/dashboard')} />)} />
            <Route path="/collection" element={protectedScreen(<ShopScreen key="collection" user={user} mode="collection" onRefreshProfile={updateUserStats} onBack={() => navigate('/dashboard')} />)} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </Suspense>
        </AppShell>
      ) : (
        <div className="app-shell app-shell--public">
          <div className="ambient ambient--teal" />
          <div className="ambient ambient--fuchsia" />
          <div className="app-shell__frame">
            <AuthHeader theme={theme} onToggleTheme={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} />
            <main className="app-content">
              <Routes>
                <Route path="/" element={authLoading ? null : <AuthScreen onAuthSuccess={(data) => { setUser(data); navigate('/dashboard', { replace: true }); }} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
