import React, { useEffect, useState } from "react";
import { api } from "../utils/api";
import {
  ArrowRight,
  ChevronRight,
  Gem,
  LayoutGrid,
  LockKeyhole,
  Play,
  Plus,
  Trophy,
  Users,
  WalletCards,
  Zap,
  Clock,
} from "lucide-react";
import {
  getLevel,
  getLevelBadge,
  getLevelProgressDetails,
} from "../utils/progression";

// ── Glassmorphism helper class ───────────────────────────────────────────────
const glass =
  "border border-white/15 bg-slate-900/55 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-18px_30px_rgba(2,6,23,0.24),0_18px_48px_rgba(2,6,23,0.24)]";

function ProgressBar({ value, accentColor = "#2dd4bf", className = "" }) {
  return (
    <div
      className={`overflow-hidden rounded-full ${className}`}
      style={{ height: "6px", background: "rgba(0,0,0,0.25)" }}
    >
      <div
        style={{
          width: `${value}%`,
          height: "100%",
          borderRadius: "9999px",
          background: accentColor,
          transition: "width 0.5s ease",
        }}
      />
    </div>
  );
}

function formatTimeLeft(seconds) {
  if (!seconds || seconds <= 0) return "Expiré";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
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
  const [collectionData, setCollectionData] = useState(() => {
    try {
      const cached = localStorage.getItem("cache_collection");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [roomCode, setRoomCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [createError, setCreateError] = useState("");
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

  // Quests States
  const [quests, setQuests] = useState(() => {
    try {
      const cached = localStorage.getItem("cache_quests");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [activeTab, setActiveTab] = useState("daily");
  const [claimingQuestId, setClaimingQuestId] = useState(null);

  useEffect(() => {
    fetchCollection();
    fetchQuests();
  }, []);

  const fetchCollection = async () => {
    try {
      const data = await api.get("/shop/collection");
      if (data) {
        setCollectionData(data);
        localStorage.setItem("cache_collection", JSON.stringify(data));
      }
    } catch (err) {
      console.error("Failed to fetch collection data", err);
    }
  };

  const fetchQuests = async () => {
    try {
      const data = await api.get("/quests");
      if (data && data.success) {
        setQuests(data.quests || []);
        localStorage.setItem("cache_quests", JSON.stringify(data.quests));
      }
    } catch (err) {
      console.error("Failed to fetch quests", err);
    }
  };

  const handleClaimQuest = async (userQuestId) => {
    if (claimingQuestId) return;
    setClaimingQuestId(userQuestId);
    try {
      const data = await api.post("/quests/claim", { user_quest_id: userQuestId });
      if (data && data.success) {
        if (onUpdateUserStats) {
          onUpdateUserStats({ coins: data.coins, global_score: data.global_score });
        }
        fetchQuests();
      }
    } catch (err) {
      console.error("Failed to claim quest", err);
    } finally {
      setClaimingQuestId(null);
    }
  };

  // ── Progression ─────────────────────────────────────────────────────────
  const lvl = getLevel(user.global_score);
  const badgeLabel = getLevelBadge(lvl);
  const { currentLevelXp, xpNeededForNextLevel } = getLevelProgressDetails(user.global_score);
  const xpPercentage =
    xpNeededForNextLevel > 0
      ? Math.min(Math.round((currentLevelXp / xpNeededForNextLevel) * 100), 100)
      : 0;

  // ── Collection ──────────────────────────────────────────────────────────
  const totalCardsInCatalog = collectionData?.catalog?.cards?.length || 0;
  const unlockedCardsMap = collectionData?.unlocked_cards || {};
  const unlockedCount = Object.keys(unlockedCardsMap).length;
  const collectionPercentage =
    totalCardsInCatalog > 0 ? Math.round((unlockedCount / totalCardsInCatalog) * 100) : 0;

  const handleStartSolo = () => onStartSolo(0, "kculture");

  const handleCreateLobby = async () => {
    setCreating(true);
    setCreateError("");
    try {
      const data = await api.post("/lobby/create", { pack_id: 0, game_mode: "kculture" });
      if (data.success && data.room_code) onCreateLobby(data.room_code);
    } catch (err) {
      setCreateError(err.message || "Impossible de créer le salon.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinLobby = async (e) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 5) {
      setJoinError("Le code doit faire exactement 5 caractères.");
      return;
    }
    setJoining(true);
    setJoinError("");
    try {
      const data = await api.post("/lobby/join", { room_code: code });
      if (data.success) onJoinLobby(code);
    } catch (err) {
      setJoinError(err.message || "Impossible de rejoindre ce salon.");
    } finally {
      setJoining(false);
    }
  };

  // ── Date ────────────────────────────────────────────────────────────────
  const today = new Date();
  const formattedDate =
    today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());

  // ── Daily quiz ──────────────────────────────────────────────────────────
  const dailyCompleted = dailyStatus?.completed;
  const dailyCorrectCount = dailyStatus?.attempt
    ? [dailyStatus.attempt.q1_correct, dailyStatus.attempt.q2_correct, dailyStatus.attempt.q3_correct]
        .filter(Boolean).length
    : 0;

  // ── Quest badge helpers ──────────────────────────────────────────────────
  const claimableDailyCount = quests.filter(
    (q) => q.type === "daily" && q.progress >= q.target_value && !q.is_claimed
  ).length;
  const claimableWeeklyCount = quests.filter(
    (q) => q.type === "weekly" && q.progress >= q.target_value && !q.is_claimed
  ).length;

  return (
    <div
      style={{
        fontFamily: "'Manrope', 'Outfit', sans-serif",
        color: "#f8fafc",
      }}
    >
      {/* ── Content container ───────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "28px 24px 48px",
        }}
        className="dashboard-responsive-padding"
      >
        {/* ── Welcome header ──────────────────────────────────────────────── */}
        <section
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "12px",
            paddingBottom: "28px",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#2dd4bf",
                marginBottom: "8px",
                fontWeight: 500,
              }}
            >
              {formattedDate} · Saison 04
            </p>
            <h1
              style={{
                fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif",
                fontSize: "clamp(28px, 4vw, 42px)",
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: "-0.04em",
                color: "#fff",
                margin: 0,
              }}
            >
              Bonjour, {user.username}.
            </h1>
          </div>
          <p
            style={{
              fontSize: "13px",
              lineHeight: "1.6",
              color: "#aab7ce",
              maxWidth: "320px",
              textAlign: "right",
            }}
          >
            {dailyCompleted
              ? "Tu as déjà relevé le défi du jour !"
              : "Ton espace de jeu est prêt. Une récompense t'attend aujourd'hui."}
          </p>
        </section>

        {/* ── Main dashboard grid ─────────────────────────────────────────── */}
        <div className="dashboard-grid">

          {/* ─── Card 1: Quiz du Jour ─── */}
          <article
            className="dashboard-card-daily"
            data-cols="5"
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: "28px",
              border: "1px solid rgba(45,212,191,0.35)",
              background: "rgba(15,118,110,0.38)",
              backdropFilter: "blur(24px)",
              padding: "32px",
              color: "#f0fdfc",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -25px 45px rgba(2,6,23,0.2), 0 20px 55px rgba(2,6,23,0.3)",
              minHeight: "320px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* decorative rings */}
            <div
              style={{
                position: "absolute", right: "-24px", top: "-24px",
                width: "210px", height: "210px",
                borderRadius: "50%",
                border: "26px solid rgba(45,212,191,0.35)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute", bottom: "-40px", right: "48px",
                width: "100px", height: "160px",
                borderRadius: "18px",
                border: "4px solid rgba(45,212,191,0.6)",
                background: "rgba(15,23,42,0.35)",
                transform: "rotate(27deg)",
                pointerEvents: "none",
              }}
            />

            <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: "9999px",
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: "rgba(255,255,255,0.12)",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "10px",
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  width: "fit-content",
                }}
              >
                Événement quotidien
              </span>

              <div style={{ marginTop: "auto" }}>
                <p
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "11px",
                    fontWeight: 500,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(204,251,241,0.85)",
                    marginBottom: "12px",
                  }}
                >
                  Quiz du jour ·{" "}
                  {today.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                </p>

                {dailyCompleted ? (
                  <>
                    <h2
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontSize: "clamp(32px, 4vw, 44px)",
                        fontWeight: 800,
                        lineHeight: "0.98",
                        letterSpacing: "-0.06em",
                        marginBottom: "12px",
                      }}
                    >
                      Score : {dailyCorrectCount}/3
                    </h2>
                    <p style={{ fontSize: "13px", fontWeight: 500, lineHeight: "1.5", color: "rgba(204,251,241,0.75)" }}>
                      Défi complété ! Reviens demain pour un nouveau challenge.
                    </p>
                  </>
                ) : (
                  <>
                    <h2
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontSize: "clamp(32px, 4vw, 44px)",
                        fontWeight: 800,
                        lineHeight: "0.98",
                        letterSpacing: "-0.06em",
                        marginBottom: "12px",
                      }}
                    >
                      La carte<br />mystère.
                    </h2>
                    <p style={{ fontSize: "13px", fontWeight: 500, lineHeight: "1.5", color: "rgba(204,251,241,0.75)", maxWidth: "260px" }}>
                      3 questions pour prouver que tu connais vraiment ta collection.
                    </p>
                  </>
                )}

                <button
                  onClick={onStartDailyQuiz}
                  style={{
                    marginTop: "20px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 18px",
                    borderRadius: "14px",
                    background: "#0f172a",
                    color: "#fff",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#000")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#0f172a")}
                >
                  {dailyCompleted ? "Voir les résultats" : "Lancer le quiz"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </article>

          {/* ─── Card 2: Progression ─── */}
          <article
            className={`dashboard-card-sm ${glass}`}
            data-cols="3"
            style={{
              borderRadius: "28px",
              padding: "24px",
              minHeight: "160px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div
                style={{
                  width: "40px", height: "40px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#2dd4bf",
                }}
              >
                <Trophy size={20} />
              </div>
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#aab7ce",
                  fontWeight: 500,
                }}
              >
                {badgeLabel}
              </span>
            </div>

            <div style={{ marginTop: "auto" }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "4px" }}>
                <div>
                  <p style={{ fontSize: "11px", fontWeight: 600, color: "#aab7ce", marginBottom: "2px" }}>Progression</p>
                  <p
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: "22px",
                      fontWeight: 800,
                      letterSpacing: "-0.05em",
                      color: "#fff",
                    }}
                  >
                    Niveau {lvl}
                  </p>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#2dd4bf" }}>
                  {currentLevelXp} / {xpNeededForNextLevel} XP
                </span>
              </div>
              <ProgressBar value={xpPercentage} accentColor="#2dd4bf" className="mt-2" />
            </div>
          </article>

          {/* ─── Card 3: Album & Deck ─── */}
          <article
            onClick={onOpenCollection}
            data-cols="4"
            style={{
              borderRadius: "28px",
              border: "1px solid rgba(217,70,239,0.45)",
              background: "rgba(112,26,117,0.35)",
              backdropFilter: "blur(24px)",
              padding: "24px",
              color: "#fdf4ff",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -25px 40px rgba(59,7,100,0.25), 0 20px 55px rgba(2,6,23,0.3)",
              minHeight: "160px",
              cursor: "pointer",
              transition: "transform 0.2s ease",
              display: "flex",
              flexDirection: "column",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div
                style={{
                  width: "40px", height: "40px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "14px",
                  background: "rgba(216,180,254,0.15)",
                  border: "1px solid rgba(216,180,254,0.15)",
                  color: "#e879f9",
                }}
              >
                <LayoutGrid size={19} />
              </div>
              <ChevronRight size={20} style={{ color: "#e879f9", opacity: 0.7 }} />
            </div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(240,171,252,0.75)", marginTop: "20px", marginBottom: "4px" }}>
              Album & Deck
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <p
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "30px",
                  fontWeight: 800,
                  letterSpacing: "-0.06em",
                  color: "#fff",
                  margin: 0,
                }}
              >
                {collectionPercentage}%
              </p>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "rgba(240,171,252,0.7)" }}>
                {unlockedCount} / {totalCardsInCatalog} cartes
              </span>
            </div>
          </article>

          {/* ─── Card 4: Portefeuille ─── */}
          <article
            className={glass}
            data-cols="4"
            style={{
              borderRadius: "28px",
              padding: "24px",
              minHeight: "200px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div
                style={{
                  width: "40px", height: "40px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#2dd4bf",
                }}
              >
                <WalletCards size={20} />
              </div>
              <button
                onClick={onOpenLeaderboard}
                style={{
                  fontSize: "11px", fontWeight: 700, color: "#2dd4bf",
                  background: "none", border: "none", cursor: "pointer",
                  textDecoration: "underline", textUnderlineOffset: "3px",
                }}
              >
                Classement
              </button>
            </div>

            <div style={{ marginTop: "auto" }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "#aab7ce", marginBottom: "6px" }}>Portefeuille</p>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Gem size={22} style={{ color: "#fbbf24" }} />
                <span
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: "28px",
                    fontWeight: 800,
                    letterSpacing: "-0.05em",
                    color: "#fff",
                  }}
                >
                  {user.coins || 0}
                </span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#aab7ce", paddingTop: "4px" }}>coins</span>
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                <button
                  onClick={onOpenShop}
                  style={{
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#fff",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                >
                  Ouvrir un booster
                </button>
                <button
                  onClick={onOpenCollection}
                  style={{
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#fff",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                >
                  Mon album
                </button>
              </div>
            </div>
          </article>

          {/* ─── Card 5: Créer un Thème ─── */}
          <article
            onClick={onOpenCreator}
            data-cols="4"
            style={{
              borderRadius: "28px",
              border: "1px solid rgba(99,102,241,0.4)",
              background: "rgba(49,46,129,0.35)",
              backdropFilter: "blur(24px)",
              padding: "24px",
              color: "#eef2ff",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -25px 40px rgba(30,27,75,0.28), 0 20px 55px rgba(2,6,23,0.3)",
              minHeight: "200px",
              display: "flex",
              flexDirection: "column",
              cursor: "pointer",
              transition: "transform 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div
                style={{
                  width: "40px", height: "40px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "14px",
                  background: "rgba(165,180,252,0.15)",
                  border: "1px solid rgba(165,180,252,0.15)",
                  color: "#a5b4fc",
                }}
              >
                <Plus size={20} />
              </div>
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(199,210,254,0.6)",
                  fontWeight: 500,
                }}
              >
                Créatif
              </span>
            </div>

            <div style={{ marginTop: "auto" }}>
              <h2
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "24px",
                  fontWeight: 800,
                  letterSpacing: "-0.05em",
                  color: "#fff",
                  marginBottom: "6px",
                }}
              >
                Créer un thème
              </h2>
              <p style={{ fontSize: "13px", fontWeight: 500, lineHeight: "1.5", color: "rgba(199,210,254,0.7)", marginBottom: "16px", maxWidth: "240px" }}>
                Propose tes propres questions et défie la communauté avec tes créations.
              </p>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "12px",
                  background: "#0f172a",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                <Plus size={13} /> Commencer
              </span>
            </div>
          </article>

          {/* ─── Card 6: Entraînement Solo ─── */}
          <article
            data-cols="4"
            style={{
              borderRadius: "28px",
              border: "1px solid rgba(251,191,36,0.4)",
              background: "rgba(120,53,15,0.35)",
              backdropFilter: "blur(24px)",
              padding: "24px",
              color: "#fffbeb",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -25px 40px rgba(69,26,3,0.28), 0 20px 55px rgba(2,6,23,0.3)",
              minHeight: "200px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div
                style={{
                  width: "40px", height: "40px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "14px",
                  background: "rgba(253,230,138,0.15)",
                  border: "1px solid rgba(253,230,138,0.15)",
                  color: "#fde68a",
                }}
              >
                <Play size={18} fill="currentColor" />
              </div>
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(254,243,199,0.65)",
                  fontWeight: 500,
                }}
              >
                Solo
              </span>
            </div>

            <div style={{ marginTop: "auto" }}>
              <h2
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "24px",
                  fontWeight: 800,
                  letterSpacing: "-0.05em",
                  color: "#fff",
                  marginBottom: "6px",
                }}
              >
                Entraînement
              </h2>
              <p style={{ fontSize: "13px", fontWeight: 500, lineHeight: "1.5", color: "rgba(254,243,199,0.7)", marginBottom: "16px", maxWidth: "240px" }}>
                Testez vos connaissances à votre rythme et gagnez des pièces à chaque bonne réponse.
              </p>
              <button
                onClick={handleStartSolo}
                style={{
                  padding: "9px 18px",
                  borderRadius: "12px",
                  background: "#0f172a",
                  color: "#fff",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#000")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#0f172a")}
              >
                Jouer en solo
              </button>
            </div>
          </article>

          {/* ─── Card 6: Arène Multijoueur ─── */}
          <article
            data-cols="4"
            style={{
              borderRadius: "28px",
              border: "1px solid rgba(45,212,191,0.4)",
              background: "rgba(17,94,89,0.35)",
              backdropFilter: "blur(24px)",
              padding: "24px",
              color: "#f0fdfa",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -25px 40px rgba(4,47,46,0.28), 0 20px 55px rgba(2,6,23,0.3)",
              minHeight: "200px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div
                style={{
                  width: "40px", height: "40px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "14px",
                  background: "rgba(153,246,228,0.15)",
                  border: "1px solid rgba(153,246,228,0.12)",
                  color: "#5eead4",
                }}
              >
                <Users size={20} />
              </div>
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(204,251,241,0.6)",
                  fontWeight: 500,
                }}
              >
                Multijoueur
              </span>
            </div>

            <div style={{ marginTop: "auto" }}>
              <h2
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "24px",
                  fontWeight: 800,
                  letterSpacing: "-0.05em",
                  color: "#fff",
                  marginBottom: "12px",
                }}
              >
                Arène
              </h2>

              <form onSubmit={handleJoinLobby} style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                <input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={5}
                  placeholder="Code salon"
                  required
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: "40px",
                    borderRadius: "12px",
                    border: "1px solid rgba(153,246,228,0.18)",
                    background: "rgba(15,23,42,0.3)",
                    padding: "0 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#fff",
                    outline: "none",
                    letterSpacing: "0.08em",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#2dd4bf")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(153,246,228,0.18)")}
                />
                <button
                  type="submit"
                  disabled={joining}
                  aria-label="Rejoindre"
                  style={{
                    width: "40px", height: "40px",
                    flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: "12px",
                    background: "#0f172a",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#000")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#0f172a")}
                >
                  <ArrowRight size={17} />
                </button>
              </form>

              <button
                onClick={handleCreateLobby}
                disabled={creating}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "rgba(204,251,241,0.85)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  textDecorationColor: "#2dd4bf",
                  textUnderlineOffset: "4px",
                }}
              >
                <Plus size={14} />
                {creating ? "Création..." : "Créer un salon"}
              </button>

              {joinError && (
                <p style={{ marginTop: "8px", fontSize: "11px", fontWeight: 700, color: "#f87171" }}>{joinError}</p>
              )}
              {createError && (
                <p style={{ marginTop: "8px", fontSize: "11px", fontWeight: 700, color: "#f87171" }}>{createError}</p>
              )}
            </div>
          </article>

          {/* ─── Card 7: Missions ─── */}
          <article
            className={glass}
            data-cols="12"
            style={{
              borderRadius: "28px",
              padding: "24px 28px",
            }}
          >
            {/* Header missions */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                paddingBottom: "20px",
                marginBottom: "20px",
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "10px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#2dd4bf",
                    fontWeight: 500,
                    marginBottom: "4px",
                  }}
                >
                  Objectifs
                </p>
                <h2
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: "22px",
                    fontWeight: 800,
                    letterSpacing: "-0.05em",
                    color: "#fff",
                    margin: 0,
                  }}
                >
                  Missions
                </h2>
              </div>

              {/* Tab selector */}
              <div
                style={{
                  display: "flex",
                  borderRadius: "12px",
                  background: "rgba(15,23,42,0.4)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "4px",
                }}
              >
                {[
                  { key: "daily", label: "Quotidiennes", count: claimableDailyCount },
                  { key: "weekly", label: "Hebdomadaires", count: claimableWeeklyCount },
                ].map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "9px",
                      border: activeTab === key ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                      background: activeTab === key ? "rgba(255,255,255,0.1)" : "transparent",
                      color: activeTab === key ? "#fff" : "#aab7ce",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {label}
                    {count > 0 && (
                      <span
                        style={{
                          background: "#ef4444",
                          color: "#fff",
                          fontSize: "9px",
                          fontWeight: 800,
                          padding: "1px 5px",
                          borderRadius: "9999px",
                          lineHeight: "1.4",
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Quest cards grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
                gap: "14px",
              }}
            >
              {quests.filter((q) => q.type === activeTab).map((q) => {
                const complete = q.progress >= q.target_value;
                const pct = Math.min(100, Math.round((q.progress / q.target_value) * 100));

                return (
                  <div
                    key={q.user_quest_id}
                    style={{
                      borderRadius: "18px",
                      background: "rgba(15,23,42,0.35)",
                      border: complete && !q.is_claimed
                        ? "1px solid rgba(45,212,191,0.4)"
                        : q.is_claimed
                        ? "1px solid rgba(255,255,255,0.05)"
                        : "1px solid rgba(255,255,255,0.08)",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      backdropFilter: "blur(16px)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
                      opacity: q.is_claimed ? 0.65 : 1,
                      transition: "border-color 0.2s, opacity 0.2s",
                    }}
                  >
                    {/* Quest header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: "13px", fontWeight: 800, color: "#fff", marginBottom: "3px" }}>
                          {q.title}
                        </p>
                        <p style={{ fontSize: "11px", color: "#aab7ce", lineHeight: "1.4" }}>
                          {q.description}
                        </p>
                      </div>
                      {q.time_left_seconds && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            fontSize: "10px",
                            fontWeight: 600,
                            color: "#94a3b8",
                            background: "rgba(255,255,255,0.04)",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            border: "1px solid rgba(255,255,255,0.06)",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          <Clock size={10} />
                          {formatTimeLeft(q.time_left_seconds)}
                        </span>
                      )}
                    </div>

                    {/* Progress */}
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "10px",
                          fontWeight: 600,
                          marginBottom: "5px",
                        }}
                      >
                        <span style={{ color: complete ? "#2dd4bf" : "#94a3b8" }}>
                          {complete ? "Terminé !" : "Progression"}
                        </span>
                        <span style={{ color: "#e2e8f0" }}>
                          {q.progress} / {q.target_value}
                        </span>
                      </div>
                      <ProgressBar
                        value={pct}
                        accentColor={complete ? "#2dd4bf" : "#64748b"}
                      />
                    </div>

                    {/* Rewards + action */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px" }}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <span
                          style={{
                            display: "inline-flex", alignItems: "center", gap: "3px",
                            fontSize: "11px", fontWeight: 800, color: "#fbbf24",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            padding: "3px 8px", borderRadius: "7px",
                          }}
                        >
                          +{q.reward_coins} 🪙
                        </span>
                        <span
                          style={{
                            display: "inline-flex", alignItems: "center", gap: "3px",
                            fontSize: "11px", fontWeight: 800, color: "#2dd4bf",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            padding: "3px 8px", borderRadius: "7px",
                          }}
                        >
                          +{q.reward_xp} XP
                        </span>
                      </div>

                      {q.is_claimed ? (
                        <span
                          style={{
                            fontSize: "11px", fontWeight: 800, color: "#4ade80",
                            background: "rgba(74,222,128,0.08)",
                            border: "1px solid rgba(74,222,128,0.18)",
                            padding: "4px 10px", borderRadius: "7px",
                          }}
                        >
                          Réclamé
                        </span>
                      ) : complete ? (
                        <button
                          onClick={() => handleClaimQuest(q.user_quest_id)}
                          disabled={claimingQuestId === q.user_quest_id}
                          style={{
                            padding: "5px 12px",
                            fontSize: "11px",
                            fontWeight: 800,
                            borderRadius: "8px",
                            background: "#2dd4bf",
                            color: "#0f2723",
                            border: "none",
                            cursor: "pointer",
                            transition: "background 0.2s, transform 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#5eead4")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#2dd4bf")}
                        >
                          {claimingQuestId === q.user_quest_id ? "..." : "Réclamer"}
                        </button>
                      ) : (
                        <span
                          style={{
                            fontSize: "11px", fontWeight: 700, color: "#64748b",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            padding: "4px 10px", borderRadius: "7px",
                          }}
                        >
                          En cours
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {quests.filter((q) => q.type === activeTab).length === 0 && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    textAlign: "center",
                    padding: "40px 20px",
                    fontSize: "13px",
                    color: "#64748b",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Zap size={28} style={{ color: "#334155", opacity: 0.6 }} />
                  Aucune mission disponible pour cette catégorie.
                </div>
              )}
            </div>
          </article>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "32px",
            fontFamily: "'DM Mono', monospace",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#475569",
          }}
        >
          <span>Le QG · Collect, play, repeat.</span>
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <LockKeyhole size={11} /> Session sécurisée
          </span>
        </footer>
      </div>

      {/* ── Responsive & grid styles injected ────────────────────────────── */}
      <style>{`
        /* ── Responsive padding ─────────────────────────── */
        @media (min-width: 640px) {
          .dashboard-responsive-padding {
            padding-left: 32px !important;
            padding-right: 32px !important;
          }
        }
        @media (min-width: 1024px) {
          .dashboard-responsive-padding {
            padding-left: 48px !important;
            padding-right: 48px !important;
          }
        }

        /* ── Grid — mobile (1 col) ──────────────────────── */
        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        /* ── Grid — tablet (2 cols) ─────────────────────── */
        @media (min-width: 768px) {
          .dashboard-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          /* Quiz du jour et Missions couvrent toute la largeur */
          .dashboard-grid > [data-cols="5"],
          .dashboard-grid > [data-cols="12"] {
            grid-column: 1 / -1;
          }
        }

        /* ── Grid — desktop (12 cols) ───────────────────── */
        @media (min-width: 1280px) {
          .dashboard-grid {
            grid-template-columns: repeat(12, 1fr);
          }
          .dashboard-grid > [data-cols="5"]  { grid-column: span 5; }
          .dashboard-grid > [data-cols="3"]  { grid-column: span 3; }
          .dashboard-grid > [data-cols="4"]  { grid-column: span 4; }
          .dashboard-grid > [data-cols="12"] { grid-column: 1 / -1; }
        }

        /* ── Fade-in animation ──────────────────────────── */
        @keyframes dashboard-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dashboard-responsive-padding {
          animation: dashboard-fade-in 0.35s ease forwards;
        }
      `}</style>
    </div>
  );
}
