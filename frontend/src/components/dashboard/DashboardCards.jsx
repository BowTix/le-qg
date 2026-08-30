import React, { useState } from 'react';
import {
  ArrowRight,
  Bomb,
  ChevronRight,
  Coins,
  Gamepad2,
  Grid3X3,
  LayoutGrid,
  Lightbulb,
  LockKeyhole,
  Play,
  Plus,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
  Check,
  Zap,
  X,
} from 'lucide-react';
import { GAME_CATEGORIES, getSoloGamesByCategory } from '../../utils/gamesCatalog';

export function ProgressBar({ value, color = '#2dd4bf' }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <span className="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={safeValue} aria-label={`${safeValue}%`}>
      <span className="progress-track__value" style={{ width: `${safeValue}%`, background: color }} />
    </span>
  );
}

function DailyQuizArtwork({ completed }) {
  return (
    <svg className={`daily-artwork${completed ? ' is-completed' : ''}`} viewBox="0 0 360 430" aria-hidden="true">
      <defs>
        <linearGradient id="daily-card-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#99f6e4" stopOpacity=".28" />
          <stop offset="1" stopColor="#0f172a" stopOpacity=".5" />
        </linearGradient>
        <linearGradient id="daily-card-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ccfbf1" stopOpacity=".72" />
          <stop offset="1" stopColor="#2dd4bf" stopOpacity=".18" />
        </linearGradient>
        <filter id="daily-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>

      <circle cx="202" cy="207" r="122" fill="none" stroke="#99f6e4" strokeOpacity=".12" />
      <circle cx="202" cy="207" r="91" fill="none" stroke="#99f6e4" strokeOpacity=".08" strokeDasharray="5 10" />
      <circle cx="202" cy="207" r="72" fill="#2dd4bf" fillOpacity=".15" filter="url(#daily-glow)" />

      <g className="daily-artwork__back-card daily-artwork__back-card--left" transform="translate(70 100) rotate(-17 93 135)">
        <rect width="186" height="270" rx="25" fill="#0f172a" fillOpacity=".31" stroke="#99f6e4" strokeOpacity=".3" strokeWidth="2" />
        <rect x="15" y="15" width="156" height="240" rx="17" fill="none" stroke="#ccfbf1" strokeOpacity=".12" />
      </g>
      <g className="daily-artwork__back-card daily-artwork__back-card--right" transform="translate(115 73) rotate(14 93 135)">
        <rect width="186" height="270" rx="25" fill="#0f172a" fillOpacity=".35" stroke="#99f6e4" strokeOpacity=".34" strokeWidth="2" />
        <rect x="15" y="15" width="156" height="240" rx="17" fill="none" stroke="#ccfbf1" strokeOpacity=".13" />
      </g>

      <g className="daily-artwork__main-card" transform="translate(91 75)">
        <rect width="186" height="270" rx="27" fill="url(#daily-card-fill)" stroke="url(#daily-card-stroke)" strokeWidth="2.5" />
        <rect x="14" y="14" width="158" height="242" rx="19" fill="none" stroke="#f0fdfa" strokeOpacity=".18" />
        <path d="M43 56h32M43 67h19M111 204h32M124 215h19" stroke="#ccfbf1" strokeOpacity=".42" strokeWidth="3" strokeLinecap="round" />
        <circle cx="93" cy="135" r="53" fill="#0f172a" fillOpacity=".32" stroke="#99f6e4" strokeOpacity=".3" />
        {completed ? (
          <path d="m68 136 17 17 34-40" fill="none" stroke="#ccfbf1" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <text x="93" y="158" fill="#ccfbf1" fillOpacity=".9" fontFamily="Cabinet Grotesk, sans-serif" fontSize="67" fontWeight="800" textAnchor="middle">?</text>
        )}
      </g>

      <g fill="#ccfbf1">
        <path d="m57 71 4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z" fillOpacity=".62" />
        <path d="m307 123 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" fillOpacity=".5" />
        <circle cx="51" cy="331" r="4" fillOpacity=".45" />
        <circle cx="310" cy="310" r="6" fillOpacity=".28" />
      </g>
    </svg>
  );
}

