import React from 'react';
import {
  ArrowRight,
  ChevronRight,
  Coins,
  LayoutGrid,
  LockKeyhole,
  Play,
  Plus,
  Trophy,
  Users,
  WalletCards,
  Check,
  X,
} from 'lucide-react';

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
          <text x="93" y="158" fill="#ccfbf1" fillOpacity=".9" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="67" fontWeight="800" textAnchor="middle">?</text>
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

export function ProgressCard({ level, badge, currentXp, neededXp, percentage, onOpenLeaderboard }) {
  return (
    <article className="dashboard-card dashboard-card--glass dashboard-card--progress">
      <div className="card-topline">
        <span className="icon-box"><Trophy size={20} /></span>
        <span className="mono-note">{currentXp} / {neededXp} XP</span>
      </div>
      <div className="card-bottom">
        <span className="card-label">Progression · {badge}</span>
        <div className="value-row"><h2>Niveau {level}</h2><strong>{percentage}%</strong></div>
        <ProgressBar value={percentage} />
        <button className="text-action" type="button" onClick={onOpenLeaderboard}>Voir le classement <ChevronRight size={14} /></button>
      </div>
    </article>
  );
}

export function CollectionCard({ unlocked, total, percentage, onOpen }) {
  return (
    <button className="dashboard-card dashboard-card--collection" type="button" onClick={onOpen}>
      <div className="card-topline"><span className="icon-box"><LayoutGrid size={19} /></span><ChevronRight size={20} /></div>
      <div className="card-bottom">
        <span className="card-label">Album & Deck</span>
        <div className="value-row"><h2>{unlocked} / {total}</h2><span>cartes</span></div>
        <ProgressBar value={percentage} color="#e879f9" />
      </div>
    </button>
  );
}

export function WalletCard({ coins, onOpenShop, onOpenCollection }) {
  return (
    <article className="dashboard-card dashboard-card--glass">
      <div className="card-topline"><span className="icon-box icon-box--teal"><WalletCards size={20} /></span><button className="text-action" type="button" onClick={onOpenShop}>Boutique</button></div>
      <div className="card-bottom">
        <span className="card-label">Portefeuille</span>
        <div className="value-row value-row--coins"><Coins size={22} /><h2>{coins.toLocaleString('fr-FR')}</h2><span>coins</span></div>
        <div className="button-row"><button className="button button--subtle" type="button" onClick={onOpenShop}>Ouvrir un booster</button><button className="button button--subtle" type="button" onClick={onOpenCollection}>Mon album</button></div>
      </div>
    </article>
  );
}

export function CreatorCard({ onOpen }) {
  return (
    <button className="dashboard-card dashboard-card--creator" type="button" onClick={onOpen}>
      <div className="card-topline"><span className="icon-box"><Plus size={20} /></span><span className="mono-note">Créatif</span></div>
      <div className="card-bottom"><h2>Mode création</h2><p>Propose tes questions et défie la communauté avec tes créations.</p><span className="button button--dark"><Plus size={14} /> Commencer</span></div>
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

export function ArenaCard({ roomCode, setRoomCode, joining, creating, joinError, createError, onJoin, onCreate }) {
  return (
    <article className="dashboard-card dashboard-card--arena">
      <div className="card-topline"><span className="icon-box"><Users size={20} /></span><span className="mono-note">Multijoueur</span></div>
      <div className="card-bottom arena-card__body">
        <div className="arena-card__copy"><h2>Arène</h2><p>Crée une partie privée ou rejoins instantanément tes amis.</p><button className="text-action text-action--light" type="button" onClick={onCreate} disabled={creating}><Plus size={14} /> {creating ? 'Création…' : 'Créer un salon'}</button></div>
        <div className="arena-card__join"><span>J’ai déjà un code</span><form className="arena-form" onSubmit={onJoin}><input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} maxLength={5} placeholder="ABCDE" aria-label="Code salon" /><button type="submit" aria-label="Rejoindre" disabled={joining}><ArrowRight size={17} /></button></form>{(joinError || createError) && <p className="inline-error">{joinError || createError}</p>}</div>
      </div>
    </article>
  );
}
