import React from 'react';
import { Check, Clock, Gift, Sparkles, Target } from 'lucide-react';
import { ProgressBar } from './DashboardCards';

function formatTimeLeft(seconds) {
  if (!seconds || seconds <= 0) return 'Expiré';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function MissionCard({ quest, claimingId, onClaim }) {
  const isWeekly = quest.type === 'weekly';
  const progress = Math.max(0, Number(quest.progress) || 0);
  const target = Math.max(1, Number(quest.target_value) || 1);
  const completed = progress >= target;
  const percentage = Math.min(100, Math.round((progress / target) * 100));
  const rewards = [
    quest.reward_coins > 0 && `${quest.reward_coins} coins`,
    quest.reward_xp > 0 && `${quest.reward_xp} XP`,
  ].filter(Boolean).join(' · ');

  return (
    <article className={`mission-card ${isWeekly ? 'mission-card--weekly' : 'mission-card--daily'}${quest.is_claimed ? ' is-claimed' : ''}${completed && !quest.is_claimed ? ' is-claimable' : ''}`}>
      <div className="mission-card__main">
        <div className="mission-card__header">
          <strong>{quest.title}</strong>
          {rewards && (
            <span className="mission-card__reward">
              <Gift size={12} /> {rewards}
            </span>
          )}
        </div>
        {quest.description && <p className="mission-card__desc">{quest.description}</p>}
      </div>

      <div className="mission-card__footer">
        <div className="mission-card__track-group">
          <ProgressBar value={percentage} color={isWeekly ? '#c084fc' : '#2dd4bf'} />
          <span className="mission-card__count">{Math.min(progress, target)}/{target}</span>
        </div>
        <div className="mission-card__action">
          {quest.is_claimed ? (
            <span className="mission-card__badge is-done"><Check size={12} /> Réclamée</span>
          ) : completed ? (
            <button
              type="button"
              className="mission-card__claim-btn"
              onClick={() => onClaim(quest.user_quest_id)}
              disabled={claimingId === quest.user_quest_id}
            >
              {claimingId === quest.user_quest_id ? '…' : 'Réclamer'}
            </button>
          ) : (
            <span className="mission-card__badge is-pending">{percentage}%</span>
          )}
        </div>
      </div>
    </article>
  );
}

function TargetArrowIcon({ size = 12, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="13" r="8" />
      <circle cx="11" cy="13" r="4" />
      <path d="M21 3l-10 10" />
      <path d="M16.5 3.5h4v4" />
    </svg>
  );
}

export default function MissionsPanel({ quests = [], claimingId, onClaim }) {
  const dailyQuests = quests.filter((q) => q.type === 'daily');
  const weeklyQuests = quests.filter((q) => q.type === 'weekly');

  const claimableCount = quests.filter(
    (q) => Number(q.progress) >= Number(q.target_value) && !q.is_claimed
  ).length;

  const dailyTimeLeft = dailyQuests.find((q) => q.time_left_seconds)?.time_left_seconds;
  const weeklyTimeLeft = weeklyQuests.find((q) => q.time_left_seconds)?.time_left_seconds;

  return (
    <section className="missions-panel dashboard-card dashboard-card--glass">
      <header className="missions-panel__header">
        <div>
          <span className="kicker"><TargetArrowIcon size={13} /> Objectifs & Défis</span>
          <h2>Missions</h2>
        </div>
        {claimableCount > 0 && (
          <div className="missions-panel__claim-pill">
            <Sparkles size={14} />
            <span>{claimableCount} récompense{claimableCount > 1 ? 's' : ''} à réclamer !</span>
          </div>
        )}
      </header>

      <div className="missions-columns">
        {/* Colonne Quotidiennes */}
        <div className="missions-col missions-col--daily">
          <div className="missions-col__head">
            <div className="missions-col__title">
              <span className="missions-col__dot missions-col__dot--daily" />
              <h3>Quotidiennes</h3>
            </div>
            {dailyTimeLeft && (
              <span className="missions-col__timer">
                <Clock size={12} /> Reset dans {formatTimeLeft(dailyTimeLeft)}
              </span>
            )}
          </div>
          <div className="missions-list">
            {dailyQuests.map((quest) => (
              <MissionCard key={quest.user_quest_id} quest={quest} claimingId={claimingId} onClaim={onClaim} />
            ))}
            {dailyQuests.length === 0 && (
              <p className="empty-state">Aucune mission quotidienne en cours.</p>
            )}
          </div>
        </div>

        {/* Colonne Hebdomadaires */}
        <div className="missions-col missions-col--weekly">
          <div className="missions-col__head">
            <div className="missions-col__title">
              <span className="missions-col__dot missions-col__dot--weekly" />
              <h3>Hebdomadaires</h3>
            </div>
            {weeklyTimeLeft && (
              <span className="missions-col__timer">
                <Clock size={12} /> Reset dans {formatTimeLeft(weeklyTimeLeft)}
              </span>
            )}
          </div>
          <div className="missions-list">
            {weeklyQuests.map((quest) => (
              <MissionCard key={quest.user_quest_id} quest={quest} claimingId={claimingId} onClaim={onClaim} />
            ))}
            {weeklyQuests.length === 0 && (
              <p className="empty-state">Aucune mission hebdomadaire en cours.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
