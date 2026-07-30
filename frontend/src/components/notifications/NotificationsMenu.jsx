import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Bell, Check, UserPlus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';

export default function NotificationsMenu() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [tradeData, friendData] = await Promise.all([api.get('/trades'), api.get('/friends')]);
      setTrades((tradeData.incoming || []).filter((trade) => trade.status === 'pending'));
      setFriendRequests(friendData.incoming || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => load(true);
    let timer = null;
    let idleId = null;

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => load(true), { timeout: 2000 });
    } else {
      timer = window.setTimeout(() => load(true), 1500);
    }

    window.addEventListener('trade_inventory_changed', refresh);
    return () => {
      if (idleId !== null) window.cancelIdleCallback(idleId);
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('trade_inventory_changed', refresh);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  const respondToFriend = async (friendshipId, action) => {
    try {
      await api.post('/friends/respond', { friendship_id: friendshipId, action });
      await load(true);
    } catch (error) {
      console.error('Failed to respond to friend request:', error);
    }
  };

  const goTo = (path) => {
    setOpen(false);
    navigate(path);
  };

  const count = trades.length + friendRequests.length;

  return (
    <div className="notifications" ref={rootRef}>
      <button
        className="app-header__icon notifications__trigger"
        type="button"
        onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); if (!open) load(); }}
        aria-label={`Notifications${count ? ` (${count})` : ''}`}
        aria-expanded={open}
      >
        <Bell size={18} />
        {count > 0 && <span>{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <section className="notifications__panel" onClick={(event) => event.stopPropagation()}>
          <header>
            <div><span className="kicker">Activité</span><h3>Notifications</h3></div>
            {count > 0 && <strong>{count} nouvelle{count > 1 ? 's' : ''}</strong>}
          </header>

          <div className="notifications__list">
            {loading && count === 0 ? <div className="trade-loading"><span className="spinner" />Chargement…</div> : null}
            {trades.map((trade) => (
              <button className="notification-item" key={`trade-${trade.id}`} onClick={() => goTo('/echanges')}>
                <span className="notification-item__icon notification-item__icon--trade"><ArrowLeftRight size={16} /></span>
                <span><strong>Nouvelle proposition</strong><small>{trade.proposer.username} souhaite échanger <b>{trade.offered_card.name}</b>.</small></span>
                <i aria-hidden="true" />
              </button>
            ))}
            {friendRequests.map((request) => (
              <div className="notification-item" key={`friend-${request.friendship_id}`}>
                <span className="notification-item__icon"><UserPlus size={16} /></span>
                <span><strong>Demande d’ami</strong><small>{request.username}<b>#{request.discriminator}</b> veut vous ajouter.</small></span>
                <span className="notification-item__actions">
                  <button type="button" onClick={() => respondToFriend(request.friendship_id, 'accept')} aria-label="Accepter"><Check size={13} /></button>
                  <button type="button" onClick={() => respondToFriend(request.friendship_id, 'decline')} aria-label="Refuser"><X size={13} /></button>
                </span>
              </div>
            ))}
            {!loading && count === 0 && (
              <div className="notifications__empty"><span><Bell size={21} /></span><strong>Vous êtes à jour</strong><small>Aucune nouvelle notification pour le moment.</small></div>
            )}
          </div>

          <footer>
            <button type="button" onClick={() => goTo('/echanges')}><ArrowLeftRight size={14} /> Voir tous les échanges</button>
            <button type="button" onClick={() => goTo('/profil')}><UserPlus size={14} /> Gérer mes amis</button>
          </footer>
        </section>
      )}
    </div>
  );
}
