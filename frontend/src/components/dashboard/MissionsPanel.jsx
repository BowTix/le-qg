import React from 'react';
import { Check, Clock, Gift } from 'lucide-react';
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

export default function MissionsPanel({ quests, activeTab, onTabChange, claimingId, onClaim }) {
  const tabs = [
    { key: 'daily', label: 'Quotidiennes' },
    { key: 'weekly', label: 'Hebdomadaires' },
  ];

  return (
    <section className="missions-panel dashboard-card dashboard-card--glass">
      <header className="missions-panel__header">
        <div><span className="kicker">Objectifs</span><h2>Missions</h2></div>
        <div className="segmented-control">
          {tabs.map((tab) => {
            const count = quests.filter((q) => q.type === tab.key && Number(q.progress) >= Number(q.target_value) && !q.is_claimed).length;
            return <button type="button" key={tab.key} className={activeTab === tab.key ? 'is-active' : ''} onClick={() => onTabChange(tab.key)}>{tab.label}{count > 0 && <span>{count}</span>}</button>;
          })}
        </div>
      </header>

      <div className="missions-grid">
        {quests.filter((quest) => quest.type === activeTab).map((quest) => {
          const progress = Math.max(0, Number(quest.progress) || 0);
          const target = Math.max(1, Number(quest.target_value) || 1);
          const completed = progress >= target;
          const percentage = Math.min(100, Math.round((progress / target) * 100));
          const rewards = [quest.reward_coins > 0 && `${quest.reward_coins} coins`, quest.reward_xp > 0 && `${quest.reward_xp} XP`].filter(Boolean).join(' + ');
          return (
            <article className={`mission${quest.is_claimed ? ' is-claimed' : ''}${completed ? ' is-complete' : ''}`} key={quest.user_quest_id}>
              <div className="mission__heading"><div><h3>{quest.title}</h3><p>{quest.description}</p></div>{quest.time_left_seconds && <span><Clock size={11} />{formatTimeLeft(quest.time_left_seconds)}</span>}</div>
              <div className="mission__progress"><ProgressBar value={percentage} /><span>{Math.min(progress, target)} / {target} · {percentage}%</span></div>
              <div className="mission__footer"><span className="mission__reward"><Gift size={14} /> {rewards || 'Récompense'}</span>{quest.is_claimed ? <span className="mission__done"><Check size={14} /> Réclamée</span> : completed ? <button type="button" onClick={() => onClaim(quest.user_quest_id)} disabled={claimingId === quest.user_quest_id}>{claimingId === quest.user_quest_id ? 'En cours…' : 'Réclamer'}</button> : <span className="mission__pending">En cours</span>}</div>
            </article>
          );
        })}
        {quests.filter((quest) => quest.type === activeTab).length === 0 && <p className="empty-state">Aucune mission disponible pour le moment.</p>}
      </div>
    </section>
  );
}
