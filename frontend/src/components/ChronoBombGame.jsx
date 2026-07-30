import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bomb, Heart, Send, Skull, Zap } from 'lucide-react';

export default function ChronoBombGame({ data, players, userId, roomCode, api, onRefresh, onPass }) {
  const [answer, setAnswer] = useState('');
  const [remainingMs, setRemainingMs] = useState(data.remaining_ms || 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const refreshTriggeredRef = useRef(false);

  const currentPlayer = useMemo(
    () => players.find((player) => player.user_id === data.current_player_id),
    [players, data.current_player_id],
  );
  const explodedPlayer = useMemo(
    () => players.find((player) => player.user_id === data.last_exploded_user_id),
    [players, data.last_exploded_user_id],
  );
  const isMyTurn = data.phase === 'active' && data.current_player_id === userId;

  useEffect(() => {
    setRemainingMs(data.remaining_ms || 0);
    refreshTriggeredRef.current = false;
    if (data.phase !== 'active') {
      setAnswer('');
      setError('');
    }
  }, [data.remaining_ms, data.phase, data.round, data.current_player_id]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemainingMs((value) => Math.max(0, value - 100));
    }, 100);
    return () => window.clearInterval(interval);
  }, [data.phase, data.round]);

  useEffect(() => {
    if (remainingMs > 0 || refreshTriggeredRef.current) return;
    refreshTriggeredRef.current = true;
    const timeout = window.setTimeout(onRefresh, 120);
    return () => window.clearTimeout(timeout);
  }, [remainingMs, onRefresh]);

  useEffect(() => {
    if (isMyTurn) {
      document.getElementById('chrono-bomb-answer')?.focus();
    }
  }, [isMyTurn, data.current_player_id]);

  const submitAnswer = async (event) => {
    event.preventDefault();
    const value = answer.trim();
    if (!value || !isMyTurn || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.post('/lobby/chrono-bomb/answer', { room_code: roomCode, answer: value });
      setAnswer('');
      onPass(result);
    } catch (submitError) {
      setError(submitError.message || 'Réponse refusée.');
    } finally {
      setSubmitting(false);
    }
  };

  const danger = remainingMs <= 5000;
  const fuseRatio = Math.max(0, Math.min(1, remainingMs / 25000));

  if (data.phase === 'exploded') {
    return (
      <section className="chrono-game chrono-game--exploded">
        <div className="chrono-explosion" aria-hidden="true">💥</div>
        <span className="chrono-kicker">BOUM !</span>
        <h1>{explodedPlayer?.username || 'La bombe'} perd une vie</h1>
        <p>Nouvelle contrainte dans un instant…</p>
        <div className="chrono-roster">
          {players.map((player) => (
            <PlayerLives key={player.user_id} player={player} active={false} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={`chrono-game ${danger ? 'chrono-game--danger' : ''}`}>
      <header className="chrono-header">
        <div>
          <span className="chrono-kicker">Chrono-Bomb · Manche {data.round}</span>
          <h1>{data.prompt_text}</h1>
        </div>
        <div className="chrono-bomb" aria-label="Bombe active">
          <span className="chrono-bomb__spark">✦</span>
          <Bomb size={58} strokeWidth={1.8} />
        </div>
      </header>

      <div className="chrono-fuse" aria-hidden="true">
        <span style={{ transform: `scaleX(${fuseRatio})` }} />
      </div>

      <div className="chrono-turn">
        <Zap size={18} />
        {isMyTurn ? (
          <strong>À toi ! Donne une réponse valide.</strong>
        ) : (
          <span>La bombe est chez <strong>{currentPlayer?.username || 'un joueur'}</strong></span>
        )}
      </div>

      <form className="chrono-answer-form" onSubmit={submitAnswer}>
        <input
          id="chrono-bomb-answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder={isMyTurn ? 'Tape ta réponse…' : 'Attends ton tour…'}
          maxLength={180}
          disabled={!isMyTurn || submitting}
          autoComplete="off"
        />
        <button type="submit" disabled={!isMyTurn || !answer.trim() || submitting}>
          <Send size={18} />
          {submitting ? 'Validation…' : 'Refiler'}
        </button>
      </form>
      {error && <p className="chrono-error">{error}</p>}

      <div className="chrono-layout">
        <div className="chrono-roster">
          {players
            .slice()
            .sort((a, b) => (a.chrono_turn_order ?? 99) - (b.chrono_turn_order ?? 99))
            .map((player) => (
              <PlayerLives
                key={player.user_id}
                player={player}
                active={player.user_id === data.current_player_id}
              />
            ))}
        </div>

        <aside className="chrono-history">
          <h2>Réponses utilisées</h2>
          {data.used_answers?.length ? (
            <div className="chrono-history__list">
              {data.used_answers.map((item, index) => (
                <span key={`${item.user_id}-${item.answer}-${index}`}>
                  <strong>{item.answer}</strong>
                  <small>{item.username}</small>
                </span>
              ))}
            </div>
          ) : (
            <p>Aucune pour l’instant. La mèche brûle…</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function PlayerLives({ player, active }) {
  return (
    <div className={`chrono-player ${active ? 'chrono-player--active' : ''} ${player.is_eliminated ? 'chrono-player--out' : ''}`}>
      <div>
        <strong>{player.username}</strong>
        {active && <small>La bombe est ici</small>}
      </div>
      <span className="chrono-player__lives" aria-label={`${player.chrono_lives} vies`}>
        {player.is_eliminated ? (
          <Skull size={19} />
        ) : (
          Array.from({ length: 3 }, (_, index) => (
            <Heart key={index} size={17} fill={index < player.chrono_lives ? 'currentColor' : 'none'} />
          ))
        )}
      </span>
    </div>
  );
}
