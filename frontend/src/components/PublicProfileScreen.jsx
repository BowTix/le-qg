import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, BookOpen, Copy, Layers3, Sparkles, Trophy } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, PUBLIC_BASE } from '../utils/api';
import { getLevel } from '../utils/progression';
import GameCard from './GameCard';
import TradeModal from './trades/TradeModal';

function PublicAvatar({ user }) {
  const value = user?.avatar_url;
  const className = `public-profile__avatar ${user?.equipped_border || ''}`;
  if (value?.startsWith('/uploads/')) return <img className={className} src={`${PUBLIC_BASE}${value}`} alt="" />;
  if (value?.startsWith('http')) return <img className={className} src={value} alt="" />;
  return <span className={className}>{value || user?.username?.[0]?.toUpperCase() || 'U'}</span>;
}

export default function PublicProfileScreen() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tradeOpen, setTradeOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get(`/users/profile?id=${encodeURIComponent(userId)}`)
      .then((response) => { if (active) setData(response); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Impossible de charger ce profil.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const groupedCards = useMemo(() => {
    const groups = new Map();
    for (const card of data?.collection?.cards || []) {
      const setName = card.set || 'Autres cartes';
      if (!groups.has(setName)) groups.set(setName, []);
      groups.get(setName).push(card);
    }
    return [...groups.entries()];
  }, [data]);

  const handleWheel = (event) => {
    const rail = event.currentTarget;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta || rail.scrollWidth <= rail.clientWidth) return;
    event.preventDefault();
    event.stopPropagation();
    rail.scrollLeft += delta;
  };

  if (loading) return <div className="screen-loader"><span className="spinner spinner-lg" /><p>Chargement du profil…</p></div>;
  if (error || !data?.user) return <div className="public-profile public-profile--error"><button className="btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Retour</button><div className="glass-card"><h2>Profil indisponible</h2><p>{error || 'Cet utilisateur est introuvable.'}</p></div></div>;

  const { user, collection } = data;
  const level = getLevel(user.global_score);
  const completion = collection.total_cards > 0 ? Math.round((collection.unique_cards / collection.total_cards) * 100) : 0;

  return (
    <div className="public-profile animate-fade-in">
      <div className="public-profile__toolbar">
        <button className="btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Retour</button>
        <div className="public-profile__toolbar-actions">
          {user.is_friend && <button className="btn-primary" onClick={() => setTradeOpen(true)}><ArrowLeftRight size={15} /> Proposer un échange</button>}
          <button className="public-profile__share" onClick={() => navigator.clipboard?.writeText(window.location.href)}><Copy size={14} /> Copier le lien</button>
        </div>
      </div>

      <section className="public-profile__hero">
        <div className="public-profile__identity">
          <PublicAvatar user={user} />
          <div>
            {user.equipped_title && <span className="kicker">{user.equipped_title}</span>}
            <h1 className={user.equipped_color === 'rainbow' ? 'text-rainbow' : user.equipped_color === 'cyberpunk' ? 'text-cyberpunk' : ''} style={user.equipped_color && !['rainbow', 'cyberpunk'].includes(user.equipped_color) ? { color: user.equipped_color } : undefined}>{user.username}<small>#{user.discriminator}</small></h1>
            <p>{user.bio || 'Ce joueur garde encore un peu de mystère.'}</p>
          </div>
        </div>
        <div className="public-profile__stats">
          <div><span><Sparkles size={17} /> Niveau</span><strong>{level}</strong><small>{user.global_score.toLocaleString('fr-FR')} XP</small></div>
          <div><span><Layers3 size={17} /> Collection</span><strong>{collection.unique_cards}<small>/{collection.total_cards}</small></strong><small>{completion}% complété</small></div>
          <div><span><Trophy size={17} /> Valeur</span><strong>{collection.value.toLocaleString('fr-FR')}</strong><small>{collection.total_copies} exemplaires</small></div>
        </div>
      </section>

      <section className="public-profile__collection">
        <header><div><span className="kicker">Album public</span><h2>Sa collection</h2></div><span>{collection.unique_cards} cartes uniques</span></header>
        {groupedCards.length > 0 ? groupedCards.map(([setName, cards]) => (
          <article className="public-profile__set" key={setName}>
            <div className="public-profile__set-heading"><div><BookOpen size={18} /><h3>{setName}</h3></div><span>{cards.length} carte{cards.length > 1 ? 's' : ''}</span></div>
            <div className="public-profile__rail" onWheelCapture={handleWheel}>
              {cards.map((card) => <GameCard key={card.id} card={card} quantity={card.quantity} isFoil />)}
            </div>
          </article>
        )) : <div className="public-profile__empty"><Layers3 size={34} /><h3>Collection encore vide</h3><p>Ce joueur n’a pas encore découvert de carte.</p></div>}
      </section>
      {tradeOpen && <TradeModal friendId={user.id} onClose={() => setTradeOpen(false)} onSent={() => alert('Proposition envoyée !')} />}
    </div>
  );
}