export function DailyHero({ completed, attempt, stats, onStart }) {
  const answers = [attempt?.q1_correct, attempt?.q2_correct, attempt?.q3_correct];
  const correctCount = answers.filter(Boolean).length;

  return (
    <article className="dashboard-card dashboard-card--hero">
      <span className="hero-card-shape" aria-hidden="true" />
      <div className="daily-hero-layout">
        <div className="daily-hero-copy">
          <span className="kicker">Quiz du jour</span>
          <h2>{completed ? 'Défi relevé.' : 'Le quiz du jour.'}</h2>
          <p>{completed ? 'Ton résultat est enregistré. Une nouveau quiz t’attendra demain.' : 'Trois questions, une seule mission. Faire un sans-faute.'}</p>
          <div className="daily-hero-action">
            {completed ? <span className="daily-result__status"><LockKeyhole size={14} /> Prochain quiz demain</span> : <button className="button button--dark" type="button" onClick={onStart}>Lancer le quiz <ArrowRight size={17} /></button>}
          </div>
        </div>
        <div className={`daily-hero-visual${completed ? ' is-completed' : ''}`}>
          <DailyQuizArtwork completed={completed} />
          <div className={`daily-result${completed ? ' is-visible' : ''}`} aria-hidden={!completed}>
            <div className="daily-result__score"><strong>{correctCount}<span>/3</span></strong><small>{attempt?.score || 0} points</small></div>
            <div className="daily-result__answers" aria-label={`${correctCount} bonnes réponses sur 3`}>
              {answers.map((correct, index) => <span key={index} className={correct ? 'is-correct' : 'is-wrong'}>{correct ? <Check size={15} /> : <X size={15} />}</span>)}
            </div>
            {stats?.total > 1 && <p>Avec {stats.total.toLocaleString('fr-FR')} participants aujourd’hui</p>}
          </div>
        </div>
      </div>
    </article>
  );
}

