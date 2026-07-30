import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { getLevel, getLevelBadge, getLevelProgressDetails } from '../utils/progression';
import {
  CollectionCard,
  CreatorCard,
  MultiplayerPortal,
  ProgressCard,
  SoloPortal,
  WalletCard,
} from './dashboard/DashboardCards';
import MissionsPanel from './dashboard/MissionsPanel';

function readCache(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

export default function DashboardScreen({
  user,
  dailyStatus,
  onStartSolo,
  onCreateLobby,
  onJoinLobby,
  onOpenLeaderboard,
  onStartDailyQuiz,
  onUpdateUserStats,
  onOpenShop,
  onOpenCollection,
  onOpenCreator,
}) {
  const [collectionData, setCollectionData] = useState(() => readCache('cache_collection_summary', null));
  const [quests, setQuests] = useState(() => readCache('cache_quests', []));
  const [activeTab, setActiveTab] = useState('daily');
  const [claimingQuestId, setClaimingQuestId] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [createError, setCreateError] = useState('');
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchCollection = async () => {
    try {
      const data = await api.get('/shop/summary');
      if (data?.success) {
        setCollectionData(data);
        localStorage.setItem('cache_collection_summary', JSON.stringify(data));
      }
    } catch (error) { console.error('Failed to fetch collection data', error); }
  };

  const fetchQuests = async () => {
    try {
      const data = await api.get('/quests');
      if (data?.success) { setQuests(data.quests || []); localStorage.setItem('cache_quests', JSON.stringify(data.quests || [])); }
    } catch (error) { console.error('Failed to fetch quests', error); }
  };

  useEffect(() => { fetchCollection(); fetchQuests(); }, []);

  const handleClaimQuest = async (id) => {
    if (claimingQuestId) return;
    setClaimingQuestId(id);
    try {
      const data = await api.post('/quests/claim', { user_quest_id: id });
      if (data?.success) {
        onUpdateUserStats?.({ coins: data.coins, global_score: data.global_score });
        await fetchQuests();
      }
    } catch (error) { console.error('Failed to claim quest', error); }
    finally { setClaimingQuestId(null); }
  };

  const handleJoinLobby = async (event) => {
    event.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 5) { setJoinError('Le code doit faire exactement 5 caractères.'); return; }
    setJoining(true); setJoinError('');
    try {
      const data = await api.post('/lobby/join', { room_code: code });
      if (data.success) onJoinLobby(code);
    } catch (error) { setJoinError(error.message || 'Impossible de rejoindre ce salon.'); }
    finally { setJoining(false); }
  };

  const handleCreateLobby = async (gameMode = 'chrono_bomb') => {
    setCreating(true); setCreateError('');
    try {
      const data = await api.post('/lobby/create', { pack_id: 0, game_mode: gameMode });
      if (data.success && data.room_code) onCreateLobby(data.room_code);
    } catch (error) { setCreateError(error.message || 'Impossible de créer le salon.'); }
    finally { setCreating(false); }
  };

  const level = getLevel(user.global_score);
  const badge = getLevelBadge(level);
  const { currentLevelXp, xpNeededForNextLevel } = getLevelProgressDetails(user.global_score);
  const xpPercentage = xpNeededForNextLevel > 0 ? Math.min(Math.round((currentLevelXp / xpNeededForNextLevel) * 100), 100) : 0;
  const totalCards = collectionData?.total_cards || 0;
  const unlockedCards = collectionData?.unlocked_cards || 0;
  const collectionPercentage = totalCards > 0 ? Math.round((unlockedCards / totalCards) * 100) : 0;
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, (letter) => letter.toUpperCase());

  return (
    <div className="page page--dashboard">
      <header className="page-intro">
        <div>
          <span className="kicker">{today} · Saison 01</span>
          <h1>Bonjour {user.username}.</h1>
        </div>
      </header>

      <section className="dashboard-grid">
        <div className="dashboard-modes">
          <SoloPortal
            completed={dailyStatus?.completed}
            attempt={dailyStatus?.attempt}
            onStartDaily={onStartDailyQuiz}
            onStartQuiz={() => onStartSolo(0, 'kculture')}
          />
          <MultiplayerPortal
            roomCode={roomCode}
            setRoomCode={setRoomCode}
            joining={joining}
            creating={creating}
            joinError={joinError}
            createError={createError}
            onJoin={handleJoinLobby}
            onCreate={handleCreateLobby}
          />
        </div>

        <div className="dashboard-progression" aria-label="Votre progression">
          <CollectionCard unlocked={unlockedCards} total={totalCards} percentage={collectionPercentage} onOpen={onOpenCollection} />
          <WalletCard coins={user.coins || 0} onOpenShop={onOpenShop} />
          <ProgressCard level={level} badge={badge} currentXp={currentLevelXp} neededXp={xpNeededForNextLevel} percentage={xpPercentage} onOpenLeaderboard={onOpenLeaderboard} />
        </div>

        <CreatorCard onOpen={onOpenCreator} />
        <MissionsPanel quests={quests} activeTab={activeTab} onTabChange={setActiveTab} claimingId={claimingQuestId} onClaim={handleClaimQuest} />
      </section>
    </div>
  );
}
