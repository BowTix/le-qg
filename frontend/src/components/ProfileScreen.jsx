import React, { useEffect, useState, useRef } from 'react';
import { api, PUBLIC_BASE } from '../utils/api';
import { ArrowLeft, User, KeyRound, Award, Heart, UserPlus, UserMinus, Check, X, ShieldAlert, BookOpen, Edit3, Image, LogOut, Trophy, Coins } from 'lucide-react';
import { getLevel, getLevelBadge, getLevelProgressDetails, getUsernameStyle, getEloRank } from '../utils/progression';

export default function ProfileScreen({ user, onBack, onUpdateUserStats }) {
  // Modal visibility
  const [showEditModal, setShowEditModal] = useState(false);

  // Edit form states
  const [username, setUsername] = useState(user.username || '');
  const [bio, setBio] = useState(user.bio || '');
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar_url || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Edit feedback
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [updating, setUpdating] = useState(false);

  // Friends states
  const [friendsList, setFriendsList] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [newFriendUsername, setNewFriendUsername] = useState('');
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState('');
  const [friendsSuccess, setFriendsSuccess] = useState('');

  // Autocomplete player search states
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFriends();
    
    // Close search suggestions on click outside
    const handleClose = () => setShowSuggestions(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const handleSearchChange = async (e) => {
    const val = e.target.value;
    setNewFriendUsername(val);
    
    if (val.trim().length >= 2) {
      try {
        const res = await api.get('/friends/search', { query: val.trim() });
        if (res.success) {
          setSearchResults(res.users || []);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      }
    } else {
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  const fetchFriends = async () => {
    setFriendsLoading(true);
    setFriendsError('');
    try {
      const res = await api.get('/friends');
      if (res.success) {
        setFriendsList(res.friends || []);
        setIncomingRequests(res.incoming || []);
        setOutgoingRequests(res.outgoing || []);
      }
    } catch (err) {
      setFriendsError("Impossible de charger la liste d'amis.");
    } finally {
      setFriendsLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');
    setUpdating(true);

    try {
      const res = await api.put('/auth/profile', {
        username,
        bio,
        avatar_url: selectedAvatar,
        current_password: currentPassword,
        new_password: newPassword
      });

      if (res.success) {
        setProfileSuccess(res.message || "Profil mis à jour avec succès !");
        
        if (res.token) {
          localStorage.setItem('quiz_token', res.token);
        }
        
        onUpdateUserStats(res.user);
        setCurrentPassword('');
        setNewPassword('');
        
        // Close modal after brief success timeout
        setTimeout(() => {
          setShowEditModal(false);
          setProfileSuccess('');
        }, 1200);
      }
    } catch (err) {
      setProfileError(err.message || "Erreur lors de la mise à jour.");
    } finally {
      setUpdating(false);
    }
  };

  // Upload picture handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    setUpdating(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const res = await api.post('/auth/upload-avatar', formData);
      if (res.success) {
        setSelectedAvatar(res.avatar_url);
        setProfileSuccess("Image d'avatar téléversée ! N'oubliez pas d'enregistrer.");
        
        // Instantly update parent state
        onUpdateUserStats({ ...user, avatar_url: res.avatar_url });
      }
    } catch (err) {
      setProfileError(err.message || "Erreur de téléversement de l'image.");
    } finally {
      setUpdating(false);
    }
  };

  const handleSendFriendRequest = async (e) => {
    e.preventDefault();
    setFriendsSuccess('');
    setFriendsError('');

    const target = newFriendUsername.trim();
    if (!target) return;

    try {
      const res = await api.post('/friends/request', { friend_username: target });
      setFriendsSuccess(res.message || "Demande d'ami envoyée !");
      setNewFriendUsername('');
      fetchFriends();
    } catch (err) {
      setFriendsError(err.message || "Impossible d'envoyer la demande.");
    }
  };

  const handleFriendAction = async (friendshipId, action) => {
    setFriendsSuccess('');
    setFriendsError('');
    try {
      const res = await api.post('/friends/respond', { friendship_id: friendshipId, action });
      setFriendsSuccess(res.message || "Action enregistrée.");
      fetchFriends();
    } catch (err) {
      setFriendsError(err.message || "Erreur lors de la réponse.");
    }
  };

  const handleRemoveFriend = async (friendshipId) => {
    if (!window.confirm("Voulez-vous vraiment retirer cette personne de vos amis ?")) return;
    setFriendsSuccess('');
    setFriendsError('');
    try {
      const res = await api.delete('/friends/remove', { friendship_id: friendshipId });
      setFriendsSuccess(res.message || "Ami retiré.");
      fetchFriends();
    } catch (err) {
      setFriendsError(err.message || "Erreur de suppression.");
    }
  };

  // Progression detail helpers
  const lvl = getLevel(user.global_score);
  const badgeLabel = getLevelBadge(lvl);
  const nameStyle = getUsernameStyle(user.global_score);
  const { currentLevelXp, xpNeededForNextLevel } = getLevelProgressDetails(user.global_score);

  // Avatar helper
  const renderAvatar = (url, size = '100px', fontSize = '3.5rem') => {
    if (!url) {
      return (
        <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <User size={size === '100px' ? 44 : 24} />
        </div>
      );
    }

    if (url.startsWith('/uploads/')) {
      return (
        <img 
          src={`${PUBLIC_BASE}${url}`} 
          alt="Avatar" 
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-secondary)', boxShadow: '0 0 15px var(--accent-secondary-glow)' }}
        />
      );
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return (
        <img 
          src={url} 
          alt="Avatar" 
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-secondary)', boxShadow: '0 0 15px var(--accent-secondary-glow)' }}
        />
      );
    }

    // Emoji preset (fallback)
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, border: '2px solid var(--accent-secondary)', boxShadow: '0 0 15px var(--accent-secondary-glow)' }}>
        {url}
      </div>
    );
  };

  return (
    <div className="container animate-slide-up" style={{ gap: '32px' }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn-secondary" onClick={onBack} style={{ padding: '8px 16px' }}>
          <ArrowLeft size={16} />
          Retour
        </button>
        <h2 style={{ fontSize: '1.6rem', color: 'var(--accent)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={22} style={{ color: 'var(--accent)' }} />
          Carte de Joueur
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', md: '1.2fr 1fr', gap: '32px', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        
        {/* LEFT: Gorgeous Public Profile Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', position: 'relative', overflow: 'hidden', padding: '40px 32px' }}>
          
          {/* Neon background effect */}
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: '65%', left: 0, background: 'linear-gradient(180deg, var(--accent-glow) 0%, transparent 100%)', pointerEvents: 'none', opacity: 0.7 }} />

          {/* Large Avatar container */}
          <div style={{ position: 'relative', zIndex: 10 }}>
            {renderAvatar(user.avatar_url, '110px', '4rem')}
          </div>

          {/* Name & Title */}
          <div style={{ textAlign: 'center', zIndex: 10 }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
              <span style={nameStyle}>{user.username}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 500 }}>#{user.discriminator}</span>
            </h1>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginTop: '4px', display: 'block' }}>
              {badgeLabel} (Lvl {lvl})
            </span>
          </div>

          {/* Bio blockquote */}
          <div style={{ width: '100%', padding: '16px 20px', backgroundColor: 'var(--bg-input)', borderRadius: '12px', borderLeft: '3px solid var(--accent)', fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.95rem', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            {user.bio ? `"${user.bio}"` : "Aucune biographie rédigée pour le moment."}
          </div>

          {/* XP Progress Bar */}
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
              <span>Progression du Niveau</span>
              <span>{currentLevelXp} / {xpNeededForNextLevel} XP</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${(currentLevelXp / xpNeededForNextLevel) * 100}%`, height: '100%', backgroundColor: 'var(--accent-secondary)', transition: 'width 0.4s ease-out' }} />
            </div>
          </div>

          {/* Gaming Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%', marginTop: '10px' }}>
            <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Rang Arène</span>
              {(() => {
                const rank = getEloRank(user.elo);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: rank.color, textShadow: rank.glow }}>
                      <Trophy size={16} />
                      <strong style={{ fontSize: '1.25rem' }}>{rank.name}</strong>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{user.elo} Elo</span>
                  </div>
                );
              })()}
            </div>

            <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Monnaie</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Coins size={18} style={{ color: '#ffb300' }} />
                <strong style={{ fontSize: '1.4rem', color: '#ffb300' }}>{user.coins || 0}</strong>
              </div>
            </div>
          </div>

          {/* Edit Profile Button */}
          <button className="btn-primary" onClick={() => {
            setUsername(user.username);
            setBio(user.bio || '');
            setSelectedAvatar(user.avatar_url || '');
            setShowEditModal(true);
          }} style={{ width: '100%', marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <Edit3 size={18} />
            Modifier mes informations
          </button>
        </div>

        {/* RIGHT: Friends System Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Heart size={20} style={{ color: 'var(--accent)' }} />
            Mes Amis
          </h3>

          {friendsSuccess && (
            <div style={{ backgroundColor: 'var(--success-glow)', color: 'var(--success)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(0, 255, 157, 0.2)', fontSize: '0.9rem' }}>
              {friendsSuccess}
            </div>
          )}
          {friendsError && (
            <div style={{ backgroundColor: 'var(--error-glow)', color: 'var(--error)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255, 59, 105, 0.2)', fontSize: '0.9rem' }}>
              {friendsError}
            </div>
          )}

          {/* Add Friend Form */}
          <form onSubmit={handleSendFriendRequest} style={{ display: 'flex', gap: '8px', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                placeholder="Pseudo de votre ami (ex: Mathis#1234)..."
                value={newFriendUsername}
                onChange={handleSearchChange}
                onFocus={() => { if (newFriendUsername.trim().length >= 2) setShowSuggestions(true); }}
                required
                style={{ width: '100%' }}
              />
              {showSuggestions && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--card-shadow)',
                  zIndex: 50,
                  marginTop: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {searchResults.map((u) => (
                    <div
                      key={`${u.username}#${u.discriminator}`}
                      onClick={() => {
                        setNewFriendUsername(`${u.username}#${u.discriminator}`);
                        setShowSuggestions(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                        transition: 'var(--transition-smooth)'
                      }}
                      className="suggestion-item"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {renderAvatar(u.avatar_url, '24px', '0.9rem')}
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {u.username}
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>#{u.discriminator}</span>
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)' }}>
                        🏆 {u.elo}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '0 18px' }}>
              <UserPlus size={18} />
            </button>
          </form>

          {/* Incoming Pending Requests */}
          {incomingRequests.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-secondary)', marginBottom: '8px' }}>
                Demandes Reçues ({incomingRequests.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {incomingRequests.map((req) => (
                  <div key={req.friendship_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {renderAvatar(req.avatar_url, '32px', '1.1rem')}
                      <span style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                        <strong style={{ fontSize: '0.9rem' }}>{req.username}</strong>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>#{req.discriminator}</span>
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Lvl {getLevel(req.global_score)})</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn-primary" onClick={() => handleFriendAction(req.friendship_id, 'accept')} style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', boxShadow: 'none' }}>
                        <Check size={14} />
                      </button>
                      <button className="btn-danger" onClick={() => handleFriendAction(req.friendship_id, 'decline')} style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px' }}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outgoing Pending Requests */}
          {outgoingRequests.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Demandes Envoyées ({outgoingRequests.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {outgoingRequests.map((req) => (
                  <div key={req.friendship_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {renderAvatar(req.avatar_url, '32px', '1.1rem')}
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                        {req.username}
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.75rem' }}>#{req.discriminator}</span>
                      </span>
                    </div>
                    <button className="btn-secondary" onClick={() => handleRemoveFriend(req.friendship_id)} style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px' }}>
                      Annuler
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accepted Friends List */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Mes Amis ({friendsList.length})
            </h4>
            
            {friendsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Chargement...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                {friendsList.map((friend) => (
                  <div 
                    key={friend.friendship_id} 
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {renderAvatar(friend.avatar_url, '36px', '1.25rem')}
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                          <strong style={{ fontSize: '0.95rem' }}>{friend.username}</strong>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}>#{friend.discriminator}</span>
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Lvl {getLevel(friend.global_score)})</span>
                      </div>
                      
                      <button 
                        onClick={() => handleRemoveFriend(friend.friendship_id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                        title="Retirer des amis"
                      >
                        <UserMinus size={16} />
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '4px', alignItems: 'center' }}>
                      {(() => {
                        const rank = getEloRank(friend.elo);
                        return (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: rank.color, textShadow: rank.glow }}>
                            <Trophy size={12} />
                            <span>{rank.name} ({friend.elo})</span>
                          </span>
                        );
                      })()}
                      {friend.bio && (
                        <span style={{ fontStyle: 'italic', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={friend.bio}>
                          "{friend.bio}"
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {friendsList.length === 0 && (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'rgba(0,0,0,0.08)',
                    borderRadius: '8px',
                    border: '1px dashed var(--border-color)',
                    fontSize: '0.85rem'
                  }}>
                    Pas encore d'amis. Recherchez un pseudo ci-dessus pour envoyer une demande !
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODIFICATION MODAL */}
      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 200,
          backdropFilter: 'blur(8px)'
        }}>
          <div className="glass-card animate-slide-up" style={{ width: '100%', maxWidth: '580px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} style={{ color: 'var(--accent)' }} />
                Modifier mes informations
              </h3>
              <button 
                onClick={() => setShowEditModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {profileSuccess && (
              <div style={{ backgroundColor: 'var(--success-glow)', color: 'var(--success)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(0, 255, 157, 0.2)', fontSize: '0.9rem' }}>
                {profileSuccess}
              </div>
            )}
            {profileError && (
              <div style={{ backgroundColor: 'var(--error-glow)', color: 'var(--error)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255, 59, 105, 0.2)', fontSize: '0.9rem' }}>
                {profileError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Picture Upload & Preview */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                  Photo de Profil
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
                  {renderAvatar(selectedAvatar, '64px', '2.2rem')}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Hidden File Input */}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                    />
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      onClick={() => fileInputRef.current?.click()} 
                      style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Image size={14} />
                      Importer de mon PC
                    </button>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Format JPEG, PNG, GIF, WEBP max 2Mo</span>
                  </div>
                </div>


              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  Pseudo
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nouveau pseudo"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  Biographie
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Décrivez-vous en quelques mots..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: 'var(--bg-input)',
                    border: '2px solid var(--border-color)',
                    borderRadius: '12px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />

              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={14} style={{ color: 'var(--accent)' }} />
                Sécurité : Modifier le mot de passe (optionnel)
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Mot de passe actuel</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nouveau mot de passe</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)} disabled={updating}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={updating}>
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

