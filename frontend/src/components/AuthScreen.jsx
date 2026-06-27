import React, { useState } from 'react';
import { api } from '../utils/api';
import { KeyRound, User, UserPlus, LogIn, AlertCircle } from 'lucide-react';

export default function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (username.trim().length < 3) {
      setError("Le pseudo doit contenir au moins 3 caractères.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // Login Flow
        const response = await api.post('/auth/login', { username, password });
        if (response.token && response.user) {
          localStorage.setItem('quiz_token', response.token);
          localStorage.setItem('quiz_user', JSON.stringify(response.user));
          onAuthSuccess(response.user);
        }
      } else {
        // Register Flow
        const response = await api.post('/auth/register', { username, password });
        setSuccess(response.message || "Compte créé avec succès ! Connectez-vous.");
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 animate-fade-in">
      <div className="glass-card w-full max-w-md">
        {/* Header Title */}
        <div className="text-center mb-8">
          <h1 style={{ color: 'var(--accent)', fontSize: '2.5rem', marginBottom: '8px' }}>
            ⚡ ANTIGRAVITY QUIZ
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Défiez vos amis sur le quiz ultime !
          </p>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
          <button
            onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: 'none',
              borderBottom: isLogin ? '2px solid var(--accent)' : 'none',
              color: isLogin ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition-smooth)'
            }}
          >
            Connexion
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: 'none',
              borderBottom: !isLogin ? '2px solid var(--accent)' : 'none',
              color: !isLogin ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition-smooth)'
            }}
          >
            Créer un compte
          </button>
        </div>

        {/* Success/Error Alerts */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--error-glow)',
            color: 'var(--error)',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 59, 105, 0.2)',
            marginBottom: '20px',
            fontSize: '0.9rem'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--success-glow)',
            color: 'var(--success)',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(0, 255, 157, 0.2)',
            marginBottom: '20px',
            fontSize: '0.9rem'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
              Pseudo
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Votre pseudo"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ paddingLeft: '44px' }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
              Mot de passe
            </label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-secondary)' }} />
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '44px' }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" style={{
                width: '18px',
                height: '18px',
                border: '2px solid rgba(0,0,0,0.1)',
                borderTopColor: '#000',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
                display: 'inline-block'
              }} />
            ) : isLogin ? (
              <>
                <LogIn size={18} />
                Se connecter
              </>
            ) : (
              <>
                <UserPlus size={18} />
                S'enregistrer
              </>
            )}
          </button>
        </form>
      </div>
      
      {/* CSS Spin Keyframes */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
