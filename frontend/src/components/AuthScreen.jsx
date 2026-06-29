import React, { useState } from 'react';
import { api } from '../utils/api';
import { KeyRound, User, UserPlus, LogIn, AlertCircle, Mail, ShieldCheck, RefreshCw } from 'lucide-react';

export default function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Email verification states
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyUsername, setVerifyUsername] = useState('');
  const [simulatedCode, setSimulatedCode] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (username.trim().length < 3) {
      setError("Le pseudo doit contenir au moins 3 caractères.");
      return;
    }
    if (!isLogin && email.trim() === '') {
      setError("Veuillez renseigner votre adresse email.");
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
        const response = await api.post('/auth/register', { username, email, password });
        setSuccess(response.message || "Compte créé avec succès ! Veuillez vérifier votre code.");
        setVerifyUsername(username);
        if (response.verification_code) {
          setSimulatedCode(response.verification_code);
        }
        setNeedsVerification(true);
        setPassword('');
      }
    } catch (err) {
      if (err.needs_verification) {
        // Account needs verification
        setError('');
        setVerifyUsername(err.username);
        setNeedsVerification(true);
      } else {
        setError(err.message || "Une erreur est survenue.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (verifyCode.trim().length !== 6) {
      setError("Le code de validation doit comporter 6 chiffres.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/verify', {
        username: verifyUsername,
        code: verifyCode.trim()
      });

      setSuccess(response.message || "Compte validé avec succès ! Connectez-vous.");
      setNeedsVerification(false);
      setIsLogin(true);
      setVerifyCode('');
      setSimulatedCode('');
    } catch (err) {
      setError(err.message || "Code de validation incorrect.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.post('/auth/resend', { username: verifyUsername });
      setSuccess("Un nouveau code a été généré.");
      if (response.verification_code) {
        setSimulatedCode(response.verification_code);
      }
    } catch (err) {
      setError(err.message || "Erreur de renvoi de code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '24px 16px', width: '100%' }} className="animate-fade-in">
      <div className="glass-card w-full max-w-md">
        
        {/* Header Title */}
        <div className="text-center mb-8">
          <h1 style={{ color: 'var(--accent)', fontSize: '2.5rem', marginBottom: '8px', fontWeight: 800 }}>
            LE QG
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Défiez vos amis sur le Quiz Général
          </p>
        </div>

        {/* Verification Screen */}
        {needsVerification ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-secondary)', marginBottom: '16px', fontWeight: 700 }}>
              <ShieldCheck size={20} />
              Vérifier votre Compte
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.4' }}>
              Un code de validation à 6 chiffres a été virtuellement envoyé à votre adresse email pour valider le compte de <strong>{verifyUsername}</strong>.
            </p>

            {/* Local Mock Infobox */}
            {simulatedCode && (
              <div style={{
                backgroundColor: 'rgba(0, 240, 255, 0.05)',
                border: '1px dashed var(--accent-secondary)',
                color: 'var(--accent-secondary)',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '0.85rem',
                textAlign: 'center'
              }}>
                ℹ️ simulation locale de mail reçu : <br />
                Code de vérification : <strong style={{ fontSize: '1.1rem', color: '#fff' }}>{simulatedCode}</strong>
              </div>
            )}

            {/* Error/Success Alerts */}
            {error && (
              <div className="alert alert-error" style={{ marginBottom: '20px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="alert alert-success" style={{ marginBottom: '20px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleVerifySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
                  Code à 6 chiffres
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '4px', fontWeight: 700 }}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleResendCode}
                  style={{ flex: 1, padding: '12px', fontSize: '0.9rem' }}
                  disabled={loading}
                >
                  <RefreshCw size={16} /> Renvoyer
                </button>
                
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 2, padding: '12px', fontSize: '0.9rem' }}
                  disabled={loading || verifyCode.length !== 6}
                >
                  Valider le Code
                </button>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setNeedsVerification(false); setIsLogin(true); setError(''); setSuccess(''); }}
                style={{ width: '100%', border: 'none', background: 'none', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Retourner à la connexion
              </button>
            </form>
          </div>
        ) : (
          /* Authentication Forms */
          <>
            {/* Tab Toggle */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
              <button
                onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
                style={{
                  flex: 1, padding: '12px',
                  background: 'transparent', border: 'none',
                  borderBottom: isLogin ? '2px solid var(--accent)' : '2px solid transparent',
                  color: isLogin ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                  transition: 'var(--transition)', fontFamily: 'var(--font-sans)'
                }}
              >
                Connexion
              </button>
              <button
                onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
                style={{
                  flex: 1, padding: '12px',
                  background: 'transparent', border: 'none',
                  borderBottom: !isLogin ? '2px solid var(--accent)' : '2px solid transparent',
                  color: !isLogin ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                  transition: 'var(--transition)', fontFamily: 'var(--font-sans)'
                }}
              >
                Créer un compte
              </button>
            </div>

            {/* Success/Error Alerts */}
            {error && (
              <div className="alert alert-error" style={{ marginBottom: '20px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="alert alert-success" style={{ marginBottom: '20px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{success}</span>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
                  {isLogin ? "Email ou Pseudo" : "Pseudo"}
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '14px', top: '16px', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    placeholder={isLogin ? "Email ou Pseudo" : "Votre pseudo"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ paddingLeft: '44px' }}
                    required
                  />
                </div>
              </div>

              {!isLogin && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
                    Adresse Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: '14px', top: '16px', color: 'var(--text-secondary)' }} />
                    <input
                      type="email"
                      placeholder="exemple@mail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ paddingLeft: '44px' }}
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
                  Mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={18} style={{ position: 'absolute', left: '14px', top: '16px', color: 'var(--text-secondary)' }} />
                  <input
                    type="password"
                    placeholder="••••••••"
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
                    Créer mon compte
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
