import React, { useEffect, useState } from 'react';
import AuthScreen from './components/AuthScreen';
import DashboardScreen from './components/DashboardScreen';
import SoloQuizScreen from './components/SoloQuizScreen';
import MultiplayerArena from './components/MultiplayerArena';
import AdminScreen from './components/AdminScreen';
import CreatorScreen from './components/CreatorScreen';

export default function App() {
  const [view, setView] = useState('auth'); // 'auth', 'dashboard', 'solo', 'lobby', 'admin', 'creator'
  const [user, setUser] = useState(null);
  
  // Navigation Parameter Store
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

    // Bind session expiration listener
    const handleSessionExpired = () => {
      setUser(null);
      setView('auth');
    };
    window.addEventListener('auth_session_expired', handleSessionExpired);

    return () => {
      window.removeEventListener('auth_session_expired', handleSessionExpired);
    };
  }, []);

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

  const updateGlobalScore = (newScore) => {
    if (user) {
      const updatedUser = { ...user, global_score: newScore };
      setUser(updatedUser);
      localStorage.setItem('quiz_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      width: '100%',
      background: 'radial-gradient(circle at top right, #25283d 0%, #1f1f2c 60%, #171822 100%)'
    }}>
      
      {/* Decorative top accent border line */}
      <div style={{
        height: '4px',
        width: '100%',
        background: 'linear-gradient(90deg, var(--accent) 0%, #ff8800 50%, var(--accent) 100%)',
        boxShadow: '0 2px 10px rgba(255, 247, 0, 0.3)'
      }} />

      {/* View Router */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '16px',
        width: '100%'
      }}>
        {view === 'auth' && (
          <AuthScreen onAuthSuccess={handleAuthSuccess} />
        )}
        
        {view === 'dashboard' && user && (
          <DashboardScreen
            user={user}
            onLogout={handleLogout}
            onStartSolo={(packId) => {
              setSoloPackId(packId);
              setView('solo');
            }}
            onCreateLobby={(code) => {
              setRoomCode(code);
              setView('lobby');
            }}
            onJoinLobby={(code) => {
              setRoomCode(code);
              setView('lobby');
            }}
            onOpenAdmin={() => setView('admin')}
            onOpenCreator={() => setView('creator')}
          />
        )}

        {view === 'solo' && (
          <SoloQuizScreen
            packId={soloPackId}
            onBack={() => setView('dashboard')}
            onUpdateUserScore={updateGlobalScore}
          />
        )}

        {view === 'lobby' && user && (
          <MultiplayerArena
            roomCode={roomCode}
            user={user}
            onBack={() => setView('dashboard')}
            onUpdateUserScore={updateGlobalScore}
          />
        )}

        {view === 'admin' && (
          <AdminScreen onBack={() => setView('dashboard')} />
        )}

        {view === 'creator' && (
          <CreatorScreen onBack={() => setView('dashboard')} />
        )}
      </main>

      {/* Decorative Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '16px',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        borderTop: '1px solid rgba(255, 255, 255, 0.02)'
      }}>
        Quiz Compétitif &copy; {new Date().getFullYear()} - Protections Anti-Triche Actives 🛡️
      </footer>
    </div>
  );
}
