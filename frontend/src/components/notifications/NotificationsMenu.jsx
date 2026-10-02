import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Bell, Check, CheckCheck, UserPlus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';

const STORAGE_KEY = 'read_notifications';

function getStoredReadIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveStoredReadIds(idsSet) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...idsSet]));
  } catch (error) {
    console.error('Failed to save read notifications:', error);
  }
}

export function useNotifications() {
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [readIds, setReadIds] = useState(getStoredReadIds);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [tradeData, friendData] = await Promise.all([api.get('/trades'), api.get('/friends')]);
      const incomingTrades = (tradeData.incoming || []).filter((trade) => trade.status === 'pending');
      const incomingFriends = friendData.incoming || [];
      setTrades(incomingTrades);
      setFriendRequests(incomingFriends);

      // Clean up stale IDs that no longer exist
      const activeIds = new Set([
        ...incomingTrades.map((t) => `trade-${t.id}`),
        ...incomingFriends.map((f) => `friend-${f.friendship_id}`),
      ]);
      setReadIds((prev) => {
        const cleaned = new Set([...prev].filter((id) => activeIds.has(id)));
        if (cleaned.size !== prev.size) {
          saveStoredReadIds(cleaned);
          return cleaned;
        }
        return prev;
      });
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

  const markAsRead = useCallback((id) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveStoredReadIds(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      trades.forEach((t) => next.add(`trade-${t.id}`));
      friendRequests.forEach((f) => next.add(`friend-${f.friendship_id}`));
      saveStoredReadIds(next);
      return next;
    });
  }, [trades, friendRequests]);

  const isRead = useCallback((id) => readIds.has(id), [readIds]);

  const respondToFriend = async (friendshipId, action) => {
    markAsRead(`friend-${friendshipId}`);
    try {
      await api.post('/friends/respond', { friendship_id: friendshipId, action });
      await load(true);
    } catch (error) {
      console.error('Failed to respond to friend request:', error);
    }
  };

  const unreadTrades = trades.filter((t) => !readIds.has(`trade-${t.id}`));
  const unreadFriendRequests = friendRequests.filter((f) => !readIds.has(`friend-${f.friendship_id}`));
  const unreadCount = unreadTrades.length + unreadFriendRequests.length;
  const totalCount = trades.length + friendRequests.length;

  return {
    trades,
    friendRequests,
    count: unreadCount,
    unreadCount,
    totalCount,
    loading,
    respondToFriend,
    markAsRead,
    markAllAsRead,
    isRead,
    load,
  };
}

export function ProfileNotifications({ notifications, onClose }) {
  const navigate = useNavigate();
  const { trades, friendRequests, unreadCount, totalCount, loading, respondToFriend, markAsRead, markAllAsRead, isRead } = notifications;

  const goTo = (path, idToMark = null) => {
    if (idToMark) markAsRead(idToMark);
    onClose?.();
    navigate(path);
  };

  return (
    <div className="app-user__notif-section">
      <div className="app-user__notif-header">
        <span className="app-user__notif-title">
          <Bell size={13} style={{ color: unreadCount > 0 ? '#ef4444' : '#94a3b8' }} />
          Notifications
        </span>
        <div className="app-user__notif-header-actions">
          {unreadCount > 0 && <span className="app-user__notif-badge">{unreadCount}</span>}
          {unreadCount > 0 && (
            <button
              type="button"
              className="app-user__notif-mark-read"
              onClick={markAllAsRead}
              title="Tout marquer comme lu"
            >
              <CheckCheck size={12} />
              Tout lire
            </button>
          )}
        </div>
      </div>

      <div className="app-user__notif-list">
        {loading && totalCount === 0 && (
          <div className="app-user__notif-loading">Chargement…</div>
        )}
        {trades.map((trade) => {
          const id = `trade-${trade.id}`;
          const read = isRead(id);
          return (
            <div
              key={id}
              className={`app-user__notif-item ${read ? 'is-read' : 'is-unread'}`}
              onClick={() => goTo('/echanges', id)}
              role="button"
              tabIndex={0}
            >
              <span className="app-user__notif-icon app-user__notif-icon--trade">
                <ArrowLeftRight size={13} />
              </span>
              <div className="app-user__notif-text">
                <strong>Offre d'échange</strong>
                <small>{trade.proposer?.username} propose {trade.offered_card?.name}</small>
              </div>
              {!read && (
                <div className="app-user__notif-actions">
                  <button
                    type="button"
                    className="notif-btn notif-btn--mark"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(id);
                    }}
                    title="Marquer comme lu"
                  >
                    <CheckCheck size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {friendRequests.map((request) => {
          const id = `friend-${request.friendship_id}`;
          const read = isRead(id);
          return (
            <div key={id} className={`app-user__notif-item ${read ? 'is-read' : 'is-unread'}`}>
              <span className="app-user__notif-icon app-user__notif-icon--friend">
                <UserPlus size={13} />
              </span>
              <div className="app-user__notif-text">
                <strong>Demande d'ami</strong>
                <small>{request.username}#{request.discriminator}</small>
              </div>
              <div className="app-user__notif-actions">
                {!read && (
                  <button
                    type="button"
                    className="notif-btn notif-btn--mark"
                    onClick={() => markAsRead(id)}
                    title="Marquer comme lu"
                  >
                    <CheckCheck size={12} />
                  </button>
                )}
                <button
                  type="button"
                  className="notif-btn notif-btn--accept"
                  onClick={() => respondToFriend(request.friendship_id, 'accept')}
                  title="Accepter"
                >
                  <Check size={12} />
                </button>
                <button
                  type="button"
                  className="notif-btn notif-btn--decline"
                  onClick={() => respondToFriend(request.friendship_id, 'decline')}
                  title="Refuser"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          );
        })}
        {!loading && totalCount === 0 && (
          <div className="app-user__notif-empty">
            Aucune notification
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfileNotifications;