function PortalGame({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  onClick,
  disabled = false,
  accent = 'teal',
}) {
  return (
    <button
      className={`portal-game portal-game--${accent}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="portal-game__icon"><Icon size={20} /></span>
      <span className="portal-game__copy">
        <small>{eyebrow}</small>
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </span>
      <span className="portal-game__action">{action}{!disabled && <ChevronRight size={15} />}</span>
    </button>
  );
}

export function SoloPortal({ completed, attempt, onStartDaily, onStartQuiz }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const answers = [attempt?.q1_correct, attempt?.q2_correct, attempt?.q3_correct];
  const correctCount = answers.filter(Boolean).length;

  const filteredGames = getSoloGamesByCategory(selectedCategory);

  const handleGameAction = (gameId) => {
    if (gameId === 'kculture') {
      onStartQuiz();
    }
  };

  return (
    <article className="mode-portal mode-portal--solo">
      <span className="mode-portal__glow" aria-hidden="true" />
      <header className="mode-portal__header">
        <div>
          <span className="mode-portal__eyebrow"><Gamepad2 size={13} /> Mode solo & passe-temps</span>
          <h2>Pause & Détente</h2>
          <p>Quelques minutes devant toi ? Choisis ton défi et joue à ton rythme.</p>
        </div>
        <span className="mode-portal__status"><span /> Hub disponible hors ligne</span>
      </header>

      <div className="solo-portal__games">
        <button className={`daily-portal${completed ? ' is-completed' : ''}`} type="button" onClick={onStartDaily} disabled={completed}>
          <span className="daily-portal__copy">
            <small>Le défi à ne pas manquer</small>
            <strong>{completed ? 'Quiz du Jour terminé' : 'Quiz du Jour'}</strong>
            <span>{completed ? `${correctCount}/3 bonnes réponses · Reviens demain` : '3 questions · Bonus quotidien'}</span>
            <b>{completed ? <><Check size={15} /> Défi relevé</> : <>Jouer maintenant <ArrowRight size={15} /></>}</b>
          </span>
          <span className="daily-portal__visual"><DailyQuizArtwork completed={completed} /></span>
        </button>

        <div className="solo-portal__catalog">
          <div className="solo-portal__catalog-header">
            <div className="solo-category-tabs">
              {GAME_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`solo-category-tab ${selectedCategory === cat.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <span className="solo-catalog-count">{filteredGames.length} jeux</span>
          </div>

          <div className="solo-portal__scrollable">
            {filteredGames.map((game) => (
              <PortalGame
                key={game.id}
                icon={game.icon}
                eyebrow={game.eyebrow}
                title={game.title}
                description={game.description}
                action={game.actionLabel}
                disabled={game.status !== 'available'}
                onClick={() => handleGameAction(game.id)}
                accent={game.accent}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export function MultiplayerPortal({
  roomCode,
  setRoomCode,
  joining,
  creating,
  joinError,
  createError,
  onJoin,
  onCreate,
}) {
  return (
    <article className="mode-portal mode-portal--arena">
      <span className="mode-portal__glow" aria-hidden="true" />
      <header className="mode-portal__header">
        <div>
          <span className="mode-portal__eyebrow"><Users size={13} /> Mode en ligne & duels</span>
          <h2>L&rsquo;Ar&egrave;ne Multijoueur</h2>
          <p>Invite ta bande ou provoque la communaut&eacute; dans des parties express.</p>
        </div>
        <span className="mode-portal__status"><span /> Serveurs en ligne</span>
      </header>

      <div className="arena-portal__games">
        <PortalGame
          icon={Bomb}
          eyebrow="Party game"
          title="Chrono-Bomb"
          description={'Trouve le mot avant l\u2019explosion.'}
          action={creating ? 'Cr\u00e9ation\u2026' : 'Lancer'}
          onClick={() => onCreate('chrono_bomb')}
          disabled={creating}
          accent="violet"
        />
        <PortalGame
          icon={Zap}
          eyebrow="5 questions"
          title="Quiz Flash 1v1"
          description="Le plus rapide remporte le duel."
          action={creating ? 'Cr\u00e9ation\u2026' : 'D\u00e9fier'}
          onClick={() => onCreate('kculture')}
          disabled={creating}
          accent="blue"
        />
      </div>

      <form className="portal-join" onSubmit={onJoin}>
        <span className="portal-join__icon"><LockKeyhole size={18} /></span>
        <label htmlFor="dashboard-room-code">
          <small>Salon priv&eacute;</small>
          <strong>Rejoindre avec un code</strong>
        </label>
        <input
          id="dashboard-room-code"
          value={roomCode}
          onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
          maxLength={5}
          placeholder="ABCDE"
          aria-describedby={(joinError || createError) ? 'dashboard-room-error' : undefined}
        />
        <button type="submit" disabled={joining}>
          {joining ? 'Connexion\u2026' : 'Rejoindre'} <ArrowRight size={15} />
        </button>
        {(joinError || createError) && <p id="dashboard-room-error" className="inline-error">{joinError || createError}</p>}
      </form>
    </article>
  );
}

export function CollectionCard({ unlocked, total, percentage, onOpen }) {
  const safeUnlocked = unlocked || 0;
  const safeTotal = total || 0;
  const remaining = Math.max(0, safeTotal - safeUnlocked);

  return (
    <button className="dashboard-card dashboard-card--kpi dashboard-card--collection" type="button" onClick={onOpen}>
      <div className="card-topline">
        <span className="kpi-header-label kpi-header-label--fuchsia">
          <Sparkles size={14} /> Album & Cartes
        </span>
        <ChevronRight size={17} className="kpi-chevron" />
      </div>
      <div className="card-bottom">
        <div className="value-row">
          <h2>{safeUnlocked} <span className="value-total">/ {safeTotal}</span></h2>
          <strong className="kpi-badge kpi-badge--fuchsia">{percentage}%</strong>
        </div>
        <ProgressBar value={percentage} color="#e879f9" />
        <div className="kpi-footer-row">
          <span className="mono-note">
            {safeUnlocked === 0 ? 'Ouvre tes premiers boosters' : remaining === 0 ? 'Collection complète !' : `Encore ${remaining} cartes à découvrir`}
          </span>
        </div>
      </div>
    </button>
  );
}

export function WalletCard({ coins, onOpenShop }) {
  const safeCoins = coins || 0;
  const boosterCount = Math.floor(safeCoins / 250);
  const boosterProgress = Math.min(100, Math.round(((safeCoins % 250) / 250) * 100));
  const neededForBooster = Math.max(0, 250 - (safeCoins % 250));

  return (
    <button className="dashboard-card dashboard-card--kpi dashboard-card--wallet" type="button" onClick={onOpenShop} aria-label="Ouvrir la boutique">
      <div className="card-topline">
        <span className="kpi-header-label kpi-header-label--amber">
          <Coins size={14} /> Portefeuille
        </span>
        <ChevronRight size={17} className="kpi-chevron" />
      </div>
      <div className="card-bottom">
        <div className="value-row value-row--coins">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <h2>{safeCoins.toLocaleString('fr-FR')}</h2>
            <span>coins</span>
          </div>
          {safeCoins >= 250 && (
            <strong className="kpi-badge kpi-badge--amber">{boosterCount} booster{boosterCount > 1 ? 's' : ''}</strong>
          )}
        </div>
        <ProgressBar value={safeCoins >= 250 ? 100 : boosterProgress} color="#fbbf24" />
        <div className="kpi-footer-row">
          <span className="mono-note">
            {safeCoins >= 250 ? (
              <span style={{ color: '#fcd34d', fontWeight: 650 }}>Prêt pour l'ouverture de booster</span>
            ) : (
              `Encore ${neededForBooster} coins pour un booster`
            )}
          </span>
        </div>
      </div>
    </button>
  );
}

export function ProgressCard({ level, badge, currentXp, neededXp, percentage, onOpenLeaderboard }) {
  const remainingXp = Math.max(0, (neededXp || 0) - (currentXp || 0));

  return (
    <button
      className="dashboard-card dashboard-card--kpi dashboard-card--progress"
      type="button"
      onClick={onOpenLeaderboard}
      aria-label={`Voir le classement, niveau ${level}`}
    >
      <div className="card-topline">
        <span className="kpi-header-label kpi-header-label--teal">
          <Trophy size={14} /> Progression
        </span>
        <ChevronRight size={17} className="kpi-chevron" />
      </div>
      <div className="card-bottom">
        <div className="value-row">
          <h2>Niveau {level}</h2>
          <strong className="kpi-badge kpi-badge--teal">{badge}</strong>
        </div>
        <ProgressBar value={percentage} color="#2dd4bf" />
        <div className="kpi-footer-row">
          <span className="mono-note">
            {remainingXp > 0 ? `Encore ${remainingXp} XP pour Niv.${level + 1}` : 'Niveau maximal atteint'}
          </span>
        </div>
      </div>
    </button>
  );
}

export function CreatorCard({ onOpen }) {
  return (
    <button className="dashboard-card dashboard-card--creator" type="button" onClick={onOpen}>
      <div className="creator-card__left">
        <div className="creator-card__icon-box">
          <Lightbulb size={24} />
        </div>
        <div className="creator-card__copy">
          <h3>Enrichis le Quiz avec tes questions</h3>
          <p>Propose de nouvelles questions aux packs existants ou crée tes propres thèmes.</p>
        </div>
      </div>
      <div className="creator-card__action">
        <span>Créer une question</span>
        <ArrowRight size={15} />
      </div>
    </button>
  );
}

export function SoloCard({ onStart }) {
  return (
    <article className="dashboard-card dashboard-card--solo">
      <div className="card-topline"><span className="icon-box"><Play size={18} fill="currentColor" /></span><span className="mono-note">Solo</span></div>
      <div className="card-bottom"><h2>Entraînement</h2><p>Teste tes connaissances à ton rythme et gagne des pièces à chaque bonne réponse.</p><button className="button button--dark" type="button" onClick={onStart}>Jouer en solo</button></div>
    </article>
  );
}

export function ArenaCard({ roomCode, setRoomCode, createMode, setCreateMode, joining, creating, joinError, createError, onJoin, onCreate }) {
  return (
    <article className="dashboard-card dashboard-card--arena">
      <div className="card-topline"><span className="icon-box"><Users size={20} /></span><span className="mono-note">Multijoueur</span></div>
      <div className="card-bottom arena-card__body">
        <div className="arena-card__copy">
          <h2>Arène</h2>
          <p>Crée une partie privée ou rejoins instantanément tes amis.</p>
          <label style={{ display: 'grid', gap: '5px', margin: '12px 0', fontSize: '.75rem' }}>
            Mode du nouveau salon
            <select
              value={createMode}
              onChange={(event) => setCreateMode(event.target.value)}
              style={{ padding: '9px 10px', borderRadius: '9px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            >
              <option value="chrono_bomb">💣 Chrono-Bomb</option>
              <option value="kculture">Culture générale</option>
            </select>
          </label>
          <button className="text-action text-action--light" type="button" onClick={onCreate} disabled={creating}>
            <Plus size={14} /> {creating ? 'Création…' : 'Créer un salon'}
          </button>
        </div>
        <div className="arena-card__join">
          <span>J’ai déjà un code</span>
          <form className="arena-form" onSubmit={onJoin}>
            <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} maxLength={5} placeholder="ABCDE" aria-label="Code salon" />
            <button type="submit" aria-label="Rejoindre" disabled={joining}><ArrowRight size={17} /></button>
          </form>
          {(joinError || createError) && <p className="inline-error">{joinError || createError}</p>}
        </div>
      </div>
    </article>
  );
}
