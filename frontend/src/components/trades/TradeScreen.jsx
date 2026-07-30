import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Coins, Loader2, RefreshCw, ShoppingBag, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Pusher from 'pusher-js';
import { api } from '../../utils/api';

const STATUS = { pending: 'En attente', accepted: 'Accepté', declined: 'Refusé', cancelled: 'Annulé' };

function TradeRow({ trade, onAction, busy }) {
  const incoming = trade.direction === 'incoming';
  const other = incoming ? trade.proposer : trade.recipient;
  return (
    <article className="trade-inbox__row trade-page__row">
      <div className="trade-inbox__row-head">
        <strong>{other.username}<small>#{other.discriminator}</small></strong>
        <span className={`trade-status trade-status--${trade.status}`}>{STATUS[trade.status]}</span>
      </div>
      <div className="trade-inbox__cards">
        <span><small>{incoming ? 'Vous recevez' : 'Vous offrez'}</small><strong>{trade.offered_card.name}</strong><em>{trade.offered_card.rarity}</em></span>
        <ArrowLeftRight size={17} />
        <span><small>{incoming ? 'Vous donnez' : 'Vous demandez'}</small><strong>{trade.requested_card.name}</strong><em>{trade.requested_card.rarity}</em></span>
      </div>
      {trade.coin_fee > 0 && <p><Coins size={13} />{trade.viewer_pays_fee ? `Vous payez ${trade.coin_fee} pièces` : `${other.username} paie ${trade.coin_fee} pièces`}</p>}
      {trade.status === 'pending' && (
        <div className="trade-inbox__actions">
          {incoming ? <>
            <button className="btn-primary" disabled={busy} onClick={() => onAction(trade.id, 'accept')}><Check size={14} />Accepter</button>
            <button className="btn-secondary" disabled={busy} onClick={() => onAction(trade.id, 'decline')}><X size={14} />Refuser</button>
          </> : <button className="btn-secondary" disabled={busy} onClick={() => onAction(trade.id, 'cancel')}><X size={14} />Annuler la proposition</button>}
        </div>
      )}
    </article>
  );
}

export default function TradeScreen({ user }) {
  const navigate = useNavigate();
  const [data, setData] = useState({ incoming: [], outgoing: [], pending_count: 0 });
  const [tab, setTab] = useState('incoming');
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pusherRef = useRef(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      setData(await api.get('/trades'));
    } catch (requestError) {
      setError(requestError.message || 'Impossible de charger vos échanges.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 30000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!data.pusher_key || !user?.id || pusherRef.current) return undefined;
    const pusher = new Pusher(data.pusher_key, { cluster: data.pusher_cluster || 'eu' });
    const channel = pusher.subscribe(`user-${user.id}`);
    ['trade_created', 'trade_accepted', 'trade_declined', 'trade_cancelled'].forEach((event) => {
      channel.bind(event, () => {
        load(true);
        window.dispatchEvent(new Event('trade_inventory_changed'));
      });
    });
    pusherRef.current = pusher;
    return () => {
      pusher.disconnect();
      pusherRef.current = null;
    };
  }, [data.pusher_key, data.pusher_cluster, user?.id, load]);

  const act = async (id, action) => {
    setBusy(id);
    try {
      if (action === 'cancel') await api.post('/trades/cancel', { trade_id: id });
      else await api.post('/trades/respond', { trade_id: id, action });
      await load(true);
      window.dispatchEvent(new Event('trade_inventory_changed'));
    } catch (requestError) {
      setError(requestError.message || "Impossible de traiter l'échange.");
    } finally {
      setBusy(null);
    }
  };

  const trades = data[tab] || [];
  const sentPending = data.outgoing?.filter((trade) => trade.status === 'pending').length || 0;

  return (
    <div className="trade-page animate-fade-in">
      <header className="trade-page__hero">
        <div><span className="kicker">Marché privé</span><h1>Mes échanges</h1><p>Retrouvez vos propositions, comparez les cartes et répondez aux offres de vos amis.</p></div>
        <button className="btn-primary" type="button" onClick={() => navigate('/collection')}><ShoppingBag size={16} /> Choisir une carte à échanger</button>
      </header>
      <section className="trade-page__stats" aria-label="Résumé des échanges">
        <div><span>À traiter</span><strong>{data.pending_count || 0}</strong><small>propositions reçues</small></div>
        <div><span>En attente</span><strong>{sentPending}</strong><small>propositions envoyées</small></div>
        <div><span>Historique</span><strong>{(data.incoming?.length || 0) + (data.outgoing?.length || 0)}</strong><small>échanges au total</small></div>
      </section>
      <section className="trade-page__content">
        <div className="trade-page__toolbar">
          <div className="trade-inbox__tabs" role="tablist" aria-label="Catégorie d'échanges">
            <button className={tab === 'incoming' ? 'active' : ''} onClick={() => setTab('incoming')} role="tab" aria-selected={tab === 'incoming'}>Reçus {data.pending_count > 0 && <span>{data.pending_count}</span>}</button>
            <button className={tab === 'outgoing' ? 'active' : ''} onClick={() => setTab('outgoing')} role="tab" aria-selected={tab === 'outgoing'}>Envoyés</button>
          </div>
          <button className="trade-page__refresh" type="button" onClick={() => load()} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser</button>
        </div>
        {error && <p className="trade-page__error">{error}</p>}
        {loading ? <div className="trade-loading"><Loader2 className="animate-spin" />Chargement de vos échanges…</div> : trades.length ? (
          <div className="trade-page__list">{trades.map((trade) => <TradeRow key={trade.id} trade={trade} onAction={act} busy={busy === trade.id} />)}</div>
        ) : (
          <div className="trade-page__empty">
            <span><ArrowLeftRight size={24} /></span><h2>Aucun échange {tab === 'incoming' ? 'reçu' : 'envoyé'}</h2>
            <p>{tab === 'incoming' ? 'Les propositions de vos amis apparaîtront ici.' : 'Parcourez votre collection pour proposer votre premier échange.'}</p>
            {tab === 'outgoing' && <button className="btn-primary" onClick={() => navigate('/collection')}>Voir ma collection</button>}
          </div>
        )}
      </section>
    </div>
  );
}
