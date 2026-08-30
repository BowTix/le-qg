import React, { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import { KeyRound, User, UserPlus, LogIn, AlertCircle, Mail, ShieldCheck, RefreshCw } from 'lucide-react';

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export default function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Email verification states
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyUsername, setVerifyUsername] = useState('');
  const [simulatedCode, setSimulatedCode] = useState('');

  const googleBtnRef = useRef(null);

  // Google OAuth GIS initialization
  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) return;

    const handleCredentialResponse = async (response) => {
      if (!response?.credential) return;
      setError('');
      setSuccess('');
      setGoogleLoading(true);
      try {
        const res = await api.post('/auth/google', { credential: response.credential });
        if (res.token && res.user) {
          localStorage.setItem('quiz_token', res.token);
          localStorage.setItem('quiz_user', JSON.stringify(res.user));
          onAuthSuccess(res.user);
        } else {
          setError("Erreur lors de l'authentification avec Google.");
        }
      } catch (err) {
        setError(err.message || "Impossible de se connecter avec Google.");
      } finally {
        setGoogleLoading(false);
      }
    };

    const setupGis = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'filled_black',
            size: 'large',
            text: isLogin ? 'signin_with' : 'signup_with',
            shape: 'rectangular',
            width: '100%',
            locale: 'fr',
          });
        }
      }
    };

    const scriptId = 'google-gsi-client';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = setupGis;
      document.body.appendChild(script);
    } else {
      setupGis();
    }
  }, [isLogin, needsVerification]);

  const handleGoogleCustomClick = () => {
    setError('');
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      setError("La connexion Google nécessite la variable d'environnement VITE_GOOGLE_CLIENT_ID.");
      return;
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // If prompt blocked or suppressed, try rendering button click
          const innerBtn = googleBtnRef.current?.querySelector('div[role="button"]');
          if (innerBtn) {
            innerBtn.click();
          }
        }
      });
    } else {
      setError("Chargement du module Google en cours, veuillez réessayer dans un instant.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const cleanEmail = email.trim();

    if (isLogin) {
      // Login validation
      if (!cleanEmail) {
        setError("Veuillez renseigner votre adresse email.");
        return;
      }
      if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        setError("Veuillez renseigner une adresse email valide.");
        return;
      }
      if (password.length < 6) {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
        return;
      }
    } else {
      // Register validation
      const cleanUsername = username.trim();
      if (cleanUsername.length < 3 || cleanUsername.length > 20) {
        setError("Le pseudo doit contenir entre 3 et 20 caractères.");
        return;
      }
      if (!/^[a-zA-Z0-9_\-]+$/.test(cleanUsername)) {
        setError("Le pseudo ne peut contenir que des lettres, chiffres, tirets et underscores.");
        return;
      }
      if (!cleanEmail) {
        setError("Veuillez renseigner votre adresse email.");
        return;
      }
      if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        setError("Veuillez renseigner une adresse email valide.");
        return;
      }
      if (password.length < 6) {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas.");
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        // Login Flow
        const response = await api.post('/auth/login', { email: cleanEmail, password });
        if (response.token && response.user) {
          localStorage.setItem('quiz_token', response.token);
          localStorage.setItem('quiz_user', JSON.stringify(response.user));
          onAuthSuccess(response.user);
        } else {
          console.warn('[Auth] login response missing token or user:', response);
        }
      } else {
        // Register Flow
        const cleanUsername = username.trim();
        const response = await api.post('/auth/register', { username: cleanUsername, email: cleanEmail, password });
        setSuccess(response.message || "Compte créé avec succès ! Veuillez vérifier votre code.");
        setVerifyUsername(cleanUsername);
        if (response.verification_code) {
          setSimulatedCode(response.verification_code);
        }
        setNeedsVerification(true);
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      if (err.needs_verification) {
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

  const switchTab = (loginMode) => {
    setIsLogin(loginMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="auth-container animate-fade-in">
      <div 
        className={`glass-card w-full ${isLogin || needsVerification ? 'max-w-md' : 'max-w-xl'}`} 
        style={{ margin: '0 auto', transition: 'max-width 0.25s ease' }}
      >
        
        {/* Header Title */}
        <div className="text-center" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", marginBottom: '28px' }}>
          <h1 style={{ 
            color: '#fff', 
            fontSize: 'clamp(2.2rem, 5vw, 2.8rem)', 
            marginBottom: '8px', 
            fontWeight: 800, 
            letterSpacing: '-0.06em',
            textShadow: '0 0 40px rgba(45,212,191,0.2)'
          }}>
            LE <span style={{ color: '#2dd4bf' }}>QG</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500, margin: 0 }}>
            Défiez vos amis sur le Quiz Général
          </p>
        </div>

        {/* Verification Screen */}
        {needsVerification ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2dd4bf', marginBottom: '16px', fontWeight: 800, fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <ShieldCheck size={20} />
              Vérifier votre Compte
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.4' }}>
              Un code de validation à 6 chiffres a été virtuellement envoyé à votre adresse email pour valider le compte de <strong>{verifyUsername}</strong>.
            </p>

            {/* Local Mock Infobox */}
            {simulatedCode && (
              <div style={{
                backgroundColor: 'rgba(251, 191, 36, 0.06)',
                border: '1px dashed rgba(251, 191, 36, 0.3)',
                color: '#fbbf24',
                padding: '12px',
                borderRadius: '12px',
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
                <div className="input-with-icon">
                  <ShieldCheck className="input-icon" size={18} />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '4px', fontWeight: 700 }}
                    required
                    autoFocus
                  />
                </div>
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
            {/* Tab Toggle - Segmented Controller style */}
            <div style={{ 
              display: 'flex', 
              background: 'rgba(15,23,42,0.35)', 
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px', 
              padding: '4px',
              gap: '4px',
              marginBottom: '24px',
              fontFamily: "'Satoshi', sans-serif"
            }}>
              <button
                type="button"
                onClick={() => switchTab(true)}
                style={{
                  flex: 1, padding: '10px 14px',
                  background: isLogin ? 'rgba(45,212,191,0.15)' : 'transparent', 
                  border: 'none',
                  borderRadius: '10px',
                  color: isLogin ? '#2dd4bf' : '#aab7ce',
                  fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => switchTab(false)}
                style={{
                  flex: 1, padding: '10px 14px',
                  background: !isLogin ? 'rgba(45,212,191,0.15)' : 'transparent', 
                  border: 'none',
                  borderRadius: '10px',
                  color: !isLogin ? '#2dd4bf' : '#aab7ce',
                  fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Créer un compte
              </button>
            </div>

            {/* Google OAuth Button */}
            <div>
              <button
                type="button"
                className="btn-google"
                onClick={handleGoogleCustomClick}
                disabled={googleLoading || loading}
              >
                {googleLoading ? (
                  <span className="spinner" style={{ width: '18px', height: '18px' }} />
                ) : (
                  <>
                    <GoogleIcon size={18} />
                    <span>{isLogin ? 'Continuer avec Google' : "S'inscrire avec Google"}</span>
                  </>
                )}
              </button>

              {/* Hidden container where official GIS button can render if enabled */}
              <div ref={googleBtnRef} style={{ display: 'none' }} />
            </div>

            <div className="auth-divider">
              <span>ou</span>
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
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {isLogin ? (
                /* Login fields (single column stack) */
                <>
                  <div>
                    <label>Adresse Email</label>
                    <div className="input-with-icon">
                      <Mail className="input-icon" size={18} />
                      <input
                        type="email"
                        placeholder="exemple@mail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label>Mot de passe</label>
                    <div className="input-with-icon">
                      <KeyRound className="input-icon" size={18} />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* Register fields (2x2 grid) */
                <div className="auth-grid">
                  <div>
                    <label>Pseudo</label>
                    <div className="input-with-icon">
                      <User className="input-icon" size={18} />
                      <input
                        type="text"
                        placeholder="Votre pseudo"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label>Adresse Email</label>
                    <div className="input-with-icon">
                      <Mail className="input-icon" size={18} />
                      <input
                        type="email"
                        placeholder="exemple@mail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label>Mot de passe</label>
                    <div className="input-with-icon">
                      <KeyRound className="input-icon" size={18} />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label>Confirmer le mot de passe</label>
                    <div className="input-with-icon">
                      <ShieldCheck className="input-icon" size={18} />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', marginTop: '6px' }}
                disabled={loading || googleLoading}
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
